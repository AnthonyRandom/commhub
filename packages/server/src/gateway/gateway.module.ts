import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway.js';
import { MessagesModule } from '../messages/messages.module.js';
import { UsersModule } from '../users/users.module.js';
import { DirectMessagesModule } from '../direct-messages/direct-messages.module.js';

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
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
