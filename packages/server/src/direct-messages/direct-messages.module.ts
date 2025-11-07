import { Module, forwardRef } from '@nestjs/common';
import { DirectMessagesService } from './direct-messages.service';
import { DirectMessagesController } from './direct-messages.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PrismaModule, forwardRef(() => GatewayModule)],
  controllers: [DirectMessagesController],
  providers: [DirectMessagesService],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}
