import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DefiController } from './defi.controller';
import { DefiService } from './defi.service';

@Module({
  imports: [AuthModule],
  controllers: [DefiController],
  providers: [DefiService],
  exports: [DefiService],
})
export class DefiModule {}
