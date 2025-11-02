import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [JwtModule, MessagesModule, UsersModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
