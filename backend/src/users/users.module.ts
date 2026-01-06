import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SessionService } from './session.service';
import { EmailService } from './email.service';
import { User } from '../database/entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'your-super-secret-jwt-key-change-this-in-production',
        ),
        signOptions: {
          expiresIn: '24h',
        },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, SessionService, EmailService, JwtAuthGuard, JwtStrategy],
  exports: [UsersService, JwtStrategy, PassportModule],
})
export class UsersModule {}
