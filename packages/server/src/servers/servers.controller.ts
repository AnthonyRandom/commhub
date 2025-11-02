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
import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';
import { JoinServerDto } from './dto/join-server.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createServerDto: CreateServerDto, @Request() req) {
    return this.serversService.create(createServerDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req) {
    return this.serversService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.serversService.findOne(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateServerDto: Partial<CreateServerDto>,
    @Request() req
  ) {
    return this.serversService.update(id, updateServerDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.serversService.remove(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('join')
  join(@Body() joinServerDto: JoinServerDto, @Request() req) {
    return this.serversService.join(joinServerDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  leave(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.serversService.leave(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/invite')
  getInviteCode(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.serversService.getInviteCode(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/invite/regenerate')
  regenerateInviteCode(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.serversService.regenerateInviteCode(id, req.user.id);
  }
}
