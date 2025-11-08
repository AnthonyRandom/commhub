import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    // @ts-ignore - Monorepo TypeScript compatibility issue
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {
  constructor() {
    // Fail fast if JWT_SECRET is not configured
    if (!process.env.JWT_SECRET) {
      throw new Error(
        'CRITICAL: JWT_SECRET environment variable is not set! ' +
          'Application cannot start without a secure JWT secret. ' +
          'Please set JWT_SECRET in your environment variables.'
      );
    }
  }
}
