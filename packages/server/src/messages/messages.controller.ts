import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createMessageDto: CreateMessageDto, @Request() req) {
    return this.messagesService.create(createMessageDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Request() req,
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const channelIdNum = channelId ? parseInt(channelId) : undefined;
    const limitNum = limit ? parseInt(limit) : 50;
    const offsetNum = offset ? parseInt(offset) : 0;
    return this.messagesService.findAll(
      channelIdNum,
      req.user.id,
      limitNum,
      offsetNum
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.messagesService.findOne(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body('content') content: string,
    @Request() req
  ) {
    return this.messagesService.update(id, content, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.messagesService.remove(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('channels/:channelId/messages')
  getChannelMessages(
    @Param('channelId', ParseIntPipe) channelId: number,
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const limitNum = limit ? parseInt(limit) : 50;
    const offsetNum = offset ? parseInt(offset) : 0;
    return this.messagesService.getChannelMessages(
      channelId,
      req.user.id,
      limitNum,
      offsetNum
    );
  }
}
