import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway.js';
import { MessagesModule } from '../messages/messages.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [JwtModule, MessagesModule, UsersModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
