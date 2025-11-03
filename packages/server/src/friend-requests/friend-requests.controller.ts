import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FriendRequestsService } from './friend-requests.service';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('friend-requests')
@UseGuards(JwtAuthGuard)
export class FriendRequestsController {
  constructor(private readonly friendRequestsService: FriendRequestsService) {}

  @Post()
  create(
    @Body() createFriendRequestDto: CreateFriendRequestDto,
    @Request() req
  ) {
    return this.friendRequestsService.create(
      createFriendRequestDto,
      req.user.id
    );
  }

  @Get('sent')
  findAllSent(@Request() req) {
    return this.friendRequestsService.findAllSent(req.user.id);
  }

  @Get('received')
  findAllReceived(@Request() req) {
    return this.friendRequestsService.findAllReceived(req.user.id);
  }

  @Patch(':id/respond')
  respond(
    @Param('id') id: string,
    @Body() respondDto: RespondFriendRequestDto,
    @Request() req
  ) {
    return this.friendRequestsService.respond(+id, respondDto, req.user.id);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @Request() req) {
    return this.friendRequestsService.cancel(+id, req.user.id);
  }
}
