import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveGifDto } from './dto/save-gif.dto';

@Injectable()
export class SavedGifsService {
  private readonly MAX_SAVED_GIFS_PER_USER = 100;

  constructor(private prisma: PrismaService) {}

  async getSavedGifs(userId: number) {
    return this.prisma.savedGif.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveGif(userId: number, saveGifDto: SaveGifDto) {
    const { gifUrl, tenorId, contentDescription, thumbnailUrl } = saveGifDto;

    // Check if user already has this GIF saved
    const existing = await this.prisma.savedGif.findFirst({
      where: {
        userId,
        gifUrl,
      },
    });

    if (existing) {
      throw new BadRequestException('GIF already saved');
    }

    // Check if user has reached the limit
    const count = await this.prisma.savedGif.count({
      where: { userId },
    });

    if (count >= this.MAX_SAVED_GIFS_PER_USER) {
      throw new BadRequestException(
        `You can only save up to ${this.MAX_SAVED_GIFS_PER_USER} GIFs`
      );
    }

    return this.prisma.savedGif.create({
      data: {
        userId,
        gifUrl,
        tenorId,
        contentDescription,
        thumbnailUrl,
      },
    });
  }

  async removeSavedGif(userId: number, gifId: number) {
    const savedGif = await this.prisma.savedGif.findUnique({
      where: { id: gifId },
    });

    if (!savedGif) {
      throw new NotFoundException('Saved GIF not found');
    }

    if (savedGif.userId !== userId) {
      throw new BadRequestException('You can only remove your own saved GIFs');
    }

    await this.prisma.savedGif.delete({
      where: { id: gifId },
    });

    return { message: 'GIF removed successfully' };
  }

  async isGifSaved(userId: number, gifUrl: string): Promise<boolean> {
    const savedGif = await this.prisma.savedGif.findFirst({
      where: {
        userId,
        gifUrl,
      },
    });

    return !!savedGif;
  }
}
