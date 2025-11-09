import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ConnectionHandler } from './handlers/connection.handler';
import { ChannelEventsHandler } from './handlers/channel-events.handler';
import { ChannelMessagesHandler } from './handlers/channel-messages.handler';
import { DirectMessagesHandler } from './handlers/direct-messages.handler';
import { PresenceHandler } from './handlers/presence.handler';
import { VoiceChannelManager } from './handlers/voice-channel.manager';
import { VoiceSignalingHandler } from './handlers/voice-signaling.handler';
import { UsersModule } from '../users/users.module';
import { MessagesModule } from '../messages/messages.module';
import { DirectMessagesModule } from '../direct-messages/direct-messages.module';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    forwardRef(() => UsersModule),
    forwardRef(() => MessagesModule),
    forwardRef(() => DirectMessagesModule),
    forwardRef(() => ChannelsModule),
    PrismaModule,
  ],
  providers: [
    ChatGateway,
    ConnectionHandler,
    ChannelEventsHandler,
    ChannelMessagesHandler,
    DirectMessagesHandler,
    PresenceHandler,
    VoiceChannelManager,
    VoiceSignalingHandler,
  ],
  exports: [ChatGateway],
})
export class GatewayModule {}
