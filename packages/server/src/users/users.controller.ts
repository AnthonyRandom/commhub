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
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':userId/friends/:friendId')
  addFriend(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('friendId', ParseIntPipe) friendId: number
  ) {
    return this.usersService.addFriend(userId, friendId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':userId/friends/:friendId')
  removeFriend(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('friendId', ParseIntPipe) friendId: number
  ) {
    return this.usersService.removeFriend(userId, friendId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/friends')
  getFriends(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getFriends(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':userId/block/:blockedUserId')
  blockUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('blockedUserId', ParseIntPipe) blockedUserId: number
  ) {
    return this.usersService.blockUser(userId, blockedUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':userId/block/:blockedUserId')
  unblockUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('blockedUserId', ParseIntPipe) blockedUserId: number
  ) {
    return this.usersService.unblockUser(userId, blockedUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/blocked')
  getBlockedUsers(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getBlockedUsers(id);
  }
}
