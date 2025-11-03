import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { DirectMessagesService } from './direct-messages.service';
import { CreateDirectMessageDto } from './dto/create-direct-message.dto';
import { UpdateDirectMessageDto } from './dto/update-direct-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('direct-messages')
@UseGuards(JwtAuthGuard)
export class DirectMessagesController {
  constructor(private readonly directMessagesService: DirectMessagesService) {}

  @Post()
  create(
    @Body() createDirectMessageDto: CreateDirectMessageDto,
    @Request() req
  ) {
    return this.directMessagesService.create(
      createDirectMessageDto,
      req.user.userId
    );
  }

  @Get('conversations')
  findAllConversations(@Request() req) {
    return this.directMessagesService.findAllConversations(req.user.userId);
  }

  @Get('conversation/:userId')
  findConversation(
    @Param('userId', ParseIntPipe) otherUserId: number,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Request() req
  ) {
    return this.directMessagesService.findConversation(
      req.user.userId,
      otherUserId,
      limit ? +limit : 50,
      offset ? +offset : 0
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateDirectMessageDto,
    @Request() req
  ) {
    return this.directMessagesService.update(id, updateDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.directMessagesService.remove(id, req.user.userId);
  }

  @Post('conversation/:userId/read')
  markAsRead(
    @Param('userId', ParseIntPipe) conversationUserId: number,
    @Request() req
  ) {
    return this.directMessagesService.markAsRead(
      conversationUserId,
      req.user.userId
    );
  }
}
