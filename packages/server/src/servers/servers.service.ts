import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateServerDto } from './dto/create-server.dto.js';
import { JoinServerDto } from './dto/join-server.dto.js';

@Injectable()
export class ServersService {
  constructor(private prisma: PrismaService) {}

  async create(createServerDto: CreateServerDto, ownerId: number) {
    return this.prisma.server.create({
      data: {
        ...createServerDto,
        ownerId,
        members: {
          connect: { id: ownerId },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
          },
        },
        channels: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });
  }

  async findAll(userId?: number) {
    const where = userId ? { members: { some: { id: userId } } } : {};

    return this.prisma.server.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
          },
        },
        channels: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            members: true,
            channels: true,
          },
        },
      },
    });
  }

  async findOne(id: number, userId?: number) {
    const server = await this.prisma.server.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
          },
        },
        channels: {
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            members: true,
            channels: true,
          },
        },
      },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    // Check if user is a member (if userId provided)
    if (userId && !server.members.some(member => member.id === userId)) {
      throw new ForbiddenException('You are not a member of this server');
    }

    return server;
  }

  async update(
    id: number,
    updateServerDto: Partial<CreateServerDto>,
    userId: number
  ) {
    // Check if server exists and user is owner
    const server = await this.prisma.server.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    if (server.ownerId !== userId) {
      throw new ForbiddenException('Only server owner can update server');
    }

    return this.prisma.server.update({
      where: { id },
      data: updateServerDto,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
          },
        },
        channels: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });
  }

  async remove(id: number, userId: number) {
    // Check if server exists and user is owner
    const server = await this.prisma.server.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    if (server.ownerId !== userId) {
      throw new ForbiddenException('Only server owner can delete server');
    }

    await this.prisma.server.delete({
      where: { id },
    });

    return { message: 'Server deleted successfully' };
  }

  async join(joinServerDto: JoinServerDto, userId: number) {
    const { inviteCode } = joinServerDto;

    // Find server by invite code
    const server = await this.prisma.server.findUnique({
      where: { inviteCode },
      include: {
        members: {
          select: { id: true },
        },
      },
    });

    if (!server) {
      throw new NotFoundException('Invalid invite code');
    }

    // Check if user is already a member
    if (server.members.some(member => member.id === userId)) {
      throw new ConflictException('You are already a member of this server');
    }

    // Add user to server
    return this.prisma.server.update({
      where: { id: server.id },
      data: {
        members: {
          connect: { id: userId },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
          },
        },
        channels: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });
  }

  async leave(serverId: number, userId: number) {
    // Check if server exists
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      select: {
        ownerId: true,
        members: {
          select: { id: true },
        },
      },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    // Check if user is a member
    if (!server.members.some(member => member.id === userId)) {
      throw new ForbiddenException('You are not a member of this server');
    }

    // Prevent owner from leaving their own server
    if (server.ownerId === userId) {
      throw new ForbiddenException(
        'Server owner cannot leave their own server'
      );
    }

    // Remove user from server
    await this.prisma.server.update({
      where: { id: serverId },
      data: {
        members: {
          disconnect: { id: userId },
        },
      },
    });

    return { message: 'Successfully left server' };
  }

  async getInviteCode(serverId: number, userId: number) {
    // Check if server exists and user is a member
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      select: {
        inviteCode: true,
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

    return { inviteCode: server.inviteCode };
  }

  async regenerateInviteCode(serverId: number, userId: number) {
    // Check if server exists and user is owner
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      select: { ownerId: true },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    if (server.ownerId !== userId) {
      throw new ForbiddenException(
        'Only server owner can regenerate invite code'
      );
    }

    // Generate new invite code
    const newInviteCode = this.generateInviteCode();

    return this.prisma.server.update({
      where: { id: serverId },
      data: { inviteCode: newInviteCode },
      select: { inviteCode: true },
    });
  }

  private generateInviteCode(): string {
    // Use crypto.randomInt for cryptographically secure random
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const crypto = require('crypto');
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return result;
  }
}
