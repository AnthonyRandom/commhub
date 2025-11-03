import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDirectMessageDto } from './dto/create-direct-message.dto';
import { UpdateDirectMessageDto } from './dto/update-direct-message.dto';

@Injectable()
export class DirectMessagesService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDirectMessageDto: CreateDirectMessageDto,
    senderId: number
  ) {
    const { receiverId, content } = createDirectMessageDto;

    if (senderId === receiverId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new NotFoundException('User not found');
    }

    const blockedByReceiver = await this.prisma.user.findFirst({
      where: {
        id: receiverId,
        blockedUsers: {
          some: { id: senderId },
        },
      },
    });

    if (blockedByReceiver) {
      throw new ForbiddenException('Cannot send message to this user');
    }

    const blockedBySender = await this.prisma.user.findFirst({
      where: {
        id: senderId,
        blockedUsers: {
          some: { id: receiverId },
        },
      },
    });

    if (blockedBySender) {
      throw new BadRequestException('You have blocked this user');
    }

    return this.prisma.directMessage.create({
      data: {
        content,
        senderId,
        receiverId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async findConversation(
    userId: number,
    otherUserId: number,
    limit = 50,
    offset = 0
  ) {
    // Enforce maximum limit to prevent DOS
    const maxLimit = 100;
    const safeLimit = Math.min(limit, maxLimit);
    if (userId === otherUserId) {
      throw new BadRequestException('Invalid conversation');
    }

    const otherUser = await this.prisma.user.findUnique({
      where: { id: otherUserId },
    });

    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    const blocked = await this.prisma.user.findFirst({
      where: {
        id: userId,
        OR: [
          { blockedUsers: { some: { id: otherUserId } } },
          { blockedBy: { some: { id: otherUserId } } },
        ],
      },
    });

    if (blocked) {
      throw new ForbiddenException('Cannot view conversation with this user');
    }

    return this.prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: safeLimit,
      skip: offset,
    });
  }

  async findAllConversations(userId: number) {
    const sentMessages = await this.prisma.directMessage.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });

    const receivedMessages = await this.prisma.directMessage.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const userIds = [
      ...new Set([
        ...sentMessages.map(m => m.receiverId),
        ...receivedMessages.map(m => m.senderId),
      ]),
    ];

    const conversations = await Promise.all(
      userIds.map(async otherUserId => {
        const lastMessage = await this.prisma.directMessage.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId },
            ],
          },
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
            receiver: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });

        const unreadCount = await this.prisma.directMessage.count({
          where: {
            senderId: otherUserId,
            receiverId: userId,
            isRead: false,
          },
        });

        const otherUser = await this.prisma.user.findUnique({
          where: { id: otherUserId },
          select: {
            id: true,
            username: true,
          },
        });

        return {
          user: otherUser,
          lastMessage,
          unreadCount,
        };
      })
    );

    return conversations.sort((a, b) => {
      const aTime = new Date(a.lastMessage?.createdAt || 0).getTime();
      const bTime = new Date(b.lastMessage?.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }

  async update(id: number, updateDto: UpdateDirectMessageDto, userId: number) {
    const message = await this.prisma.directMessage.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const timeSinceCreation =
      Date.now() - new Date(message.createdAt).getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    if (timeSinceCreation > fifteenMinutes) {
      throw new ForbiddenException(
        'Cannot edit messages older than 15 minutes'
      );
    }

    return this.prisma.directMessage.update({
      where: { id },
      data: {
        content: updateDto.content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async remove(id: number, userId: number) {
    const message = await this.prisma.directMessage.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.directMessage.delete({
      where: { id },
    });

    return { message: 'Message deleted successfully' };
  }

  async markAsRead(conversationUserId: number, userId: number) {
    await this.prisma.directMessage.updateMany({
      where: {
        senderId: conversationUserId,
        receiverId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return { message: 'Messages marked as read' };
  }
}
