import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Server } from 'socket.io';
import { LRUCache } from 'lru-cache';
import { ChannelsService } from '../../channels/channels.service';
import { AuthenticatedSocket, VoiceMember } from '../types/socket.types';

/**
 * Manages voice channel lifecycle and state
 * Handles joining, leaving, camera controls, and member tracking
 */
@Injectable()
export class VoiceChannelManager {
  private logger = new Logger('VoiceChannelManager');

  constructor(
    @Inject(forwardRef(() => ChannelsService))
    private channelsService: ChannelsService
  ) {}

  async handleJoinVoiceChannel(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    userVoiceChannels: LRUCache<number, number>,
    voiceChannelMembers: Map<number, Set<VoiceMember>>,
    data: { channelId: number; reconnecting?: boolean },
    client: AuthenticatedSocket
  ) {
    try {
      this.logger.log(
        `[Voice] Join request from ${client.username} (${client.userId}) for channel ${data.channelId} (reconnecting: ${data.reconnecting || false})`
      );

      // Validate input
      if (
        !data.channelId ||
        typeof data.channelId !== 'number' ||
        data.channelId <= 0
      ) {
        this.logger.error(`[Voice] Invalid channel ID: ${data.channelId}`);
        client.emit('error', { message: 'Invalid channel ID' });
        return;
      }

      // Check if user has access to this channel (is member of server)
      try {
        const channel = await this.channelsService.findOne(
          data.channelId,
          client.userId
        );
        if (!channel) {
          this.logger.error(
            `[Voice] Channel ${data.channelId} not found or access denied for user ${client.userId}`
          );
          client.emit('error', {
            message: 'Channel not found or access denied',
          });
          return;
        }
      } catch (error) {
        this.logger.error(
          `[Voice] Authorization check failed for channel ${data.channelId}:`,
          error.message
        );
        client.emit('error', { message: 'Access denied' });
        return;
      }

      // If user is already in another voice channel, leave it first
      const currentVoiceChannel = userVoiceChannels.get(client.userId);
      if (currentVoiceChannel && currentVoiceChannel !== data.channelId) {
        this.logger.log(
          `[Voice] User ${client.username} switching from channel ${currentVoiceChannel} to ${data.channelId}`
        );
        await this.handleLeaveVoiceChannel(
          server,
          userVoiceChannels,
          voiceChannelMembers,
          { channelId: currentVoiceChannel },
          client
        );
      }

      const roomName = `voice-${data.channelId}`;

      // IMPORTANT: Fetch existing sockets BEFORE joining the room
      // This ensures we see users who were already there, not including the joining user
      const socketsInRoom = await server.in(roomName).fetchSockets();

      // Get list of users already in the voice channel
      const trackedMembers = voiceChannelMembers.get(data.channelId);
      const usersInChannel: Array<{ userId: number; username: string }> = [];

      if (trackedMembers) {
        // Add tracked members (excluding the joining user)
        for (const member of trackedMembers) {
          if (member.userId !== client.userId) {
            usersInChannel.push({
              userId: member.userId,
              username: member.username,
            });
          }
        }
      }

      // Also check Socket.IO rooms as a backup and for validation
      this.logger.log(
        `[Voice] Room ${roomName} has ${socketsInRoom.length} sockets, tracked members: ${trackedMembers ? trackedMembers.size : 0}`
      );

      // Ensure all socket users are properly tracked
      for (const socket of socketsInRoom) {
        const authSocket = socket as any as AuthenticatedSocket;
        if (authSocket.userId && authSocket.userId !== client.userId) {
          // Check if this user is already in our tracked list
          const alreadyTracked = usersInChannel.some(
            u => u.userId === authSocket.userId
          );
          if (!alreadyTracked) {
            usersInChannel.push({
              userId: authSocket.userId,
              username: authSocket.username,
            });
            this.logger.log(
              `[Voice] Found untracked user in channel: ${authSocket.username} (${authSocket.userId})`
            );

            // Add to tracked members if missing
            if (!trackedMembers) {
              voiceChannelMembers.set(data.channelId, new Set());
            }
            const members = voiceChannelMembers.get(data.channelId);

            // Double-check that this user isn't already in the Set to prevent duplicates
            const alreadyInSet = Array.from(members).find(
              m => m.userId === authSocket.userId
            );

            if (!alreadyInSet) {
              members.add({
                userId: authSocket.userId,
                username: authSocket.username,
                hasCamera: false,
              });

              // CRITICAL: Also track in userVoiceChannels to maintain consistency
              userVoiceChannels.set(authSocket.userId, data.channelId);
              this.logger.log(
                `[Voice] Added ${authSocket.username} to userVoiceChannels for consistent state tracking`
              );
            } else {
              this.logger.log(
                `[Voice] User ${authSocket.username} (${authSocket.userId}) already in members Set, skipping duplicate add during reconciliation`
              );
            }
          }
        }
      }

      // Now join the room after fetching existing users
      client.join(roomName);
      this.logger.log(
        `[Voice] ${client.username} joined voice channel room: ${roomName}`
      );

      // Track which channel this user is in (for disconnect cleanup)
      userVoiceChannels.set(client.userId, data.channelId);

      // Ensure current user is in voice channel members tracking
      if (!voiceChannelMembers.has(data.channelId)) {
        voiceChannelMembers.set(data.channelId, new Set());
      }
      const members = voiceChannelMembers.get(data.channelId);

      // Check if user is already in the members Set to prevent duplicates
      const existingMember = Array.from(members).find(
        m => m.userId === client.userId
      );

      if (existingMember) {
        this.logger.log(
          `[Voice] User ${client.username} (${client.userId}) already in members Set, skipping duplicate add`
        );
      } else {
        members.add({
          userId: client.userId,
          username: client.username,
          hasCamera: false,
        });
        this.logger.log(
          `[Voice] Added ${client.username} (${client.userId}) to voice channel ${data.channelId} members`
        );
      }

      this.logger.log(
        `[Voice] Sending voice-channel-users to ${client.username} with ${usersInChannel.length} users`
      );

      // Notify the joining user about existing users
      client.emit('voice-channel-users', {
        channelId: data.channelId,
        users: usersInChannel,
      });

      this.logger.log(
        `[Voice] Broadcasting voice-user-joined to room ${roomName} (reconnecting: ${data.reconnecting || false})`
      );

      // Notify other users in the channel about the new user
      client.to(roomName).emit('voice-user-joined', {
        channelId: data.channelId,
        userId: client.userId,
        username: client.username,
        reconnecting: data.reconnecting || false,
      });

      // Broadcast updated member list to all users who can see this channel
      await this.broadcastVoiceChannelMembers(
        server,
        voiceChannelMembers,
        data.channelId
      );

      this.logger.log(
        `[Voice] Successfully completed join for ${client.username}`
      );
    } catch (error) {
      this.logger.error(
        `[Voice] Error joining voice channel: ${error.message}`
      );
      this.logger.error(`[Voice] Error stack: ${error.stack}`);
      client.emit('error', { message: 'Failed to join voice channel' });
    }
  }

