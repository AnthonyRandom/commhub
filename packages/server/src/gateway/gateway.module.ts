import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { DirectMessagesModule } from '../direct-messages/direct-messages.module';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    // @ts-ignore - Monorepo TypeScript compatibility issue
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
    MessagesModule,
    UsersModule,
    DirectMessagesModule,
    ChannelsModule,
    PrismaModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
