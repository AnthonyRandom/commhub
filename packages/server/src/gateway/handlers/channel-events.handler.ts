import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Server } from 'socket.io';
import { ChannelsService } from '../../channels/channels.service';
import { UsersService } from '../../users/users.service';
import { AuthenticatedSocket } from '../types/socket.types';

/**
 * Handles channel and server room events
 * Manages joining/leaving channels and servers, and channel CRUD notifications
 */
@Injectable()
export class ChannelEventsHandler {
  private logger = new Logger('ChannelEventsHandler');

  constructor(
    @Inject(forwardRef(() => ChannelsService))
    private channelsService: ChannelsService,
    private usersService: UsersService
  ) {}

  async handleJoinServer(
    server: Server,
    data: { serverId: number },
    client: AuthenticatedSocket
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
      const user = await this.usersService.findOne(client.userId);
      const isMember = user.servers?.some(s => s.id === data.serverId);

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

  handleLeaveServer(data: { serverId: number }, client: AuthenticatedSocket) {
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

  async handleJoinChannel(
    data: { channelId: number },
    client: AuthenticatedSocket
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

  handleLeaveChannel(data: { channelId: number }, client: AuthenticatedSocket) {
    const roomName = `channel-${data.channelId}`;
    client.leave(roomName);
    this.logger.log(`${client.username} left channel room: ${roomName}`);
  }

  notifyChannelCreated(server: Server, serverId: number, channel: any) {
    try {
      const serverRoom = `server-${serverId}`;
      server.to(serverRoom).emit('channel-created', {
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

  notifyChannelUpdated(server: Server, serverId: number, channel: any) {
    try {
      const serverRoom = `server-${serverId}`;
      server.to(serverRoom).emit('channel-updated', {
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

  notifyChannelDeleted(server: Server, serverId: number, channelId: number) {
    try {
      const serverRoom = `server-${serverId}`;
      server.to(serverRoom).emit('channel-deleted', {
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
}
