import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import { UPLOAD } from '../config/constants';

@Injectable()
export class CompressionService {
  private logger = new Logger('CompressionService');

  /**
   * Compress a file based on its MIME type
   */
  async compressFile(
    filePath: string,
    mimeType: string
  ): Promise<{ compressedPath: string; size: number }> {
    try {
      if (mimeType.startsWith('image/')) {
        return await this.compressImage(filePath, mimeType);
      } else if (mimeType.startsWith('video/')) {
        return await this.compressVideo(filePath);
      } else if (mimeType.startsWith('audio/')) {
        return await this.compressAudio(filePath);
      } else {
        // No compression for other file types
        const stats = await fs.stat(filePath);
        return { compressedPath: filePath, size: stats.size };
      }
    } catch (error) {
      this.logger.error('Error compressing file:', error.message);
      // Return original file if compression fails
      const stats = await fs.stat(filePath);
      return { compressedPath: filePath, size: stats.size };
    }
  }

  /**
   * Compress an image file using Sharp
   */
  private async compressImage(
    filePath: string,
    mimeType: string
  ): Promise<{ compressedPath: string; size: number }> {
    try {
      const ext = path.extname(filePath);
      const compressedPath = filePath.replace(ext, `-compressed${ext}`);

      // Skip compression for GIFs to preserve animation
      if (mimeType === 'image/gif') {
        const stats = await fs.stat(filePath);
        return { compressedPath: filePath, size: stats.size };
      }

      const image = sharp(filePath);
      const metadata = await image.metadata();

      // Only resize if image is larger than max dimensions
      const needsResize =
        metadata.width > UPLOAD.MAX_IMAGE_WIDTH ||
        metadata.height > UPLOAD.MAX_IMAGE_HEIGHT;

      let pipeline = image;

      if (needsResize) {
        pipeline = pipeline.resize(
          UPLOAD.MAX_IMAGE_WIDTH,
          UPLOAD.MAX_IMAGE_HEIGHT,
          {
            fit: 'inside',
            withoutEnlargement: true,
          }
        );
      }

      // Convert to WebP for better compression, except for PNG with transparency
      if (mimeType === 'image/png' && metadata.hasAlpha) {
        await pipeline
          .png({ quality: UPLOAD.COMPRESSION_QUALITY, compressionLevel: 9 })
          .toFile(compressedPath);
      } else {
        await pipeline
          .webp({ quality: UPLOAD.COMPRESSION_QUALITY })
          .toFile(compressedPath.replace(ext, '.webp'));
        // Update compressed path to .webp
        return this.getFileStats(compressedPath.replace(ext, '.webp'));
      }

      // Delete original file
      await fs.unlink(filePath).catch(() => {});

      return this.getFileStats(compressedPath);
    } catch (error) {
      this.logger.error('Error compressing image:', error.message);
      const stats = await fs.stat(filePath);
      return { compressedPath: filePath, size: stats.size };
    }
  }

  /**
   * Compress a video file using FFmpeg
   */
  private async compressVideo(
    filePath: string
  ): Promise<{ compressedPath: string; size: number }> {
    return new Promise(async resolve => {
      try {
        const ext = path.extname(filePath);
        const compressedPath = filePath.replace(ext, '-compressed.mp4');

        ffmpeg(filePath)
          .output(compressedPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .size(`?x${UPLOAD.VIDEO_TARGET_HEIGHT}`)
          .videoBitrate('1000k')
          .audioBitrate('128k')
          .on('end', async () => {
            this.logger.log('Video compression completed');
            // Delete original file
            await fs.unlink(filePath).catch(() => {});
            const result = await this.getFileStats(compressedPath);
            resolve(result);
          })
          .on('error', async error => {
            this.logger.error('Error compressing video:', error.message);
            const stats = await fs.stat(filePath);
            resolve({ compressedPath: filePath, size: stats.size });
          })
          .run();
      } catch (error) {
        this.logger.error('Error setting up video compression:', error.message);
        const stats = await fs.stat(filePath);
        resolve({ compressedPath: filePath, size: stats.size });
      }
    });
  }

  /**
   * Compress an audio file using FFmpeg
   */
  private async compressAudio(
    filePath: string
  ): Promise<{ compressedPath: string; size: number }> {
    return new Promise(async resolve => {
      try {
        const ext = path.extname(filePath);
        const compressedPath = filePath.replace(ext, '-compressed.mp3');

        ffmpeg(filePath)
          .output(compressedPath)
          .audioCodec('libmp3lame')
          .audioBitrate(UPLOAD.AUDIO_BITRATE)
          .on('end', async () => {
            this.logger.log('Audio compression completed');
            // Delete original file
            await fs.unlink(filePath).catch(() => {});
            const result = await this.getFileStats(compressedPath);
            resolve(result);
          })
          .on('error', async error => {
            this.logger.error('Error compressing audio:', error.message);
            const stats = await fs.stat(filePath);
            resolve({ compressedPath: filePath, size: stats.size });
          })
          .run();
      } catch (error) {
        this.logger.error('Error setting up audio compression:', error.message);
        const stats = await fs.stat(filePath);
        resolve({ compressedPath: filePath, size: stats.size });
      }
    });
  }

  /**
   * Get file stats helper
   */
  private async getFileStats(
    filePath: string
  ): Promise<{ compressedPath: string; size: number }> {
    const stats = await fs.stat(filePath);
    return { compressedPath: filePath, size: stats.size };
  }

  /**
   * Clean up temporary files
   */
  async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.warn('Failed to cleanup file:', error.message);
    }
  }
}
