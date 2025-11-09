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
@Injectable()
export class ConnectionHandler {
  private logger = new Logger('ConnectionHandler');

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
        if (server && server.sockets) {
          const existingSocket = server.sockets.sockets.get(existingSocketId);
          if (existingSocket) {
            existingSocket.disconnect(true);
          }
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

      this.logger.log(
        `[Ready] Joined ${client.username} to ${memberships.length} servers and ${totalChannels} channels`
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

      // Send initial sync payload
      client.emit('initial-sync', {
        onlineFriends,
        voiceChannels: voiceChannelSnapshots,
      });
    } catch (error) {
      this.logger.error('Error during ready handshake:', error.message);
      client.emit('error', { message: 'Failed to initialize connection' });
    }
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
