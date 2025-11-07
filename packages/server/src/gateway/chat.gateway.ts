import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { DirectMessagesService } from '../direct-messages/direct-messages.service';
import { ChannelsService } from '../channels/channels.service';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

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
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');
  private onlineUsers: Map<number, string> = new Map(); // userId -> socketId
  private userVoiceChannels: Map<number, number> = new Map(); // userId -> channelId (for disconnect cleanup)
  private voiceChannelMembers: Map<
    number,
    Set<{ userId: number; username: string }>
  > = new Map(); // channelId -> Set of users

  constructor(
    private jwtService: JwtService,
    private messagesService: MessagesService,
    private usersService: UsersService,
    private directMessagesService: DirectMessagesService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChannelsService))
    private channelsService: ChannelsService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
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

      // Track user as online
      this.onlineUsers.set(client.userId, client.id);

      this.logger.log(
        `Client connected: ${client.username} (${client.userId})${clientVersion ? ` [v${clientVersion}]` : ''}`
      );

      // Notify friends that user came online
      await this.notifyFriendsPresence(client.userId, 'online');
    } catch (error) {
      this.logger.error('Authentication failed:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      // Check if user was in a voice channel and notify others
      const voiceChannelId = this.userVoiceChannels.get(client.userId);
      if (voiceChannelId) {
        this.logger.log(
          `[Voice] User ${client.username} disconnected while in voice channel ${voiceChannelId}`
        );

        // Clear voice channel tracking immediately on disconnect
        // This prevents stale state from persisting across reconnections
        this.userVoiceChannels.delete(client.userId);

        // Remove from voice channel members tracking
        const members = this.voiceChannelMembers.get(voiceChannelId);
        if (members) {
          const userToRemove = Array.from(members).find(
            m => m.userId === client.userId
          );
          if (userToRemove) {
            members.delete(userToRemove);
          }
          if (members.size === 0) {
            this.voiceChannelMembers.delete(voiceChannelId);
          }
        }

        // Notify others in the voice channel that this user left
        const roomName = `voice-${voiceChannelId}`;
        this.server.to(roomName).emit('voice-user-left', {
          channelId: voiceChannelId,
          userId: client.userId,
          username: client.username,
        });

        // Broadcast updated member list
        await this.broadcastVoiceChannelMembers(voiceChannelId);

        this.logger.log(
          `[Voice] Notified voice channel ${voiceChannelId} that ${client.username} disconnected`
        );
      }

      // Remove user from online tracking (they'll be re-added on reconnect)
      this.onlineUsers.delete(client.userId);

      if (client.username) {
        this.logger.log(
          `Client disconnected: ${client.username} (${client.userId})`
        );
      }

      // Notify friends that user went offline
      await this.notifyFriendsPresence(client.userId, 'offline');
    }
  }

  @SubscribeMessage('join-server')
  async handleJoinServer(
    @MessageBody() data: { serverId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    // Validate input
    if (
      !data.serverId ||
      typeof data.serverId !== 'number' ||
      data.serverId <= 0
    ) {
      client.emit('error', { message: 'Invalid server ID' });
      return;
    }

    // Verify user is a member of the server
    try {
      const server = await this.usersService.findOne(client.userId);
      const isMember = server.servers?.some(s => s.id === data.serverId);

      if (!isMember) {
        client.emit('error', {
          message: 'You are not a member of this server',
        });
        return;
      }

      const roomName = `server-${data.serverId}`;
      client.join(roomName);
      this.logger.log(`${client.username} joined server room: ${roomName}`);

      // Notify others in the server
      client.to(roomName).emit('user-joined', {
        serverId: data.serverId,
        userId: client.userId,
        username: client.username,
      });
    } catch (error) {
      this.logger.error('Error joining server:', error.message);
      client.emit('error', { message: 'Failed to join server' });
    }
  }

  @SubscribeMessage('leave-server')
  handleLeaveServer(
    @MessageBody() data: { serverId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const roomName = `server-${data.serverId}`;
    client.leave(roomName);
    this.logger.log(`${client.username} left server room: ${roomName}`);

    // Notify others in the server
    client.to(roomName).emit('user-left', {
      serverId: data.serverId,
      userId: client.userId,
      username: client.username,
    });
  }

  @SubscribeMessage('join-channel')
  async handleJoinChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    // Validate input
    if (
      !data.channelId ||
      typeof data.channelId !== 'number' ||
      data.channelId <= 0
    ) {
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
        client.emit('error', { message: 'Channel not found or access denied' });
        return;
      }
    } catch (error) {
      this.logger.error(
        `Channel join authorization failed for channel ${data.channelId}:`,
        error.message
      );
      client.emit('error', { message: 'Access denied' });
      return;
    }

    const roomName = `channel-${data.channelId}`;
    client.join(roomName);
    this.logger.log(`${client.username} joined channel room: ${roomName}`);
  }

  @SubscribeMessage('leave-channel')
  handleLeaveChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const roomName = `channel-${data.channelId}`;
    client.leave(roomName);
    this.logger.log(`${client.username} left channel room: ${roomName}`);
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody()
    data: { channelId: number; content: string; replyToId?: number },
    @ConnectedSocket() client: AuthenticatedSocket
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

      if (!data.content || typeof data.content !== 'string') {
        client.emit('error', { message: 'Invalid message content' });
        return;
      }

      const trimmedContent = data.content.trim();
      if (trimmedContent.length === 0) {
        client.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      if (trimmedContent.length > 2000) {
        client.emit('error', {
          message: 'Message too long (max 2000 characters)',
        });
        return;
      }

      // Validate replyToId if provided
      if (data.replyToId !== undefined && data.replyToId !== null) {
        if (typeof data.replyToId !== 'number' || data.replyToId <= 0) {
          client.emit('error', { message: 'Invalid reply to ID' });
          return;
        }
      }

      // Save message to database (includes authorization check)
      const message = await this.messagesService.create(
        {
          content: trimmedContent,
          channelId: data.channelId,
          replyToId: data.replyToId,
        },
        client.userId
      );

      const roomName = `channel-${data.channelId}`;

      // Emit to all clients in the channel room (including sender)
      this.server.to(roomName).emit('message', {
        id: message.id,
        content: message.content,
        userId: message.user.id,
        username: message.user.username,
        channelId: message.channel.id,
        createdAt: message.createdAt,
        isEdited: false,
        editedAt: null,
        replyTo: message.replyTo
          ? {
              id: message.replyTo.id,
              content: message.replyTo.content,
              user: message.replyTo.user,
            }
          : null,
      });
    } catch (error) {
      this.logger.error('Error sending message:', error.message);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('edit-message')
  async handleEditMessage(
    @MessageBody() data: { messageId: number; content: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (
        !data.messageId ||
        typeof data.messageId !== 'number' ||
        data.messageId <= 0
      ) {
        client.emit('error', { message: 'Invalid message ID' });
        return;
      }

      if (!data.content || typeof data.content !== 'string') {
        client.emit('error', { message: 'Invalid message content' });
        return;
      }

      const trimmedContent = data.content.trim();
      if (trimmedContent.length === 0) {
        client.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      if (trimmedContent.length > 2000) {
        client.emit('error', {
          message: 'Message too long (max 2000 characters)',
        });
        return;
      }

      const message = await this.messagesService.update(
        data.messageId,
        trimmedContent,
        client.userId
      );

      const roomName = `channel-${message.channel.id}`;

      this.server.to(roomName).emit('message-edited', {
        id: message.id,
        content: message.content,
        userId: message.user.id,
        username: message.user.username,
        channelId: message.channel.id,
        createdAt: message.createdAt,
        isEdited: true,
        editedAt: message.editedAt?.toISOString() || new Date().toISOString(),
        replyTo: message.replyTo
          ? {
              id: message.replyTo.id,
              content: message.replyTo.content,
              user: message.replyTo.user,
            }
          : null,
      });
    } catch (error) {
      this.logger.error('Error editing message:', error.message);
      client.emit('error', { message: 'Failed to edit message' });
    }
  }

  @SubscribeMessage('delete-message')
  async handleDeleteMessage(
    @MessageBody() data: { messageId: number; channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (
        !data.messageId ||
        typeof data.messageId !== 'number' ||
        data.messageId <= 0
      ) {
        client.emit('error', { message: 'Invalid message ID' });
        return;
      }

      if (
        !data.channelId ||
        typeof data.channelId !== 'number' ||
        data.channelId <= 0
      ) {
        client.emit('error', { message: 'Invalid channel ID' });
        return;
      }

      await this.messagesService.remove(data.messageId, client.userId);

      const roomName = `channel-${data.channelId}`;

      this.server.to(roomName).emit('message-deleted', {
        messageId: data.messageId,
        channelId: data.channelId,
      });
    } catch (error) {
      this.logger.error('Error deleting message:', error.message);
      client.emit('error', { message: 'Failed to delete message' });
    }
  }

  @SubscribeMessage('send-direct-message')
  async handleDirectMessage(
    @MessageBody() data: { receiverId: number; content: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (
        !data.receiverId ||
        typeof data.receiverId !== 'number' ||
        data.receiverId <= 0
      ) {
        client.emit('error', { message: 'Invalid receiver ID' });
        return;
      }

      if (!data.content || typeof data.content !== 'string') {
        client.emit('error', { message: 'Invalid message content' });
        return;
      }

      const trimmedContent = data.content.trim();
      if (trimmedContent.length === 0) {
        client.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      if (trimmedContent.length > 2000) {
        client.emit('error', {
          message: 'Message too long (max 2000 characters)',
        });
        return;
      }

      // Use DirectMessagesService instead of MessagesService
      const directMessage = await this.directMessagesService.create(
        {
          receiverId: data.receiverId,
          content: trimmedContent,
        },
        client.userId
      );

      const receiverSocketId = this.onlineUsers.get(data.receiverId);
      const senderSocketId = this.onlineUsers.get(client.userId);

      // Send the full message object to both sender and receiver
      const messageData = {
        id: directMessage.id,
        content: directMessage.content,
        senderId: directMessage.senderId,
        receiverId: directMessage.receiverId,
        createdAt: directMessage.createdAt,
        isEdited: directMessage.isEdited,
        editedAt: directMessage.editedAt,
        isRead: false, // New messages are unread
        sender: {
          id: directMessage.sender.id,
          username: directMessage.sender.username,
        },
        receiver: {
          id: directMessage.receiver.id,
          username: directMessage.receiver.username,
        },
      };

      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('direct-message', messageData);
      }

      if (senderSocketId) {
        this.server.to(senderSocketId).emit('direct-message', messageData);
      }
    } catch (error) {
      this.logger.error('Error sending direct message:', error.message);
      client.emit('error', { message: 'Failed to send direct message' });
    }
  }

  @SubscribeMessage('friend-request-sent')
  handleFriendRequestNotification(
    @MessageBody() data: { receiverId: number; senderUsername: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const receiverSocketId = this.onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('friend-request-received', {
        senderId: client.userId,
        senderUsername: data.senderUsername,
      });
    }
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
    const senderSocketId = this.onlineUsers.get(data.senderId);
    if (senderSocketId) {
      this.server.to(senderSocketId).emit('friend-request-responded', {
        requestId: data.requestId,
        responderId: client.userId,
        responderUsername: client.username,
        status: data.status,
      });
    }
  }

  @SubscribeMessage('status-change')
  async handleStatusChange(
    @MessageBody()
    data: { userId: number; status: 'online' | 'idle' | 'dnd' | 'invisible' },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      // Validate input
      if (!data.userId || !data.status) {
        client.emit('error', { message: 'Invalid status data' });
        return;
      }

      // Verify the user can only change their own status
      if (data.userId !== client.userId) {
        client.emit('error', {
          message: "Cannot change another user's status",
        });
        return;
      }

      // Update status in database
      await this.usersService.updateStatus(data.userId, data.status);

      // Notify friends about status change (but not if user is invisible)
      if (data.status !== 'invisible') {
        await this.notifyFriendsPresence(client.userId, data.status);
      }

      // For invisible status, notify friends as offline
      if (data.status === 'invisible') {
        await this.notifyFriendsPresence(client.userId, 'offline');
      }

      // Broadcast status update to all connected clients (except for invisible users)
      if (data.status !== 'invisible') {
        this.server.emit('status-update', {
          userId: data.userId,
          status: data.status,
        });
      }
    } catch (error) {
      this.logger.error('Error updating status:', error.message);
      client.emit('error', { message: 'Failed to update status' });
    }
  }

  private async notifyFriendsPresence(
    userId: number,
    status: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline'
  ) {
    try {
      // Get user's friends
      const friends = await this.usersService.getFriends(userId);

      // Notify each friend if they're online
      // Map status for friends: invisible users appear offline to friends
      const friendStatus = status === 'invisible' ? 'offline' : status;

      for (const friend of friends) {
        const friendSocketId = this.onlineUsers.get(friend.id);
        if (friendSocketId) {
          this.server.to(friendSocketId).emit('friend-presence', {
            userId,
            username: friend.username, // Note: we might need to get the actual username
            status: friendStatus,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error notifying friends presence:', error.message);
    }
  }

  public notifyChannelCreated(serverId: number, channel: any) {
    try {
      const serverRoom = `server-${serverId}`;
      this.server.to(serverRoom).emit('channel-created', {
        serverId,
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          serverId: channel.serverId,
        },
      });
      this.logger.log(
        `[Channel] Notified server ${serverId} about new channel: ${channel.name} (${channel.type})`
      );
    } catch (error) {
      this.logger.error('Error notifying channel creation:', error.message);
    }
  }

  public notifyChannelUpdated(serverId: number, channel: any) {
    try {
      const serverRoom = `server-${serverId}`;
      this.server.to(serverRoom).emit('channel-updated', {
        serverId,
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          serverId: channel.serverId,
        },
      });
      this.logger.log(
        `[Channel] Notified server ${serverId} about updated channel: ${channel.name} (${channel.type})`
      );
    } catch (error) {
      this.logger.error('Error notifying channel update:', error.message);
    }
  }

  public notifyChannelDeleted(serverId: number, channelId: number) {
    try {
      const serverRoom = `server-${serverId}`;
      this.server.to(serverRoom).emit('channel-deleted', {
        serverId,
        channelId,
      });
      this.logger.log(
        `[Channel] Notified server ${serverId} about deleted channel: ${channelId}`
      );
    } catch (error) {
      this.logger.error('Error notifying channel deletion:', error.message);
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

  @SubscribeMessage('get-online-friends')
  async handleGetOnlineFriends(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const friends = await this.usersService.getFriends(client.userId);
      const onlineFriends = friends.filter(friend =>
        this.onlineUsers.has(friend.id)
      );

      client.emit('online-friends', onlineFriends);
    } catch (error) {
      this.logger.error('Error getting online friends:', error.message);
      client.emit('error', { message: 'Failed to get online friends' });
    }
  }

  // WebRTC Voice Chat Signaling

  @SubscribeMessage('join-voice-channel')
  async handleJoinVoiceChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      this.logger.log(
        `[Voice] Join request from ${client.username} (${client.userId}) for channel ${data.channelId}`
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
      const currentVoiceChannel = this.userVoiceChannels.get(client.userId);
      if (currentVoiceChannel && currentVoiceChannel !== data.channelId) {
        this.logger.log(
          `[Voice] User ${client.username} switching from channel ${currentVoiceChannel} to ${data.channelId}`
        );
        this.handleLeaveVoiceChannel(
          { channelId: currentVoiceChannel },
          client
        );
      }

      const roomName = `voice-${data.channelId}`;
      client.join(roomName);
      this.logger.log(
        `[Voice] ${client.username} joined voice channel room: ${roomName}`
      );

      // Track which channel this user is in (for disconnect cleanup)
      this.userVoiceChannels.set(client.userId, data.channelId);

      // Get list of users already in the voice channel
      // Use our tracked members first, then cross-reference with Socket.IO rooms
      const trackedMembers = this.voiceChannelMembers.get(data.channelId);
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
      const socketsInRoom = await this.server.in(roomName).fetchSockets();
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
              this.voiceChannelMembers.set(data.channelId, new Set());
            }
            const members = this.voiceChannelMembers.get(data.channelId);
            members.add({
              userId: authSocket.userId,
              username: authSocket.username,
            });
          }
        }
      }

      // Ensure current user is in voice channel members tracking
      if (!this.voiceChannelMembers.has(data.channelId)) {
        this.voiceChannelMembers.set(data.channelId, new Set());
      }
      const members = this.voiceChannelMembers.get(data.channelId);
      members.add({ userId: client.userId, username: client.username });

      this.logger.log(
        `[Voice] Sending voice-channel-users to ${client.username} with ${usersInChannel.length} users`
      );

      // Notify the joining user about existing users
      client.emit('voice-channel-users', {
        channelId: data.channelId,
        users: usersInChannel,
      });

      this.logger.log(
        `[Voice] Broadcasting voice-user-joined to room ${roomName}`
      );

      // Notify other users in the channel about the new user
      client.to(roomName).emit('voice-user-joined', {
        channelId: data.channelId,
        userId: client.userId,
        username: client.username,
      });

      // Broadcast updated member list to all users who can see this channel
      await this.broadcastVoiceChannelMembers(data.channelId);

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

  @SubscribeMessage('leave-voice-channel')
  async handleLeaveVoiceChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const roomName = `voice-${data.channelId}`;
    client.leave(roomName);
    this.logger.log(`${client.username} left voice channel room: ${roomName}`);

    // Clean up tracking
    this.userVoiceChannels.delete(client.userId);

    // Remove from voice channel members tracking
    const members = this.voiceChannelMembers.get(data.channelId);
    if (members) {
      const userToRemove = Array.from(members).find(
        m => m.userId === client.userId
      );
      if (userToRemove) {
        members.delete(userToRemove);
      }
      if (members.size === 0) {
        this.voiceChannelMembers.delete(data.channelId);
      }
    }

    // Notify others in the voice channel
    client.to(roomName).emit('voice-user-left', {
      channelId: data.channelId,
      userId: client.userId,
      username: client.username,
    });

    // Broadcast updated member list to all users who can see this channel
    await this.broadcastVoiceChannelMembers(data.channelId);
  }

  @SubscribeMessage('voice-offer')
  handleVoiceOffer(
    @MessageBody()
    data: { channelId: number; targetUserId: number; offer: any },
    @ConnectedSocket() client: AuthenticatedSocket
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

      const targetSocketId = this.onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        this.server.to(targetSocketId).emit('voice-offer', {
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

  @SubscribeMessage('voice-answer')
  handleVoiceAnswer(
    @MessageBody()
    data: { channelId: number; targetUserId: number; answer: any },
    @ConnectedSocket() client: AuthenticatedSocket
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

      const targetSocketId = this.onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        this.server.to(targetSocketId).emit('voice-answer', {
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

  @SubscribeMessage('voice-ice-candidate')
  handleVoiceIceCandidate(
    @MessageBody()
    data: { channelId: number; targetUserId: number; candidate: any },
    @ConnectedSocket() client: AuthenticatedSocket
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

      const targetSocketId = this.onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        this.server.to(targetSocketId).emit('voice-ice-candidate', {
          channelId: data.channelId,
          fromUserId: client.userId,
          candidate: data.candidate,
        });
      }
    } catch (error) {
      this.logger.error('Error handling ICE candidate:', error.message);
    }
  }

  @SubscribeMessage('get-voice-channel-members')
  async handleGetVoiceChannelMembers(
    @MessageBody() data: { serverId?: number; channelId?: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      // If requesting members for a specific channel
      if (data.channelId) {
        if (typeof data.channelId !== 'number' || data.channelId <= 0) {
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

        const members = this.voiceChannelMembers.get(data.channelId);
        const membersList = members ? Array.from(members) : [];

        client.emit('voice-channel-members', {
          channelId: data.channelId,
          members: membersList,
        });
        return;
      }

      // If requesting members for all voice channels in a server
      if (data.serverId) {
        if (typeof data.serverId !== 'number' || data.serverId <= 0) {
          client.emit('error', { message: 'Invalid server ID' });
          return;
        }

        // Check if user is a member of the server
        try {
          const server = await this.prisma.server.findUnique({
            where: { id: data.serverId },
            select: {
              id: true,
              members: {
                select: { id: true },
              },
            },
          });

          if (!server) {
            client.emit('error', { message: 'Server not found' });
            return;
          }

          if (!server.members.some(member => member.id === client.userId)) {
            client.emit('error', {
              message: 'You are not a member of this server',
            });
            return;
          }
        } catch (error) {
          this.logger.error(
            `[Voice] Server membership check failed for server ${data.serverId}:`,
            error.message
          );
          client.emit('error', { message: 'Access denied' });
          return;
        }

        // Get all voice channel members for this server
        // Note: In a real implementation, you'd query the database for all voice channels in the server
        // For now, we'll send updates for all tracked voice channels
        for (const [channelId, members] of this.voiceChannelMembers.entries()) {
          const membersList = Array.from(members);
          client.emit('voice-channel-members', {
            channelId,
            members: membersList,
          });
        }
        return;
      }

      client.emit('error', {
        message: 'Either serverId or channelId must be provided',
      });
    } catch (error) {
      this.logger.error('Error getting voice channel members:', error.message);
    }
  }

  @SubscribeMessage('voice-speaking')
  async handleVoiceSpeaking(
    @MessageBody() data: { channelId: number; isSpeaking: boolean },
    @ConnectedSocket() client: AuthenticatedSocket
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
      const userVoiceChannel = this.userVoiceChannels.get(client.userId);

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

  @SubscribeMessage('voice-reconnect-request')
  handleVoiceReconnectRequest(
    @MessageBody() data: { channelId: number; targetUserId: number },
    @ConnectedSocket() client: AuthenticatedSocket
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
      const clientChannel = this.userVoiceChannels.get(client.userId);
      const targetChannel = this.userVoiceChannels.get(data.targetUserId);

      if (
        clientChannel !== data.channelId ||
        targetChannel !== data.channelId
      ) {
        this.logger.warn(
          `[Voice] Ignoring reconnection request from ${client.username} to user ${data.targetUserId} - not in same channel`
        );
        return;
      }

      const targetSocketId = this.onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        this.server.to(targetSocketId).emit('voice-reconnect-request', {
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

  private async broadcastVoiceChannelMembers(channelId: number) {
    try {
      const members = this.voiceChannelMembers.get(channelId);
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
      this.server.to(roomName).emit('voice-channel-members', {
        channelId,
        members: membersList,
      });

      // Also broadcast to all connected users for backward compatibility
      // This ensures older clients that haven't joined server rooms still receive updates
      this.server.emit('voice-channel-members', {
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
