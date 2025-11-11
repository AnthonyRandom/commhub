import { Module } from '@nestjs/common';
import { SavedGifsController } from './saved-gifs.controller';
import { SavedGifsService } from './saved-gifs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SavedGifsController],
  providers: [SavedGifsService],
  exports: [SavedGifsService],
})
export class SavedGifsModule {}
