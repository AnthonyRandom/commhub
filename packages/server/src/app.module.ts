import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ServersModule } from './servers/servers.module';
import { ChannelsModule } from './channels/channels.module';
import { MessagesModule } from './messages/messages.module';
import { GatewayModule } from './gateway/gateway.module';
import { FriendRequestsModule } from './friend-requests/friend-requests.module';
import { DirectMessagesModule } from './direct-messages/direct-messages.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute for general endpoints
      },
      {
        name: 'strict',
        ttl: 60000,
        limit: 3, // 3 requests per minute for sensitive endpoints
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ServersModule,
    ChannelsModule,
    MessagesModule,
    GatewayModule,
    FriendRequestsModule,
    DirectMessagesModule,
  ],
})
export class AppModule {}
