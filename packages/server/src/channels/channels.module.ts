import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service.js';
import { ChannelsController } from './channels.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
