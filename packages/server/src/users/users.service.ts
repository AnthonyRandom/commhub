import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { password, ...userData } = createUserDto;

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        createdAt: true,
        ownedServers: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        servers: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        friends: {
          select: {
            id: true,
            username: true,
          },
        },
        friendsOf: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        ownedServers: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        servers: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        friends: {
          select: {
            id: true,
            username: true,
          },
        },
        friendsOf: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const { password, ...userData } = updateUserDto;

    let data: any = { ...userData };

    // Hash password if provided
    if (password) {
      const saltRounds = 10;
      data.password = await bcrypt.hash(password, saltRounds);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async remove(id: number) {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
      return { message: 'User deleted successfully' };
    } catch (error) {
      throw new NotFoundException('User not found');
    }
  }

  async addFriend(userId: number, friendId: number) {
    // Prevent self-friending
    if (userId === friendId) {
      throw new NotFoundException('Cannot add yourself as a friend');
    }

    // Check if users exist
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const friend = await this.prisma.user.findUnique({
      where: { id: friendId },
    });

    if (!user || !friend) {
      throw new NotFoundException('User not found');
    }

    // Check if friendship already exists
    const existingFriendship = await this.prisma.user.findFirst({
      where: {
        id: userId,
        friends: {
          some: { id: friendId },
        },
      },
    });

    if (existingFriendship) {
      throw new NotFoundException('Friendship already exists');
    }

    // Create mutual friendship
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        friends: {
          connect: { id: friendId },
        },
      },
    });

    return { message: 'Friend added successfully' };
  }

  async removeFriend(userId: number, friendId: number) {
    // Prevent self-removal
    if (userId === friendId) {
      throw new NotFoundException('Invalid operation');
    }

    // Verify user and friend exist
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const friend = await this.prisma.user.findUnique({
      where: { id: friendId },
    });

    if (!user || !friend) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        friends: {
          disconnect: { id: friendId },
        },
      },
    });

    return { message: 'Friend removed successfully' };
  }

  async getFriends(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        friends: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.friends;
  }

  async blockUser(userId: number, blockedUserId: number) {
    if (userId === blockedUserId) {
      throw new NotFoundException('Cannot block yourself');
    }

    const blockedUser = await this.prisma.user.findUnique({
      where: { id: blockedUserId },
    });

    if (!blockedUser) {
      throw new NotFoundException('User not found');
    }

    const existingBlock = await this.prisma.user.findFirst({
      where: {
        id: userId,
        blockedUsers: {
          some: { id: blockedUserId },
        },
      },
    });

    if (existingBlock) {
      throw new NotFoundException('User is already blocked');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        blockedUsers: {
          connect: { id: blockedUserId },
        },
        friends: {
          disconnect: { id: blockedUserId },
        },
      },
    });

    await this.prisma.user.update({
      where: { id: blockedUserId },
      data: {
        friends: {
          disconnect: { id: userId },
        },
      },
    });

    await this.prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: blockedUserId },
          { senderId: blockedUserId, receiverId: userId },
        ],
      },
    });

    return { message: 'User blocked successfully' };
  }

  async unblockUser(userId: number, blockedUserId: number) {
    const blockedUser = await this.prisma.user.findUnique({
      where: { id: blockedUserId },
    });

    if (!blockedUser) {
      throw new NotFoundException('User not found');
    }

    const existingBlock = await this.prisma.user.findFirst({
      where: {
        id: userId,
        blockedUsers: {
          some: { id: blockedUserId },
        },
      },
    });

    if (!existingBlock) {
      throw new NotFoundException('User is not blocked');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        blockedUsers: {
          disconnect: { id: blockedUserId },
        },
      },
    });

    return { message: 'User unblocked successfully' };
  }

  async getBlockedUsers(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        blockedUsers: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.blockedUsers;
  }
}
