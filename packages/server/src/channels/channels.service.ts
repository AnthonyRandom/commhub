import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChatGateway } from '../gateway/chat.gateway';

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway
  ) {}

  async create(createChannelDto: CreateChannelDto, userId: number) {
    const { serverId, ...channelData } = createChannelDto;

    // Check if server exists and user is a member
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      select: {
        id: true,
        ownerId: true,
        members: {
          select: { id: true },
        },
      },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    if (!server.members.some(member => member.id === userId)) {
      throw new ForbiddenException('You are not a member of this server');
    }

    // Only server owner can create channels (for MVP)
    if (server.ownerId !== userId) {
      throw new ForbiddenException('Only server owner can create channels');
    }

    const newChannel = await this.prisma.channel.create({
      data: {
        ...channelData,
        serverId,
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    // Notify all members of the server about the new channel
    this.chatGateway.notifyChannelCreated(serverId, newChannel);

    return newChannel;
  }

  async findAll(serverId?: number, userId?: number) {
    const where: any = {};

    if (serverId) {
      where.serverId = serverId;

      // If serverId is provided, check if user is a member
      if (userId) {
        const server = await this.prisma.server.findUnique({
          where: { id: serverId },
          select: {
            members: {
              select: { id: true },
            },
          },
        });

        if (!server || !server.members.some(member => member.id === userId)) {
          throw new ForbiddenException('You are not a member of this server');
        }
      }
    }

    return this.prisma.channel.findMany({
      where,
      include: {
        server: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findOne(id: number, userId?: number) {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            members: {
              select: { id: true },
            },
          },
        },
        messages: {
          take: 50, // Last 50 messages
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Check if user is a member of the server
    if (
      userId &&
      !channel.server.members.some(member => member.id === userId)
    ) {
      throw new ForbiddenException('You are not a member of this server');
    }

    return channel;
  }

  async update(id: number, updateChannelDto: UpdateChannelDto, userId: number) {
    // Check if channel exists and get server info
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      select: {
        id: true,
        serverId: true,
        server: {
          select: {
            ownerId: true,
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

    // Only server owner can update channels
    if (channel.server.ownerId !== userId) {
      throw new ForbiddenException('Only server owner can update channels');
    }

    const updatedChannel = await this.prisma.channel.update({
      where: { id },
      data: updateChannelDto,
      include: {
        server: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    // Notify all members of the server about the channel update
    this.chatGateway.notifyChannelUpdated(channel.serverId, updatedChannel);

    return updatedChannel;
  }

  async remove(id: number, userId: number) {
    // Check if channel exists and get server info
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      select: {
        id: true,
        serverId: true,
        server: {
          select: {
            ownerId: true,
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

    // Only server owner can delete channels
    if (channel.server.ownerId !== userId) {
      throw new ForbiddenException('Only server owner can delete channels');
    }

    await this.prisma.channel.delete({
      where: { id },
    });

    // Notify all members of the server about the channel deletion
    this.chatGateway.notifyChannelDeleted(channel.serverId, id);

    return { message: 'Channel deleted successfully' };
  }

  async getChannelMessages(
    channelId: number,
    userId: number,
    limit = 50,
    offset = 0,
    before?: number
  ) {
    // Enforce maximum limit to prevent DOS
    const maxLimit = 100;
    const safeLimit = Math.min(limit, maxLimit);
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

    let queryOptions: any = {
      where: { channelId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        attachments: {
          select: {
            id: true,
            url: true,
            filename: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: safeLimit,
    };

    if (before) {
      // Load messages before the specified message ID (for pagination)
      queryOptions.where.id = {
        lt: before,
      };
    } else {
      // Load the most recent messages (default behavior)
      const totalMessages = await this.prisma.message.count({
        where: { channelId },
      });

      // Calculate offset from the end to get the most recent messages
      const fromEndOffset = Math.max(0, totalMessages - safeLimit - offset);
      queryOptions.skip = Math.max(0, fromEndOffset);
    }

    return this.prisma.message.findMany(queryOptions);
  }
}
