import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { ServersModule } from './servers/servers.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { GatewayModule } from './gateway/gateway.module.js';

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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
