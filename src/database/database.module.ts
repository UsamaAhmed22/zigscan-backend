import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TvlSnapshot } from './entities/tvl-snapshot.entity';
import { User } from './entities/user.entity';
import { SavedItem } from './entities/saved-item.entity';
import { SshTunnelService } from './ssh-tunnel.service';
import { ApiKey } from './entities/api-key.entity';
import { ApiRequestLog } from './entities/api-request-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST', 'localhost'),
        port: configService.get<number>('POSTGRES_PORT', 5432),
        username: configService.get<string>('POSTGRES_USER', 'postgres'),
        password: configService.get<string>('POSTGRES_PASSWORD', 'Beenco@123'),
        database: configService.get<string>('POSTGRES_DB', 'saad_test_db'),
        entities: [TvlSnapshot, User, SavedItem, ApiKey, ApiRequestLog],
        synchronize: configService.get<string>('TYPEORM_SYNC', 'false') === 'true',
        logging: configService.get<string>('TYPEORM_LOGGING') === 'true',
        ssl:
          configService.get<string>('POSTGRES_SSL') === 'true'
            ? {
                rejectUnauthorized: false,
              }
            : false,
      }),
    }),
    TypeOrmModule.forFeature([TvlSnapshot, User, SavedItem, ApiKey, ApiRequestLog]),
  ],
  providers: [SshTunnelService],
  exports: [TypeOrmModule, SshTunnelService],
})
export class DatabaseModule {}
