import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SavedGifsService } from './saved-gifs.service';
import { SaveGifDto } from './dto/save-gif.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('saved-gifs')
export class SavedGifsController {
  constructor(private readonly savedGifsService: SavedGifsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getSavedGifs(@Request() req) {
    return this.savedGifsService.getSavedGifs(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  saveGif(@Request() req, @Body() saveGifDto: SaveGifDto) {
    return this.savedGifsService.saveGif(req.user.id, saveGifDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  removeSavedGif(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.savedGifsService.removeSavedGif(req.user.id, id);
  }
}
