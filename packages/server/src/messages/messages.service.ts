import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async create(createMessageDto: CreateMessageDto, userId: number) {
    const { channelId, content } = createMessageDto;

    // Check if channel exists and user has access
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        server: {
          select: {
            members: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Check if user is a member of the server
    if (!channel.server.members.some(member => member.id === userId)) {
      throw new ForbiddenException('You are not a member of this server');
    }

    return this.prisma.message.create({
      data: {
        content,
        channelId,
        userId,
      },
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
          },
        },
      },
    });
  }

  async findAll(channelId?: number, userId?: number, limit = 50, offset = 0) {
    const where: any = {};

    if (channelId) {
      where.channelId = channelId;

      // If channelId is provided, check if user has access
      if (userId) {
        const channel = await this.prisma.channel.findUnique({
          where: { id: channelId },
          select: {
            server: {
              select: {
                members: {
                  select: { id: true },
                },
              },
            },
          },
        });

        if (
          !channel ||
          !channel.server.members.some(member => member.id === userId)
        ) {
          throw new ForbiddenException('You are not a member of this server');
        }
      }
    }

    return this.prisma.message.findMany({
      where,
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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: number, userId?: number) {
    const message = await this.prisma.message.findUnique({
      where: { id },
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
            server: {
              select: {
                members: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user has access to the channel
    if (
      userId &&
      !message.channel.server.members.some(member => member.id === userId)
    ) {
      throw new ForbiddenException('You are not a member of this server');
    }

    return message;
  }

  async update(id: number, content: string, userId: number) {
    // Check if message exists and user is the author
    const message = await this.prisma.message.findUnique({
      where: { id },
      select: {
        userId: true,
        channel: {
          select: {
            server: {
              select: {
                members: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user is the author
    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // Check if user is still a member of the server
    if (!message.channel.server.members.some(member => member.id === userId)) {
      throw new ForbiddenException('You are not a member of this server');
    }

    return this.prisma.message.update({
      where: { id },
      data: { content },
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
          },
        },
      },
    });
  }

  async remove(id: number, userId: number) {
    // Check if message exists and user is the author or server owner
    const message = await this.prisma.message.findUnique({
      where: { id },
      select: {
        userId: true,
        channel: {
          select: {
            server: {
              select: {
                ownerId: true,
                members: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user is the author or server owner
    const isAuthor = message.userId === userId;
    const isServerOwner = message.channel.server.ownerId === userId;

    if (!isAuthor && !isServerOwner) {
      throw new ForbiddenException(
        'You can only delete your own messages or be server owner'
      );
    }

    // Check if user is still a member of the server
    if (!message.channel.server.members.some(member => member.id === userId)) {
      throw new ForbiddenException('You are not a member of this server');
    }

    await this.prisma.message.delete({
      where: { id },
    });

    return { message: 'Message deleted successfully' };
  }

  async getChannelMessages(
    channelId: number,
    userId: number,
    limit = 50,
    offset = 0
  ) {
    // Check if channel exists and user has access
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        server: {
          select: {
            members: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Check if user is a member of the server
    if (!channel.server.members.some(member => member.id === userId)) {
      throw new ForbiddenException('You are not a member of this server');
    }

    return this.prisma.message.findMany({
      where: { channelId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });
  }
}
