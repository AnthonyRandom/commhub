import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MentionsService {
  private logger = new Logger('MentionsService');
  private readonly MAX_MENTIONS_PER_MESSAGE = 10;

  constructor(private prisma: PrismaService) {}

  /**
   * Parse message content for @username mentions
   * Returns array of unique usernames mentioned
   */
  parseMentions(content: string): string[] {
    // Match @username (letters, numbers, underscores, hyphens)
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const matches = content.matchAll(mentionRegex);

    const usernames = new Set<string>();
    for (const match of matches) {
      usernames.add(match[1].toLowerCase());
      if (usernames.size >= this.MAX_MENTIONS_PER_MESSAGE) {
        break;
      }
    }

    return Array.from(usernames);
  }

  /**
   * Create mention records for a message
   */
  async createMentions(
    messageId: number,
    channelId: number,
    content: string,
    authorId: number
  ): Promise<void> {
    try {
      // Parse mentions from content
      const mentionedUsernames = this.parseMentions(content);

      if (mentionedUsernames.length === 0) {
        return;
      }

      // Get channel's server to validate membership
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          server: {
            include: {
              members: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      if (!channel) {
        return;
      }

      // Find users mentioned who are members of the server (case-insensitive)
      const mentionedUsers = channel.server.members.filter(member =>
        mentionedUsernames.includes(member.username.toLowerCase())
      );

      // Don't create mention for self
      const usersToMention = mentionedUsers.filter(
        user => user.id !== authorId
      );

      if (usersToMention.length === 0) {
        return;
      }

      // Create mention records
      await this.prisma.mention.createMany({
        data: usersToMention.map(user => ({
          messageId,
          userId: user.id,
          channelId,
          isRead: false,
        })),
        skipDuplicates: true,
      });

      this.logger.log(
        `Created ${usersToMention.length} mentions for message ${messageId}`
      );
    } catch (error) {
      this.logger.error('Error creating mentions:', error.message);
      // Don't throw - mentions are not critical
    }
  }

  /**
   * Get user's unread mentions
   */
  async getUserMentions(userId: number, channelId?: number) {
    return this.prisma.mention.findMany({
      where: {
        userId,
        isRead: false,
        ...(channelId && { channelId }),
      },
      include: {
        message: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
                serverId: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get mention count for a channel
   */
  async getChannelMentionCount(
    userId: number,
    channelId: number
  ): Promise<number> {
    return this.prisma.mention.count({
      where: {
        userId,
        channelId,
        isRead: false,
      },
    });
  }

  /**
   * Mark a mention as read
   */
  async markMentionAsRead(mentionId: number, userId: number): Promise<void> {
    try {
      const mention = await this.prisma.mention.findUnique({
        where: { id: mentionId },
      });

      if (!mention || mention.userId !== userId) {
        return;
      }

      await this.prisma.mention.update({
        where: { id: mentionId },
        data: { isRead: true },
      });
    } catch (error) {
      this.logger.error('Error marking mention as read:', error.message);
    }
  }

  /**
   * Mark all mentions in a channel as read
   */
  async markChannelMentionsAsRead(
    userId: number,
    channelId: number
  ): Promise<void> {
    try {
      await this.prisma.mention.updateMany({
        where: {
          userId,
          channelId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      this.logger.log(
        `Marked all mentions as read for user ${userId} in channel ${channelId}`
      );
    } catch (error) {
      this.logger.error(
        'Error marking channel mentions as read:',
        error.message
      );
    }
  }

  /**
   * Get mentioned user IDs from a message
   * Used for WebSocket notifications
   */
  async getMentionedUserIds(messageId: number): Promise<number[]> {
    const mentions = await this.prisma.mention.findMany({
      where: { messageId },
      select: { userId: true },
    });

    return mentions.map(m => m.userId);
  }
}
