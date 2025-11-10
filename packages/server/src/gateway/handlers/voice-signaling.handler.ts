import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { LRUCache } from 'lru-cache';
import { AuthenticatedSocket } from '../types/socket.types';

/**
 * Handles WebRTC voice signaling (offer/answer/ICE candidates)
 * Manages peer-to-peer connection establishment for voice chat
 */
@Injectable()
export class VoiceSignalingHandler {
  private logger = new Logger('VoiceSignalingHandler');

  handleVoiceOffer(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    data: { channelId: number; targetUserId: number; offer: any },
    client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (
        !data.channelId ||
        !data.targetUserId ||
        !data.offer ||
        typeof data.channelId !== 'number' ||
        typeof data.targetUserId !== 'number'
      ) {
        client.emit('error', { message: 'Invalid voice offer data' });
        return;
      }

      const targetSocketId = onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        server.to(targetSocketId).emit('voice-offer', {
          channelId: data.channelId,
          fromUserId: client.userId,
          fromUsername: client.username,
          offer: data.offer,
        });
        this.logger.log(
          `Voice offer from ${client.username} to user ${data.targetUserId}`
        );
      }
    } catch (error) {
      this.logger.error('Error handling voice offer:', error.message);
      client.emit('error', { message: 'Failed to send voice offer' });
    }
  }

  handleVoiceAnswer(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    data: { channelId: number; targetUserId: number; answer: any },
    client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (
        !data.channelId ||
        !data.targetUserId ||
        !data.answer ||
        typeof data.channelId !== 'number' ||
        typeof data.targetUserId !== 'number'
      ) {
        client.emit('error', { message: 'Invalid voice answer data' });
        return;
      }

      const targetSocketId = onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        server.to(targetSocketId).emit('voice-answer', {
          channelId: data.channelId,
          fromUserId: client.userId,
          fromUsername: client.username,
          answer: data.answer,
        });
        this.logger.log(
          `Voice answer from ${client.username} to user ${data.targetUserId}`
        );
      }
    } catch (error) {
      this.logger.error('Error handling voice answer:', error.message);
      client.emit('error', { message: 'Failed to send voice answer' });
    }
  }

  handleVoiceIceCandidate(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    data: { channelId: number; targetUserId: number; candidate: any },
    client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (
        !data.channelId ||
        !data.targetUserId ||
        !data.candidate ||
        typeof data.channelId !== 'number' ||
        typeof data.targetUserId !== 'number'
      ) {
        client.emit('error', { message: 'Invalid ICE candidate data' });
        return;
      }

      const targetSocketId = onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        server.to(targetSocketId).emit('voice-ice-candidate', {
          channelId: data.channelId,
          fromUserId: client.userId,
          candidate: data.candidate,
        });
      }
    } catch (error) {
      this.logger.error('Error handling ICE candidate:', error.message);
    }
  }

  handleVoiceReconnectRequest(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    userVoiceChannels: LRUCache<number, number>,
    data: { channelId: number; targetUserId: number },
    client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (
        !data.channelId ||
        !data.targetUserId ||
        typeof data.channelId !== 'number' ||
        typeof data.targetUserId !== 'number' ||
        data.channelId <= 0 ||
        data.targetUserId <= 0
      ) {
        client.emit('error', { message: 'Invalid reconnection request data' });
        return;
      }

      // Prevent self-reconnection requests
      if (data.targetUserId === client.userId) {
        this.logger.warn(
          `[Voice] Ignoring self-reconnection request from ${client.username} (${client.userId})`
        );
        return;
      }

      // Verify both users are still in the same voice channel
      const clientChannel = userVoiceChannels.get(client.userId);
      const targetChannel = userVoiceChannels.get(data.targetUserId);

      if (
        clientChannel !== data.channelId ||
        targetChannel !== data.channelId
      ) {
        this.logger.warn(
          `[Voice] Ignoring reconnection request from ${client.username} to user ${data.targetUserId} - not in same channel`
        );
        return;
      }

      const targetSocketId = onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        server.to(targetSocketId).emit('voice-reconnect-request', {
          channelId: data.channelId,
          targetUserId: data.targetUserId,
        });
        this.logger.log(
          `[Voice] Reconnection request from ${client.username} to user ${data.targetUserId}`
        );
      }
    } catch (error) {
      this.logger.error(
        'Error handling voice reconnection request:',
        error.message
      );
      client.emit('error', { message: 'Failed to send reconnection request' });
    }
  }

  handleVoiceSpeaking(
    server: Server,
    userVoiceChannels: LRUCache<number, number>,
    data: { channelId: number; isSpeaking: boolean },
    client: AuthenticatedSocket
  ) {
    try {
      if (
        !data.channelId ||
        typeof data.channelId !== 'number' ||
        data.channelId <= 0 ||
        typeof data.isSpeaking !== 'boolean'
      ) {
        return;
      }

      // First check if we have server-side tracking of this user in a voice channel
      const userVoiceChannel = userVoiceChannels.get(client.userId);

      if (userVoiceChannel === data.channelId) {
        // User is properly tracked in this channel, proceed normally
        const roomName = `voice-${data.channelId}`;
        client.to(roomName).emit('voice-user-speaking', {
          channelId: data.channelId,
          userId: client.userId,
          username: client.username,
          isSpeaking: data.isSpeaking,
        });
        return;
      }

      // User is not properly tracked in any voice channel, deny the speaking event
      // Users must explicitly join voice channels to participate
      this.logger.warn(
        `[Voice] User ${client.username} (${client.userId}) attempted to speak in channel ${data.channelId} but is not properly joined to any voice channel`
      );
    } catch (error) {
      this.logger.error('Error handling voice speaking status:', error.message);
    }
  }

  handleVoiceUserMuted(
    server: Server,
    userVoiceChannels: LRUCache<number, number>,
    data: { channelId: number; isMuted: boolean },
    client: AuthenticatedSocket
  ) {
    try {
      if (
        !data.channelId ||
        typeof data.channelId !== 'number' ||
        data.channelId <= 0 ||
        typeof data.isMuted !== 'boolean'
      ) {
        return;
      }

      // Check if user is in the voice channel
      const userVoiceChannel = userVoiceChannels.get(client.userId);

      if (userVoiceChannel === data.channelId) {
        // Broadcast mute status to other users in the channel
        const roomName = `voice-${data.channelId}`;
        client.to(roomName).emit('voice-user-muted', {
          channelId: data.channelId,
          userId: client.userId,
          username: client.username,
          isMuted: data.isMuted,
        });
        return;
      }

      this.logger.warn(
        `[Voice] User ${client.username} (${client.userId}) attempted to update mute status in channel ${data.channelId} but is not joined`
      );
    } catch (error) {
      this.logger.error('Error handling voice mute status:', error.message);
    }
  }

  handleScreenShareEnabled(
    server: Server,
    userVoiceChannels: LRUCache<number, number>,
    data: { channelId: number },
    client: AuthenticatedSocket
  ) {
    try {
      if (
        !data.channelId ||
        typeof data.channelId !== 'number' ||
        data.channelId <= 0
      ) {
        return;
      }

      // Check if user is in the voice channel
      const userVoiceChannel = userVoiceChannels.get(client.userId);

      if (userVoiceChannel === data.channelId) {
        // Broadcast screen share status to other users in the channel
        const roomName = `voice-${data.channelId}`;
        client.to(roomName).emit('voice-screen-share-enabled', {
          channelId: data.channelId,
          userId: client.userId,
          username: client.username,
        });
        this.logger.log(
          `[Voice] User ${client.username} (${client.userId}) started screen sharing in channel ${data.channelId}`
        );
        return;
      }

      this.logger.warn(
        `[Voice] User ${client.username} (${client.userId}) attempted to start screen sharing in channel ${data.channelId} but is not joined`
      );
    } catch (error) {
      this.logger.error('Error handling screen share enabled:', error.message);
    }
  }

  handleScreenShareDisabled(
    server: Server,
    userVoiceChannels: LRUCache<number, number>,
    data: { channelId: number },
    client: AuthenticatedSocket
  ) {
    try {
      if (
        !data.channelId ||
        typeof data.channelId !== 'number' ||
        data.channelId <= 0
      ) {
        return;
      }

      // Check if user is in the voice channel
      const userVoiceChannel = userVoiceChannels.get(client.userId);

      if (userVoiceChannel === data.channelId) {
        // Broadcast screen share status to other users in the channel
        const roomName = `voice-${data.channelId}`;
        client.to(roomName).emit('voice-screen-share-disabled', {
          channelId: data.channelId,
          userId: client.userId,
          username: client.username,
        });
        this.logger.log(
          `[Voice] User ${client.username} (${client.userId}) stopped screen sharing in channel ${data.channelId}`
        );
        return;
      }

      this.logger.warn(
        `[Voice] User ${client.username} (${client.userId}) attempted to stop screen sharing in channel ${data.channelId} but is not joined`
      );
    } catch (error) {
      this.logger.error('Error handling screen share disabled:', error.message);
    }
  }
}
