import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { AuthenticatedSocket } from '../types/socket.types';

/**
 * Handles channel message operations
 * Manages sending, editing, and deleting messages in channels
 */
@Injectable()
export class ChannelMessagesHandler {
  private logger = new Logger('ChannelMessagesHandler');

  constructor(private messagesService: MessagesService) {}

  async handleSendMessage(
    server: Server,
    data: { channelId: number; content: string; replyToId?: number },
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
      server.to(roomName).emit('message', {
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

  async handleEditMessage(
    server: Server,
    data: { messageId: number; content: string },
    client: AuthenticatedSocket
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

      server.to(roomName).emit('message-edited', {
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

  async handleDeleteMessage(
    server: Server,
    data: { messageId: number; channelId: number },
    client: AuthenticatedSocket
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

      server.to(roomName).emit('message-deleted', {
        messageId: data.messageId,
        channelId: data.channelId,
      });
    } catch (error) {
      this.logger.error('Error deleting message:', error.message);
      client.emit('error', { message: 'Failed to delete message' });
    }
  }
}
