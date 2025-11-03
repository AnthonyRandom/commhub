import { Module } from '@nestjs/common';
import { TenorController } from './tenor.controller';
import { TenorService } from './tenor.service';

@Module({
  controllers: [TenorController],
  providers: [TenorService],
  exports: [TenorService],
})
export class TenorModule {}
