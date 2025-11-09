import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { LRUCache } from 'lru-cache';
import { UsersService } from '../../users/users.service';
import { AuthenticatedSocket } from '../types/socket.types';

/**
 * Handles user presence and friend status
 * Manages online/offline notifications, status changes, and friend requests
 */
@Injectable()
export class PresenceHandler {
  private logger = new Logger('PresenceHandler');

  constructor(private usersService: UsersService) {}

  async notifyFriendsPresence(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    userId: number,
    status: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline'
  ) {
    try {
      // Get the user whose status changed
      const user = await this.usersService.findOne(userId);
      if (!user) {
        this.logger.error(`User ${userId} not found for presence notification`);
        return;
      }

      // Get user's friends
      const friends = await this.usersService.getFriends(userId);

      // Map status for friends: invisible users appear offline to friends
      const friendStatus = status === 'invisible' ? 'offline' : status;

      this.logger.log(
        `[Presence] Notifying ${friends.length} friends about ${user.username}'s ${friendStatus} status`
      );

      for (const friend of friends) {
        const friendSocketId = onlineUsers.get(friend.id);
        if (friendSocketId) {
          server.to(friendSocketId).emit('friend-presence', {
            userId,
            username: user.username,
            status: friendStatus,
          });
          this.logger.log(
            `[Presence] Sent ${friendStatus} status to friend ${friend.username} (${friend.id})`
          );
        } else {
          this.logger.log(
            `[Presence] Friend ${friend.username} (${friend.id}) is offline, skipping`
          );
        }
      }
    } catch (error) {
      this.logger.error('Error notifying friends presence:', error.message);
    }
  }

  async handleStatusChange(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    data: { userId: number; status: 'online' | 'idle' | 'dnd' | 'invisible' },
    client: AuthenticatedSocket
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
        await this.notifyFriendsPresence(
          server,
          onlineUsers,
          client.userId,
          data.status
        );
      }

      // For invisible status, notify friends as offline
      if (data.status === 'invisible') {
        await this.notifyFriendsPresence(
          server,
          onlineUsers,
          client.userId,
          'offline'
        );
      }

      // Broadcast status update to all connected clients (except for invisible users)
      if (data.status !== 'invisible') {
        server.emit('status-update', {
          userId: data.userId,
          status: data.status,
        });
      }
    } catch (error) {
      this.logger.error('Error updating status:', error.message);
      client.emit('error', { message: 'Failed to update status' });
    }
  }

  handleFriendRequestNotification(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    data: { receiverId: number; senderUsername: string },
    client: AuthenticatedSocket
  ) {
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      server.to(receiverSocketId).emit('friend-request-received', {
        senderId: client.userId,
        senderUsername: data.senderUsername,
      });
    }
  }

  handleFriendRequestResponse(
    server: Server,
    onlineUsers: LRUCache<number, string>,
    data: {
      requestId: number;
      senderId: number;
      status: 'accepted' | 'rejected';
    },
    client: AuthenticatedSocket
  ) {
    const senderSocketId = onlineUsers.get(data.senderId);
    if (senderSocketId) {
      server.to(senderSocketId).emit('friend-request-responded', {
        requestId: data.requestId,
        responderId: client.userId,
        responderUsername: client.username,
        status: data.status,
      });
    }
  }

  async handleGetOnlineFriends(
    onlineUsers: LRUCache<number, string>,
    client: AuthenticatedSocket
  ) {
    try {
      const friends = await this.usersService.getFriends(client.userId);
      const onlineFriends = friends.filter(friend =>
        onlineUsers.has(friend.id)
      );

      client.emit('online-friends', onlineFriends);
    } catch (error) {
      this.logger.error('Error getting online friends:', error.message);
      client.emit('error', { message: 'Failed to get online friends' });
    }
  }
}
