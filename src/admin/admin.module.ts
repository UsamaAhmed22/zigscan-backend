import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClickhouseModule } from '../clickhouse/clickhouse.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, ClickhouseModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
