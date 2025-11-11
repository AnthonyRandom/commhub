import {
  Controller,
  Post,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UPLOAD } from '../config/constants';
import * as path from 'path';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'uploads', 'temp'),
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            file.fieldname +
              '-' +
              uniqueSuffix +
              path.extname(file.originalname)
          );
        },
      }),
      limits: {
        fileSize: UPLOAD.MAX_FILE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        // Basic MIME type check (will be validated further in service)
        if (UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `File type ${file.mimetype} is not allowed`
            ),
            false
          );
        }
      },
    })
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('channelId', ParseIntPipe) channelId: number,
    @Request() req
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.uploadsService.uploadFile(file, req.user.id, channelId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req
  ) {
    return this.uploadsService.deleteAttachment(id, req.user.id);
  }
}
