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
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createChannelDto: CreateChannelDto, @Request() req) {
    return this.channelsService.create(createChannelDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req, @Query('serverId') serverId?: string) {
    const serverIdNum = serverId ? parseInt(serverId) : undefined;
    return this.channelsService.findAll(serverIdNum, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.channelsService.findOne(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateChannelDto: UpdateChannelDto,
    @Request() req
  ) {
    return this.channelsService.update(id, updateChannelDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.channelsService.remove(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  getChannelMessages(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('before') before?: string
  ) {
    const limitNum = limit ? parseInt(limit) : 50;
    const offsetNum = offset ? parseInt(offset) : 0;
    const beforeNum = before ? parseInt(before) : undefined;
    return this.channelsService.getChannelMessages(
      id,
      req.user.id,
      limitNum,
      offsetNum,
      beforeNum
    );
  }
}
