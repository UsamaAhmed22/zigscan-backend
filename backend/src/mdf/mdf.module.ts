import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { MdfController } from './mdf.controller';
import { MdfService } from './mdf.service';

@Module({
  imports: [AuthModule, HttpModule],
  controllers: [MdfController],
  providers: [MdfService],
  exports: [MdfService],
})
export class MdfModule {}
