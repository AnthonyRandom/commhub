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
import { Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { DirectMessagesService } from '../direct-messages/direct-messages.service';

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

  constructor(
    private jwtService: JwtService,
    private messagesService: MessagesService,
    private usersService: UsersService,
    private directMessagesService: DirectMessagesService
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

      // Track user as online
      this.onlineUsers.set(client.userId, client.id);

      this.logger.log(
        `Client connected: ${client.username} (${client.userId})`
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
      // Remove user from online tracking
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

    // Note: Authorization check would require ChannelsService injection
    // For now, we rely on the message sending authorization
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
    @MessageBody() data: { channelId: number; content: string },
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

      // Save message to database (includes authorization check)
      const message = await this.messagesService.create(
        {
          content: trimmedContent,
          channelId: data.channelId,
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
        editedAt: new Date().toISOString(),
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

      const messageData = {
        id: directMessage.id,
        content: directMessage.content,
        senderId: client.userId,
        senderUsername: client.username,
        receiverId: data.receiverId,
        createdAt: directMessage.createdAt,
        isEdited: directMessage.isEdited,
        editedAt: directMessage.editedAt,
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

  private async notifyFriendsPresence(
    userId: number,
    status: 'online' | 'offline'
  ) {
    try {
      // Get user's friends
      const friends = await this.usersService.getFriends(userId);

      // Notify each friend if they're online
      for (const friend of friends) {
        const friendSocketId = this.onlineUsers.get(friend.id);
        if (friendSocketId) {
          this.server.to(friendSocketId).emit('friend-presence', {
            userId,
            username: friend.username, // Note: we might need to get the actual username
            status,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error notifying friends presence:', error.message);
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

      const roomName = `voice-${data.channelId}`;
      client.join(roomName);
      this.logger.log(
        `[Voice] ${client.username} joined voice channel room: ${roomName}`
      );

      // Get list of users already in the voice channel using Socket.IO v5 method
      const socketsInRoom = await this.server.in(roomName).fetchSockets();
      const usersInChannel: Array<{ userId: number; username: string }> = [];

      this.logger.log(
        `[Voice] Room ${roomName} has ${socketsInRoom.length} sockets`
      );

      for (const socket of socketsInRoom) {
        const authSocket = socket as any as AuthenticatedSocket;
        if (authSocket.userId && authSocket.userId !== client.userId) {
          usersInChannel.push({
            userId: authSocket.userId,
            username: authSocket.username,
          });
          this.logger.log(
            `[Voice] Found user in channel: ${authSocket.username} (${authSocket.userId})`
          );
        }
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
        `[Voice] Broadcasting voice-user-joined to room ${roomName}`
      );

      // Notify other users in the channel about the new user
      client.to(roomName).emit('voice-user-joined', {
        channelId: data.channelId,
        userId: client.userId,
        username: client.username,
      });

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
  handleLeaveVoiceChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const roomName = `voice-${data.channelId}`;
    client.leave(roomName);
    this.logger.log(`${client.username} left voice channel room: ${roomName}`);

    // Notify others in the voice channel
    client.to(roomName).emit('voice-user-left', {
      channelId: data.channelId,
      userId: client.userId,
      username: client.username,
    });
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
}
