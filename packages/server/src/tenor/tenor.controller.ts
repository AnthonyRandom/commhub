import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TenorService, TenorGif } from './tenor.service';

@Controller('tenor')
export class TenorController {
  constructor(private readonly tenorService: TenorService) {}

  @Get('trending')
  async getTrendingGifs(
    @Query('limit') limit?: string,
    @Query('pos') pos?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;

    if (limitNum < 1 || limitNum > 50) {
      throw new HttpException(
        'Limit must be between 1 and 50',
        HttpStatus.BAD_REQUEST
      );
    }

    return await this.tenorService.getTrendingGifs(limitNum, pos);
  }

  @Get('search')
  async searchGifs(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('pos') pos?: string
  ) {
    if (!query || query.trim().length === 0) {
      throw new HttpException(
        'Query parameter "q" is required',
        HttpStatus.BAD_REQUEST
      );
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;

    if (limitNum < 1 || limitNum > 50) {
      throw new HttpException(
        'Limit must be between 1 and 50',
        HttpStatus.BAD_REQUEST
      );
    }

    return await this.tenorService.searchGifs(query.trim(), limitNum, pos);
  }
}
