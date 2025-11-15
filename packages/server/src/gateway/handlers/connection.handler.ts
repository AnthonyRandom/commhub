import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { LRUCache } from 'lru-cache';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceHandler } from './presence.handler';
import { VoiceChannelManager } from './voice-channel.manager';
import { AuthenticatedSocket, VoiceMember } from '../types/socket.types';

/**
 * Handles WebSocket connection lifecycle
 * Manages authentication, connection/disconnection, and initial sync
 */
interface TurnCredentials {
  host: string;
  username: string;
  password: string;
  expiresAt: number;
}

@Injectable()
export class ConnectionHandler {
  private logger = new Logger('ConnectionHandler');
  private turnCredentialsCache: TurnCredentials | null = null;

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private prisma: PrismaService,
    private presenceHandler: PresenceHandler,
    private voiceChannelManager: VoiceChannelManager
  ) {}

  async handleConnection(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    client: AuthenticatedSocket
  ) {
    try {
      const token =
        client.handshake.auth.token || (client.handshake.query.token as string);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;
      client.username = payload.username;

      // Check client version compatibility
      const clientVersion = client.handshake.query.clientVersion as string;
      const minClientVersion = process.env.MIN_CLIENT_VERSION || '1.0.0';

      if (clientVersion) {
        if (!this.isVersionCompatible(clientVersion, minClientVersion)) {
          this.logger.warn(
            `Client ${client.username} has incompatible version: ${clientVersion} (min required: ${minClientVersion})`
          );
          client.emit('version-mismatch', {
            currentVersion: clientVersion,
            requiredVersion: minClientVersion,
            message:
              'Your app version is outdated. Please refresh the page or update your app.',
          });
          client.disconnect();
          return;
        }
      } else {
        this.logger.warn(
          `Client ${client.username} connected without version information`
        );
      }

      // Check if user already has an active connection
      const existingSocketId = onlineUsers.get(client.userId);
      if (existingSocketId && existingSocketId !== client.id) {
        this.logger.warn(
          `User ${client.username} (${client.userId}) already has an active connection (${existingSocketId}). Disconnecting old socket.`
        );
        try {
          if (server?.sockets?.sockets) {
            const existingSocket = server.sockets.sockets.get(existingSocketId);
            if (existingSocket) {
              existingSocket.disconnect(true);
            }
          }
        } catch (error) {
          this.logger.error(
            `Error disconnecting existing socket: ${error.message}`
          );
        }
      }

      // Track user as online
      onlineUsers.set(client.userId, client.id);

      this.logger.log(
        `Client connected: ${client.username} (${client.userId})${clientVersion ? ` [v${clientVersion}]` : ''}`
      );

      // Notify friends that user came online
      await this.presenceHandler.notifyFriendsPresence(
        server,
        onlineUsers,
        client.userId,
        'online'
      );
    } catch (error) {
      this.logger.error('Authentication failed:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    userVoiceChannels: LRUCache<number, number>,
    voiceChannelMembers: Map<number, Set<VoiceMember>>,
    client: AuthenticatedSocket
  ) {
    if (client.userId) {
      // Check if user was in a voice channel and notify others
      let voiceChannelId = userVoiceChannels.get(client.userId);

      // If not found in userVoiceChannels, scan through voiceChannelMembers
      if (!voiceChannelId) {
        for (const [channelId, members] of voiceChannelMembers.entries()) {
          const userInChannel = Array.from(members).find(
            m => m.userId === client.userId
          );
          if (userInChannel) {
            voiceChannelId = channelId;
            this.logger.warn(
              `[Voice] Found ${client.username} in voiceChannelMembers for channel ${channelId} but not in userVoiceChannels - cleaning up inconsistent state`
            );
            break;
          }
        }
      }

      if (voiceChannelId) {
        const isGracefulLeave = client.gracefulLeaving === true;

        this.logger.log(
          `[Voice] User ${client.username} disconnected while in voice channel ${voiceChannelId} (graceful: ${isGracefulLeave})`
        );

        if (isGracefulLeave) {
          this.logger.log(
            `[Voice] Graceful disconnect - already notified in handleLeaveVoiceChannel`
          );
        } else {
          // Network disconnect - don't notify others to allow silent reconnect
          this.logger.log(
            `[Voice] Network disconnect detected - suppressing notifications to allow silent reconnect`
          );

          // Still clean up tracking to prevent stale state
          userVoiceChannels.delete(client.userId);

          // Remove from voice channel members tracking
          const members = voiceChannelMembers.get(voiceChannelId);
          if (members) {
            const userToRemove = Array.from(members).find(
              m => m.userId === client.userId
            );
            if (userToRemove) {
              members.delete(userToRemove);
              this.logger.log(
                `[Voice] Removed ${client.username} from voiceChannelMembers for channel ${voiceChannelId}`
              );
            }
            if (members.size === 0) {
              voiceChannelMembers.delete(voiceChannelId);
            }
          }

          // Broadcast updated member list silently
          await this.voiceChannelManager.broadcastVoiceChannelMembers(
            server,
            voiceChannelMembers,
            voiceChannelId
          );
        }
      }

      // Remove user from online tracking (they'll be re-added on reconnect)
      onlineUsers.delete(client.userId);

      if (client.username) {
        this.logger.log(
          `Client disconnected: ${client.username} (${client.userId})`
        );
      }

      // Notify friends that user went offline
      this.logger.log(
        `[Disconnect] Notifying friends that ${client.username} (${client.userId}) went offline`
      );
      await this.presenceHandler.notifyFriendsPresence(
        server,
        onlineUsers,
        client.userId,
        'offline'
      );
    }
  }

  async handleReady(
    onlineUsers: LRUCache<number, string>,
    voiceChannelMembers: Map<number, Set<VoiceMember>>,
    client: AuthenticatedSocket
  ) {
    try {
      this.logger.log(
        `[Ready] Received ready event from ${client.username} (${client.userId})`
      );

      // Join all server and channel rooms the user has access to
      const memberships = await this.prisma.server.findMany({
        where: {
          members: {
            some: {
              id: client.userId,
            },
          },
        },
        include: {
          channels: {
            select: { id: true },
          },
        },
      });

      let totalChannels = 0;
      memberships.forEach(membership => {
        const serverRoom = `server-${membership.id}`;
        client.join(serverRoom);

        // Join all text/voice channels for background updates
        membership.channels.forEach(channel => {
          client.join(`channel-${channel.id}`);
          totalChannels++;
        });
      });

      // Join personal user room for mentions and DMs
      client.join(`user-${client.userId}`);

      this.logger.log(
        `[Ready] Joined ${client.username} to ${memberships.length} servers, ${totalChannels} channels, and personal user room`
      );

      // Compute online friends snapshot
      const friends = await this.usersService.getFriends(client.userId);
      const onlineFriends = friends.filter(f => onlineUsers.has(f.id));

      // Compute voice channel members snapshot for all accessible channels
      const voiceChannelSnapshots: Record<
        number,
        Array<{ userId: number; username: string }>
      > = {};
      memberships.forEach(membership => {
        membership.channels.forEach(channel => {
          const members = voiceChannelMembers.get(channel.id);
          if (members && members.size > 0) {
            voiceChannelSnapshots[channel.id] = Array.from(members);
          }
        });
      });

      this.logger.log(
        `[Ready] Sending initial-sync with ${onlineFriends.length} online friends and ${Object.keys(voiceChannelSnapshots).length} voice channels to ${client.username}`
      );

      // Prepare TURN server configuration
      const turnConfig = await this.getTurnConfig();

      // Send initial sync payload
      client.emit('initial-sync', {
        onlineFriends,
        voiceChannels: voiceChannelSnapshots,
        turnConfig,
      });
    } catch (error) {
      this.logger.error('Error during ready handshake:', error.message);
      client.emit('error', { message: 'Failed to initialize connection' });
    }
  }

  /**
   * Fetches TURN credentials from Metered API or uses static credentials
   * Credentials are cached and refreshed when they expire
   */
  private async getTurnConfig(): Promise<{
    host: string;
    username: string;
    password: string;
  } | null> {
    // Check if Metered domain and secret key are configured (preferred method)
    const meteredDomain = process.env.METERED_DOMAIN;
    const meteredSecretKey = process.env.METERED_SECRET_KEY;

    if (meteredDomain && meteredSecretKey) {
      try {
        // Check if cached credentials are still valid (refresh 5 minutes before expiry)
        const now = Date.now();
        if (
          this.turnCredentialsCache &&
          this.turnCredentialsCache.expiresAt > now + 5 * 60 * 1000
        ) {
          this.logger.debug('[TURN] Using cached TURN credentials');
          return {
            host: this.turnCredentialsCache.host,
            username: this.turnCredentialsCache.username,
            password: this.turnCredentialsCache.password,
          };
        }

        // Fetch new credentials from Metered API
        this.logger.log('[TURN] Fetching TURN credentials from Metered API');
        const apiUrl = `https://${meteredDomain}/api/v1/turn/credential?secretKey=${encodeURIComponent(meteredSecretKey)}`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiryInSeconds: 3600 }), // 1 hour validity
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Metered API error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        const data = await response.json();

        // Metered TURN servers use the relay domain, not the custom domain
        // The custom domain is for the API endpoint only
        const turnHost = 'a.relay.metered.ca';

        // Cache the credentials
        this.turnCredentialsCache = {
          host: turnHost,
          username: data.username,
          password: data.password,
          expiresAt: now + 3600 * 1000, // 1 hour from now
        };

        this.logger.log(
          '[TURN] Successfully fetched TURN credentials from Metered'
        );
        return {
          host: this.turnCredentialsCache.host,
          username: this.turnCredentialsCache.username,
          password: this.turnCredentialsCache.password,
        };
      } catch (error) {
        this.logger.error(
          `[TURN] Failed to fetch credentials from Metered API: ${error.message}`
        );
        // Fall through to static credentials if available
      }
    }

    // Fallback to static credentials if Metered API is not configured
    if (
      process.env.TURN_HOST &&
      process.env.TURN_USERNAME &&
      process.env.TURN_PASSWORD
    ) {
      this.logger.debug('[TURN] Using static TURN credentials');
      return {
        host: process.env.TURN_HOST,
        username: process.env.TURN_USERNAME,
        password: process.env.TURN_PASSWORD,
      };
    }

    // No TURN configuration available
    this.logger.warn(
      '[TURN] No TURN server configuration available. WebRTC connections may fail in restrictive networks.'
    );
    return null;
  }

  private isVersionCompatible(
    clientVersion: string,
    minVersion: string
  ): boolean {
    try {
      const parseVersion = (v: string) => {
        const parts = v.split('.').map(p => parseInt(p, 10));
        return {
          major: parts[0] || 0,
          minor: parts[1] || 0,
          patch: parts[2] || 0,
        };
      };

      const client = parseVersion(clientVersion);
      const min = parseVersion(minVersion);

      if (client.major > min.major) return true;
      if (client.major < min.major) return false;
      if (client.minor > min.minor) return true;
      if (client.minor < min.minor) return false;
      return client.patch >= min.patch;
    } catch (error) {
      this.logger.error('Error comparing versions:', error.message);
      return true; // Allow connection on version comparison error
    }
  }
}