  async handleLeaveVoiceChannel(
    server: Server,
    userVoiceChannels: LRUCache<number, number>,
    voiceChannelMembers: Map<number, Set<VoiceMember>>,
    data: { channelId: number },
    client: AuthenticatedSocket
  ) {
    const roomName = `voice-${data.channelId}`;
    client.leave(roomName);
    this.logger.log(
      `${client.username} left voice channel room: ${roomName} (graceful)`
    );

    // Mark this as a graceful leave (intentional disconnect by user)
    client.gracefulLeaving = true;

    // Clean up tracking
    userVoiceChannels.delete(client.userId);

    // Remove from voice channel members tracking
    const members = voiceChannelMembers.get(data.channelId);
    if (members) {
      const userToRemove = Array.from(members).find(
        m => m.userId === client.userId
      );
      if (userToRemove) {
        members.delete(userToRemove);
      }
      if (members.size === 0) {
        voiceChannelMembers.delete(data.channelId);
      }
    }

    // Notify others in the voice channel (with graceful flag)
    client.to(roomName).emit('voice-user-left', {
      channelId: data.channelId,
      userId: client.userId,
      username: client.username,
      graceful: true,
    });

    // Broadcast updated member list to all users who can see this channel
    await this.broadcastVoiceChannelMembers(
      server,
      voiceChannelMembers,
      data.channelId
    );
  }

