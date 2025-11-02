import { Module } from '@nestjs/common';
import { ServersService } from './servers.service.js';
import { ServersController } from './servers.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ServersController],
  providers: [ServersService],
  exports: [ServersService],
})
export class ServersModule {}
