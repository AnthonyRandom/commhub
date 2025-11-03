import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';

@Injectable()
export class FriendRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createFriendRequestDto: CreateFriendRequestDto,
    senderId: number
  ) {
    const { receiverId } = createFriendRequestDto;

    if (senderId === receiverId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new NotFoundException('User not found');
    }

    const existingRequest = await this.prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId,
        },
      },
    });

    if (existingRequest) {
      throw new ConflictException('Friend request already exists');
    }

    const reverseRequest = await this.prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: receiverId,
          receiverId: senderId,
        },
      },
    });

    if (reverseRequest) {
      throw new ConflictException(
        'This user has already sent you a friend request'
      );
    }

    const existingFriendship = await this.prisma.user.findFirst({
      where: {
        id: senderId,
        friends: {
          some: { id: receiverId },
        },
      },
    });

    if (existingFriendship) {
      throw new ConflictException('You are already friends with this user');
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
      throw new ForbiddenException('Cannot send friend request to this user');
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

    return this.prisma.friendRequest.create({
      data: {
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

  async findAllSent(userId: number) {
    return this.prisma.friendRequest.findMany({
      where: {
        senderId: userId,
        status: 'pending',
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findAllReceived(userId: number) {
    return this.prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'pending',
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async respond(
    requestId: number,
    respondDto: RespondFriendRequestDto,
    userId: number
  ) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.receiverId !== userId) {
      throw new ForbiddenException(
        'You can only respond to your own friend requests'
      );
    }

    if (request.status !== 'pending') {
      throw new ConflictException(
        'Friend request has already been responded to'
      );
    }

    const updatedRequest = await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status: respondDto.status,
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

    if (respondDto.status === 'accepted') {
      // Use a transaction to ensure both friendships are created atomically
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: request.senderId },
          data: {
            friends: {
              connect: { id: request.receiverId },
            },
          },
        }),
        this.prisma.user.update({
          where: { id: request.receiverId },
          data: {
            friends: {
              connect: { id: request.senderId },
            },
          },
        }),
      ]);
    }

    return updatedRequest;
  }

  async cancel(requestId: number, userId: number) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.senderId !== userId) {
      throw new ForbiddenException(
        'You can only cancel your own friend requests'
      );
    }

    await this.prisma.friendRequest.delete({
      where: { id: requestId },
    });

    return { message: 'Friend request cancelled successfully' };
  }
}
