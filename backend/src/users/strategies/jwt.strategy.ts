import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users.service';

export interface JwtPayload {
  sub: string; // user id
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'your-super-secret-jwt-key-change-this-in-production',
      ),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found or session expired');
    }

    // Attach user to request
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isVerified: user.isVerified,
    };
  }
}
