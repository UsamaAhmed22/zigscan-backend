import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

const configService = new ConfigService();

// Determine if we're running from compiled JS or TS
const isProduction = process.env.NODE_ENV === 'production';
const extension = isProduction ? 'js' : 'ts';
const basePath = isProduction ? 'dist' : 'src';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get<string>('POSTGRES_HOST', 'localhost'),
  port: configService.get<number>('POSTGRES_PORT', 5432),
  username: configService.get<string>('POSTGRES_USER', 'zigscan'),
  password: configService.get<string>('POSTGRES_PASSWORD', 'zigscan_password'),
  database: configService.get<string>('POSTGRES_DB', 'zigscan'),
  entities: [`${basePath}/database/entities/*.entity.${extension}`],
  migrations: [`${basePath}/database/migrations/*.${extension}`],
  synchronize: false,
  logging: configService.get<string>('TYPEORM_LOGGING', 'false') === 'true',
});