  async handleEnableCamera(
    server: Server,
    userVoiceChannels: LRUCache<number, number>,
    voiceChannelMembers: Map<number, Set<VoiceMember>>,
    data: { channelId: number },
    client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (
        !data.channelId ||
        typeof data.channelId !== 'number' ||
        data.channelId <= 0
      ) {
        client.emit('error', { message: 'Invalid channel ID' });
        return;
      }

      // Verify user is in this voice channel
      const userChannel = userVoiceChannels.get(client.userId);
      if (userChannel !== data.channelId) {
        this.logger.warn(
          `[Camera] User ${client.username} (${client.userId}) tried to enable camera in channel ${data.channelId} but is not in that voice channel`
        );
        client.emit('error', {
          message: 'You must be in the voice channel to enable camera',
        });
        return;
      }

      // Update member's camera state
      const members = voiceChannelMembers.get(data.channelId);
      if (members) {
        const memberArray = Array.from(members);
        const userMember = memberArray.find(m => m.userId === client.userId);

        if (userMember) {
          // Remove old member object and add updated one
          members.delete(userMember);
          members.add({
            userId: client.userId,
            username: client.username,
            hasCamera: true,
          });

          this.logger.log(
            `[Camera] ${client.username} (${client.userId}) enabled camera in channel ${data.channelId}`
          );

          // Broadcast to all users in the voice channel
          const roomName = `voice-${data.channelId}`;
          server.to(roomName).emit('voice-camera-enabled', {
            channelId: data.channelId,
            userId: client.userId,
            username: client.username,
          });

          // Broadcast updated member list
          await this.broadcastVoiceChannelMembers(
            server,
            voiceChannelMembers,
            data.channelId
          );
        }
      }
    } catch (error) {
      this.logger.error('Error enabling camera:', error.message);
      client.emit('error', { message: 'Failed to enable camera' });
    }
  }

  async handleDisableCamera(
    server: Server,
    userVoiceChannels: LRUCache<number, number>,
    voiceChannelMembers: Map<number, Set<VoiceMember>>,
    data: { channelId: number },
    client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (
        !data.channelId ||
        typeof data.channelId !== 'number' ||
        data.channelId <= 0
      ) {
        client.emit('error', { message: 'Invalid channel ID' });
        return;
      }

      // Verify user is in this voice channel
      const userChannel = userVoiceChannels.get(client.userId);
      if (userChannel !== data.channelId) {
        this.logger.warn(
          `[Camera] User ${client.username} (${client.userId}) tried to disable camera in channel ${data.channelId} but is not in that voice channel`
        );
        return;
      }

      // Update member's camera state
      const members = voiceChannelMembers.get(data.channelId);
      if (members) {
        const memberArray = Array.from(members);
        const userMember = memberArray.find(m => m.userId === client.userId);

        if (userMember) {
          // Remove old member object and add updated one
          members.delete(userMember);
          members.add({
            userId: client.userId,
            username: client.username,
            hasCamera: false,
          });

          this.logger.log(
            `[Camera] ${client.username} (${client.userId}) disabled camera in channel ${data.channelId}`
          );

          // Broadcast to all users in the voice channel
          const roomName = `voice-${data.channelId}`;
          server.to(roomName).emit('voice-camera-disabled', {
            channelId: data.channelId,
            userId: client.userId,
            username: client.username,
          });

          // Broadcast updated member list
          await this.broadcastVoiceChannelMembers(
            server,
            voiceChannelMembers,
            data.channelId
          );
        }
      }
    } catch (error) {
      this.logger.error('Error disabling camera:', error.message);
      client.emit('error', { message: 'Failed to disable camera' });
    }
  }

  async handleGetVoiceChannelMembers(
    server: Server,
    voiceChannelMembers: Map<number, Set<VoiceMember>>,
    data: { serverId?: number; channelId?: number },
    client: AuthenticatedSocket
  ) {
    try {
      // If requesting members for a specific channel
      if (data.channelId) {
        if (typeof data.channelId !== 'number' || data.channelId <= 0) {
          client.emit('error', { message: 'Invalid channel ID' });
          return;
        }

        // Check if user has access to this channel
        try {
          const channel = await this.channelsService.findOne(
            data.channelId,
            client.userId
          );
          if (!channel) {
            client.emit('error', {
              message: 'Channel not found or access denied',
            });
            return;
          }
        } catch (error) {
          this.logger.error(
            `[Voice] Authorization check failed for channel ${data.channelId}:`,
            error.message
          );
          client.emit('error', { message: 'Access denied' });
          return;
        }

        const members = voiceChannelMembers.get(data.channelId);
        const membersList = members ? Array.from(members) : [];

        client.emit('voice-channel-members', {
          channelId: data.channelId,
          members: membersList,
        });
        return;
      }

      client.emit('error', {
        message: 'Either serverId or channelId must be provided',
      });
    } catch (error) {
      this.logger.error('Error getting voice channel members:', error.message);
    }
  }

  async broadcastVoiceChannelMembers(
    server: Server,
    voiceChannelMembers: Map<number, Set<VoiceMember>>,
    channelId: number
  ) {
    try {
      const members = voiceChannelMembers.get(channelId);
      const membersList = members ? Array.from(members) : [];

      // Get the serverId from the channelId
      const channel = await this.channelsService.findOne(channelId);
      if (!channel) {
        this.logger.warn(
          `Channel ${channelId} not found for voice member broadcast`
        );
        return;
      }

      const serverId = channel.server.id;
      const roomName = `server-${serverId}`;

      // Broadcast to users in the server room first
      server.to(roomName).emit('voice-channel-members', {
        channelId,
        members: membersList,
      });

      // Also broadcast to all connected users for backward compatibility
      server.emit('voice-channel-members', {
        channelId,
        members: membersList,
      });

      this.logger.log(
        `[Voice] Broadcasted ${membersList.length} members for channel ${channelId} to server ${serverId} and all clients`
      );
    } catch (error) {
      this.logger.error(
        'Error broadcasting voice channel members:',
        error.message
      );
    }
  }
}
