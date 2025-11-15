import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { ConnectionHandler } from './handlers/connection.handler';
import { ChannelEventsHandler } from './handlers/channel-events.handler';
import { ChannelMessagesHandler } from './handlers/channel-messages.handler';
import { DirectMessagesHandler } from './handlers/direct-messages.handler';
import { PresenceHandler } from './handlers/presence.handler';
import { VoiceChannelManager } from './handlers/voice-channel.manager';
import { VoiceSignalingHandler } from './handlers/voice-signaling.handler';
import { AuthenticatedSocket, VoiceMember } from './types/socket.types';

/**
 * Main WebSocket Gateway (Orchestrator)
 * Delegates to specialized handlers for different domains
 * Reduced from 1,845 lines to ~300 lines
 */
@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:1420',
    ],
    credentials: true,
  },
  namespace: '/chat',
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6,
  allowUpgrades: true,
})
export class ChatGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('ChatGateway');

  // LRU caches to prevent unbounded growth
  private onlineUsers: LRUCache<number, string> = new LRUCache({
    max: 10000,
    ttl: 1000 * 60 * 60 * 24,
    updateAgeOnGet: true,
  });

  private userVoiceChannels: LRUCache<number, number> = new LRUCache({
    max: 10000,
    ttl: 1000 * 60 * 60 * 12,
    updateAgeOnGet: true,
  });

  private voiceChannelMembers: Map<number, Set<VoiceMember>> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private connectionHandler: ConnectionHandler,
    private channelEventsHandler: ChannelEventsHandler,
    private channelMessagesHandler: ChannelMessagesHandler,
    private directMessagesHandler: DirectMessagesHandler,
    private presenceHandler: PresenceHandler,
    private voiceChannelManager: VoiceChannelManager,
    private voiceSignalingHandler: VoiceSignalingHandler
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.cleanupInterval = setInterval(
      () => this.performPeriodicCleanup(),
      5 * 60 * 1000
    );
    this.logger.log('Periodic cleanup interval established (5 minutes)');
  }

  async handleConnection(client: AuthenticatedSocket) {
    await this.connectionHandler.handleConnection(
      this.server,
      this.onlineUsers,
      client
    );
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    await this.connectionHandler.handleDisconnect(
      this.server,
      this.onlineUsers,
      this.userVoiceChannels,
      this.voiceChannelMembers,
      client
    );
  }

  // Server/Channel Room Management
  @SubscribeMessage('join-server')
  async handleJoinServer(
    @MessageBody() data: { serverId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.channelEventsHandler.handleJoinServer(this.server, data, client);
  }

  @SubscribeMessage('leave-server')
  handleLeaveServer(
    @MessageBody() data: { serverId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.channelEventsHandler.handleLeaveServer(data, client);
  }

  @SubscribeMessage('join-channel')
  async handleJoinChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.channelEventsHandler.handleJoinChannel(data, client);
  }

  @SubscribeMessage('leave-channel')
  handleLeaveChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.channelEventsHandler.handleLeaveChannel(data, client);
  }

  // Channel Messages
  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody()
    data: { channelId: number; content: string; replyToId?: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.channelMessagesHandler.handleSendMessage(
      this.server,
      data,
      client
    );
  }

  @SubscribeMessage('edit-message')
  async handleEditMessage(
    @MessageBody() data: { messageId: number; content: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.channelMessagesHandler.handleEditMessage(
      this.server,
      data,
      client
    );
  }

  @SubscribeMessage('delete-message')
  async handleDeleteMessage(
    @MessageBody() data: { messageId: number; channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.channelMessagesHandler.handleDeleteMessage(
      this.server,
      data,
      client
    );
  }

  // Direct Messages
  @SubscribeMessage('send-direct-message')
  async handleDirectMessage(
    @MessageBody()
    data: {
      receiverId: number;
      content: string;
      attachments?: Array<{
        url: string;
        filename: string;
        mimeType: string;
        size: number;
      }>;
    },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.directMessagesHandler.handleSendDirectMessage(
      this.server,
      this.onlineUsers,
      data,
      client
    );
  }

  // Friend System
  @SubscribeMessage('friend-request-sent')
  handleFriendRequestNotification(
    @MessageBody() data: { receiverId: number; senderUsername: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.presenceHandler.handleFriendRequestNotification(
      this.server,
      this.onlineUsers,
      data,
      client
    );
  }

  @SubscribeMessage('friend-request-response')
  handleFriendRequestResponse(
    @MessageBody()
    data: {
      requestId: number;
      senderId: number;
      status: 'accepted' | 'rejected';
    },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.presenceHandler.handleFriendRequestResponse(
      this.server,
      this.onlineUsers,
      data,
      client
    );
  }

  // Presence/Status
  @SubscribeMessage('status-change')
  async handleStatusChange(
    @MessageBody()
    data: { userId: number; status: 'online' | 'idle' | 'dnd' | 'invisible' },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.presenceHandler.handleStatusChange(
      this.server,
      this.onlineUsers,
      data,
      client
    );
  }

  @SubscribeMessage('get-online-friends')
  async handleGetOnlineFriends(@ConnectedSocket() client: AuthenticatedSocket) {
    await this.presenceHandler.handleGetOnlineFriends(this.onlineUsers, client);
  }

  // Ready Handshake
  @SubscribeMessage('ready')
  async handleReady(@ConnectedSocket() client: AuthenticatedSocket) {
    await this.connectionHandler.handleReady(
      this.onlineUsers,
      this.voiceChannelMembers,
      client
    );
  }

  // Voice Channel Management
  @SubscribeMessage('join-voice-channel')
  async handleJoinVoiceChannel(
    @MessageBody() data: { channelId: number; reconnecting?: boolean },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.voiceChannelManager.handleJoinVoiceChannel(
      this.server,
      this.onlineUsers,
      this.userVoiceChannels,
      this.voiceChannelMembers,
      data,
      client
    );
  }

  @SubscribeMessage('leave-voice-channel')
  async handleLeaveVoiceChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.voiceChannelManager.handleLeaveVoiceChannel(
      this.server,
      this.userVoiceChannels,
      this.voiceChannelMembers,
      data,
      client
    );
  }

  // Voice Signaling (WebRTC)
  @SubscribeMessage('voice-offer')
  handleVoiceOffer(
    @MessageBody()
    data: { channelId: number; targetUserId: number; offer: any },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.voiceSignalingHandler.handleVoiceOffer(
      this.server,
      this.onlineUsers,
      data,
      client
    );
  }

  @SubscribeMessage('voice-answer')
  handleVoiceAnswer(
    @MessageBody()
    data: { channelId: number; targetUserId: number; answer: any },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.voiceSignalingHandler.handleVoiceAnswer(
      this.server,
      this.onlineUsers,
      data,
      client
    );
  }

  @SubscribeMessage('voice-ice-candidate')
  handleVoiceIceCandidate(
    @MessageBody()
    data: { channelId: number; targetUserId: number; candidate: any },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.voiceSignalingHandler.handleVoiceIceCandidate(
      this.server,
      this.onlineUsers,
      data,
      client
    );
  }

  @SubscribeMessage('voice-reconnect-request')
  handleVoiceReconnectRequest(
    @MessageBody() data: { channelId: number; targetUserId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.voiceSignalingHandler.handleVoiceReconnectRequest(
      this.server,
      this.onlineUsers,
      this.userVoiceChannels,
      data,
      client
    );
  }

  @SubscribeMessage('get-voice-channel-members')
  async handleGetVoiceChannelMembers(
    @MessageBody() data: { serverId?: number; channelId?: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.voiceChannelManager.handleGetVoiceChannelMembers(
      this.server,
      this.voiceChannelMembers,
      data,
      client
    );
  }

  @SubscribeMessage('voice-speaking')
  async handleVoiceSpeaking(
    @MessageBody() data: { channelId: number; isSpeaking: boolean },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.voiceSignalingHandler.handleVoiceSpeaking(
      this.server,
      this.userVoiceChannels,
      data,
      client
    );
  }

  @SubscribeMessage('voice-user-muted')
  async handleVoiceUserMuted(
    @MessageBody() data: { channelId: number; isMuted: boolean },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.voiceSignalingHandler.handleVoiceUserMuted(
      this.server,
      this.userVoiceChannels,
      data,
      client
    );
  }

  // Camera Controls
  @SubscribeMessage('enable-camera')
  async handleEnableCamera(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.voiceChannelManager.handleEnableCamera(
      this.server,
      this.userVoiceChannels,
      this.voiceChannelMembers,
      data,
      client
    );
  }

  @SubscribeMessage('disable-camera')
  async handleDisableCamera(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    await this.voiceChannelManager.handleDisableCamera(
      this.server,
      this.userVoiceChannels,
      this.voiceChannelMembers,
      data,
      client
    );
  }

  // Screen Share Controls
  @SubscribeMessage('screen-share-enabled')
  async handleScreenShareEnabled(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.voiceSignalingHandler.handleScreenShareEnabled(
      this.server,
      this.userVoiceChannels,
      data,
      client
    );
    await this.voiceChannelManager.handleScreenShareEnabled(
      this.server,
      this.userVoiceChannels,
      this.voiceChannelMembers,
      data,
      client
    );
  }

  @SubscribeMessage('screen-share-disabled')
  async handleScreenShareDisabled(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    this.voiceSignalingHandler.handleScreenShareDisabled(
      this.server,
      this.userVoiceChannels,
      data,
      client
    );
    await this.voiceChannelManager.handleScreenShareDisabled(
      this.server,
      this.userVoiceChannels,
      this.voiceChannelMembers,
      data,
      client
    );
  }

  @SubscribeMessage('screen-share-focused')
  async handleScreenShareFocused(
    @MessageBody() data: { userId: number; channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      // Verify the user being focused on is in the same channel
      const userVoiceChannel = this.userVoiceChannels.get(data.userId);
      const clientVoiceChannel = this.userVoiceChannels.get(client.userId);

      if (
        userVoiceChannel &&
        clientVoiceChannel &&
        userVoiceChannel === data.channelId &&
        clientVoiceChannel === data.channelId &&
        data.userId !== client.userId
      ) {
        // Notify ONLY the screen sharer (data.userId) that someone focused on their stream
        // Find the socket for the screen sharer
        const socketsInRoom = await this.server
          .in(`voice-${data.channelId}`)
          .fetchSockets();
        const screenSharerSocket = socketsInRoom.find(
          socket =>
            (socket as any as AuthenticatedSocket).userId === data.userId
        );

        if (screenSharerSocket) {
          screenSharerSocket.emit('screen-share-focused-notification', {
            userId: client.userId,
            username: client.username,
          });
          this.logger.log(
            `[ScreenShare] User ${client.username} (${client.userId}) focused on ${data.userId}'s screen share in channel ${data.channelId}`
          );
        }
      }
    } catch (error) {
      this.logger.error('Error handling screen share focused:', error.message);
    }
  }

  // Public methods for external controllers
  public notifyChannelCreated(serverId: number, channel: any) {
    this.channelEventsHandler.notifyChannelCreated(
      this.server,
      serverId,
      channel
    );
  }

  public notifyChannelUpdated(serverId: number, channel: any) {
    this.channelEventsHandler.notifyChannelUpdated(
      this.server,
      serverId,
      channel
    );
  }

  public notifyChannelDeleted(serverId: number, channelId: number) {
    this.channelEventsHandler.notifyChannelDeleted(
      this.server,
      serverId,
      channelId
    );
  }

  public emitDirectMessage(userId: number, messageDto: any) {
    this.directMessagesHandler.emitDirectMessage(
      this.server,
      this.onlineUsers,
      userId,
      messageDto
    );
  }

  public emitDMThreadCreated(userId: number) {
    this.directMessagesHandler.emitDMThreadCreated(
      this.server,
      this.onlineUsers,
      userId
    );
  }

  // Periodic cleanup
  private async performPeriodicCleanup() {
    // Only skip cleanup if server is completely uninitialized
    if (!this.server) {
      this.logger.warn(
        '[Cleanup] WebSocket server not initialized yet, skipping cleanup'
      );
      return;
    }

    this.logger.log('[Cleanup] Starting periodic cleanup of stale connections');

    let cleanedUsersCount = 0;
    let cleanedVoiceChannelsCount = 0;

    // Cleanup onlineUsers
    for (const [userId, socketId] of this.onlineUsers.entries()) {
      const socket = this.server.sockets?.sockets?.get(socketId);
      if (!socket || !socket.connected) {
        this.logger.warn(
          `[Cleanup] Removing stale user entry for userId ${userId} (socket ${socketId} no longer connected)`
        );
        this.onlineUsers.delete(userId);
        cleanedUsersCount++;
      }
    }

    // Cleanup userVoiceChannels - be more careful here
    // Check both cache and actual socket existence to avoid removing still-connected users
    for (const [userId, channelId] of this.userVoiceChannels.entries()) {
      const socketId = this.onlineUsers.get(userId);
      let isUserStillConnected = false;
      let connectedSocket: AuthenticatedSocket | null = null;

      // First check if we have them in onlineUsers cache
      if (socketId) {
        const socket = this.server.sockets?.sockets?.get(socketId);
        if (socket && socket.connected) {
          isUserStillConnected = true;
          connectedSocket = socket as any as AuthenticatedSocket;
        }
      }

      // If not in cache, check if they have ANY connected socket (more expensive but thorough)
      if (!isUserStillConnected && this.server.sockets?.sockets) {
        for (const socket of this.server.sockets.sockets.values()) {
          const authSocket = socket as any as AuthenticatedSocket;
          if (authSocket.userId === userId && socket.connected) {
            // Found a connected socket for this user, re-add to onlineUsers cache
            this.onlineUsers.set(userId, socket.id);
            isUserStillConnected = true;
            connectedSocket = authSocket;
            this.logger.log(
              `[Cleanup] Re-added user ${userId} to onlineUsers cache during cleanup`
            );
            break;
          }
        }
      }

      // Also check if user is actually in the voice channel room
      // This prevents removing users who are connected but not in cache
      if (isUserStillConnected && connectedSocket) {
        const roomName = `voice-${channelId}`;
        const room = this.server.sockets?.adapter?.rooms?.get(roomName);
        if (room && room.has(connectedSocket.id)) {
          // User is connected and in the room, keep them
          continue;
        } else {
          // User is connected but not in the room - they left gracefully
          // Remove them from tracking
          this.logger.warn(
            `[Cleanup] User ${userId} is connected but not in voice room ${channelId}, removing from tracking`
          );
          this.userVoiceChannels.delete(userId);
          const members = this.voiceChannelMembers.get(channelId);
          if (members) {
            const userToRemove = Array.from(members).find(
              m => m.userId === userId
            );
            if (userToRemove) {
              members.delete(userToRemove);
              if (members.size === 0) {
                this.voiceChannelMembers.delete(channelId);
                cleanedVoiceChannelsCount++;
              }
            }
          }
          continue;
        }
      }

      if (!isUserStillConnected) {
        this.logger.warn(
          `[Cleanup] Removing stale voice channel entry for userId ${userId} (not connected)`
        );
        this.userVoiceChannels.delete(userId);

        const members = this.voiceChannelMembers.get(channelId);
        if (members) {
          const userToRemove = Array.from(members).find(
            m => m.userId === userId
          );
          if (userToRemove) {
            members.delete(userToRemove);
            if (members.size === 0) {
              this.voiceChannelMembers.delete(channelId);
              cleanedVoiceChannelsCount++;
            }
          }
        }
      }
    }

    // Cleanup voiceChannelMembers - also check actual socket existence
    for (const [channelId, members] of this.voiceChannelMembers.entries()) {
      if (members.size === 0) {
        this.voiceChannelMembers.delete(channelId);
        cleanedVoiceChannelsCount++;
        continue;
      }

      const membersToRemove: typeof members extends Set<infer T> ? T[] : never =
        [];
      for (const member of members) {
        const socketId = this.onlineUsers.get(member.userId);
        let isUserStillConnected = false;

        // Check if user has a connected socket
        if (socketId) {
          const socket = this.server.sockets?.sockets?.get(socketId);
          if (socket && socket.connected) {
            isUserStillConnected = true;
          }
        }

        // If not in cache, check all sockets
        if (!isUserStillConnected && this.server.sockets?.sockets) {
          for (const socket of this.server.sockets.sockets.values()) {
            const authSocket = socket as any as AuthenticatedSocket;
            if (authSocket.userId === member.userId && socket.connected) {
              // Re-add to onlineUsers cache
              this.onlineUsers.set(member.userId, socket.id);
              isUserStillConnected = true;
              break;
            }
          }
        }

        if (!isUserStillConnected) {
          membersToRemove.push(member);
        }
      }

      if (membersToRemove.length > 0) {
        membersToRemove.forEach(member => {
          members.delete(member);
          this.logger.warn(
            `[Cleanup] Removed stale voice member ${member.username} from channel ${channelId}`
          );
        });

        if (members.size === 0) {
          this.voiceChannelMembers.delete(channelId);
          cleanedVoiceChannelsCount++;
        }
      }
    }

    if (cleanedUsersCount > 0 || cleanedVoiceChannelsCount > 0) {
      this.logger.log(
        `[Cleanup] Cleanup completed: ${cleanedUsersCount} stale users, ${cleanedVoiceChannelsCount} empty voice channels removed`
      );
    } else {
      this.logger.log(
        '[Cleanup] Periodic cleanup completed - no stale entries found'
      );
    }

    this.logger.log(
      `[Cleanup] Current state: ${this.onlineUsers.size} online users, ` +
        `${this.userVoiceChannels.size} users in voice, ` +
        `${this.voiceChannelMembers.size} active voice channels`
    );
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.logger.log('[Cleanup] Stopped periodic cleanup interval');
    }
  }
}
