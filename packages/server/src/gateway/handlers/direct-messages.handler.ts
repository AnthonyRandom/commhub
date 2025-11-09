import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { LRUCache } from 'lru-cache';
import { DirectMessagesService } from '../../direct-messages/direct-messages.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedSocket } from '../types/socket.types';

/**
 * Handles direct message operations between users
 * Manages DM sending and thread creation notifications
 */
@Injectable()
export class DirectMessagesHandler {
  private logger = new Logger('DirectMessagesHandler');

  constructor(
    private directMessagesService: DirectMessagesService,
    private prisma: PrismaService
  ) {}

  async handleSendDirectMessage(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    data: { receiverId: number; content: string },
    client: AuthenticatedSocket
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

      // Check if this is the first ever message between these two users
      const preCount = await this.prisma.directMessage.count({
        where: {
          OR: [
            { senderId: client.userId, receiverId: data.receiverId },
            { senderId: data.receiverId, receiverId: client.userId },
          ],
        },
      });

      const messageData = await this.directMessagesService.create(
        {
          receiverId: data.receiverId,
          content: trimmedContent,
        },
        client.userId
      );

      const receiverSocketId = onlineUsers.get(data.receiverId);
      const senderSocketId = onlineUsers.get(client.userId);

      // Send the full message object to both sender and receiver
      const messageDto = {
        id: messageData.id,
        content: messageData.content,
        senderId: messageData.senderId,
        receiverId: messageData.receiverId,
        createdAt: messageData.createdAt,
        isEdited: messageData.isEdited,
        editedAt: messageData.editedAt,
        isRead: false, // New messages are unread
        sender: {
          id: messageData.sender.id,
          username: messageData.sender.username,
        },
        receiver: {
          id: messageData.receiver.id,
          username: messageData.receiver.username,
        },
      };

      this.logger.log(
        `[DM] Sending direct-message to receiver ${data.receiverId} (socketId: ${receiverSocketId || 'offline'}) and sender ${client.userId} (socketId: ${senderSocketId || 'offline'})`
      );

      if (receiverSocketId) {
        server.to(receiverSocketId).emit('direct-message', messageDto);
        this.logger.log(
          `[DM] Emitted direct-message to receiver socket ${receiverSocketId}`
        );
      } else {
        this.logger.warn(
          `[DM] Receiver ${data.receiverId} is offline, message not sent via WebSocket`
        );
      }

      if (senderSocketId) {
        server.to(senderSocketId).emit('direct-message', messageDto);
        this.logger.log(
          `[DM] Emitted direct-message to sender socket ${senderSocketId}`
        );
      }

      // If this was the first message, emit dm-thread-created
      if (preCount === 0) {
        const threadInfo = {
          userA: { id: client.userId, username: client.username },
          userB: { id: data.receiverId },
          lastMessage: messageDto,
        };
        server.to(receiverSocketId).emit('dm-thread-created', threadInfo);
        server.to(senderSocketId).emit('dm-thread-created', threadInfo);
      }
    } catch (error) {
      this.logger.error('Error sending direct message:', error.message);
      client.emit('error', { message: 'Failed to send direct message' });
    }
  }

  /**
   * Public method to emit direct message events from HTTP controller
   */
  emitDirectMessage(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    userId: number,
    messageDto: any
  ) {
    const socketId = onlineUsers.get(userId);
    if (socketId) {
      this.logger.log(
        `[DM-HTTP] Emitting direct-message to user ${userId} (socket: ${socketId})`
      );
      server.to(socketId).emit('direct-message', messageDto);
    } else {
      this.logger.log(
        `[DM-HTTP] User ${userId} is offline, skipping WebSocket emission`
      );
    }
  }

  /**
   * Public method to emit dm-thread-created events from HTTP controller
   */
  emitDMThreadCreated(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    userId: number
  ) {
    const socketId = onlineUsers.get(userId);
    if (socketId) {
      this.logger.log(
        `[DM-HTTP] Emitting dm-thread-created to user ${userId} (socket: ${socketId})`
      );
      server.to(socketId).emit('dm-thread-created', {});
    }
  }
}
