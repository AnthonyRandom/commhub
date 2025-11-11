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
import { ChatGateway } from '../gateway/chat.gateway';

@Controller('direct-messages')
@UseGuards(JwtAuthGuard)
export class DirectMessagesController {
  constructor(
    private readonly directMessagesService: DirectMessagesService,
    private readonly chatGateway: ChatGateway
  ) {}

  @Post()
  async create(
    @Body() createDirectMessageDto: CreateDirectMessageDto,
    @Request() req
  ) {
    // Check if this is the first message between these two users
    const preCount = await this.directMessagesService.countConversation(
      req.user.id,
      createDirectMessageDto.receiverId
    );

    const messageData = await this.directMessagesService.create(
      createDirectMessageDto,
      req.user.id
    );

    // Emit WebSocket event to both sender and receiver for real-time updates
    const messageDto = {
      id: messageData.id,
      content: messageData.content,
      senderId: messageData.senderId,
      receiverId: messageData.receiverId,
      createdAt: messageData.createdAt,
      isEdited: messageData.isEdited,
      editedAt: messageData.editedAt,
      isRead: false,
      sender: {
        id: messageData.sender.id,
        username: messageData.sender.username,
      },
      receiver: {
        id: messageData.receiver.id,
        username: messageData.receiver.username,
      },
      attachments: messageData.attachments || [],
    };

    // Emit to both users via WebSocket
    this.chatGateway.emitDirectMessage(messageData.receiverId, messageDto);
    this.chatGateway.emitDirectMessage(messageData.senderId, messageDto);

    // If this was the first message, emit dm-thread-created to refresh conversation lists
    if (preCount === 0) {
      this.chatGateway.emitDMThreadCreated(messageData.receiverId);
      this.chatGateway.emitDMThreadCreated(messageData.senderId);
    }

    return messageData;
  }

  @Get('conversations')
  findAllConversations(@Request() req) {
    return this.directMessagesService.findAllConversations(req.user.id);
  }

  @Get('conversation/:userId')
  findConversation(
    @Param('userId', ParseIntPipe) otherUserId: number,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Request() req
  ) {
    return this.directMessagesService.findConversation(
      req.user.id,
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
    return this.directMessagesService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.directMessagesService.remove(id, req.user.id);
  }

  @Post('conversation/:userId/read')
  markAsRead(
    @Param('userId', ParseIntPipe) conversationUserId: number,
    @Request() req
  ) {
    return this.directMessagesService.markAsRead(
      conversationUserId,
      req.user.id
    );
  }
}
