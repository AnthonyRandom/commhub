import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('mentions')
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getUserMentions(@Request() req, @Query('channelId') channelId?: string) {
    const channelIdNum = channelId ? parseInt(channelId, 10) : undefined;
    return this.mentionsService.getUserMentions(req.user.id, channelIdNum);
  }

  @UseGuards(JwtAuthGuard)
  @Get('channel/:channelId/count')
  getChannelMentionCount(
    @Request() req,
    @Param('channelId', ParseIntPipe) channelId: number
  ) {
    return this.mentionsService.getChannelMentionCount(req.user.id, channelId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  markMentionAsRead(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.mentionsService.markMentionAsRead(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('channel/:channelId/read-all')
  markChannelMentionsAsRead(
    @Request() req,
    @Param('channelId', ParseIntPipe) channelId: number
  ) {
    return this.mentionsService.markChannelMentionsAsRead(
      req.user.id,
      channelId
    );
  }
}
