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
import { MessagesService } from '../messages/messages.service.js';
import { UsersService } from '../users/users.service.js';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Configure for production
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
    private usersService: UsersService
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
  handleJoinServer(
    @MessageBody() data: { serverId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const roomName = `server-${data.serverId}`;
    client.join(roomName);
    this.logger.log(`${client.username} joined server room: ${roomName}`);

    // Notify others in the server
    client.to(roomName).emit('user-joined', {
      userId: client.userId,
      username: client.username,
    });
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
      userId: client.userId,
      username: client.username,
    });
  }

  @SubscribeMessage('join-channel')
  handleJoinChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
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
      // Save message to database
      const message = await this.messagesService.create(
        {
          content: data.content,
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
      });
    } catch (error) {
      this.logger.error('Error sending message:', error.message);
      client.emit('error', { message: 'Failed to send message' });
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
}
