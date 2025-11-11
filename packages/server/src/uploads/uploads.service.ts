import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UPLOAD } from '../config/constants';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';

@Injectable()
export class UploadsService {
  private logger = new Logger('UploadsService');
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService) {
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Validate file type and size
   */
  async validateFile(file: Express.Multer.File): Promise<void> {
    // Check file size
    if (file.size > UPLOAD.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${UPLOAD.MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // Validate MIME type using file-type library for security
    const buffer = await fs.readFile(file.path);
    const fileType = await fileTypeFromBuffer(buffer);

    // For text files and some types, file-type returns null
    if (fileType && !UPLOAD.ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      await fs.unlink(file.path).catch(() => {});
      throw new BadRequestException(
        `File type ${fileType.mime} is not allowed`
      );
    }

    // Additional validation for MIME type from multer
    if (!UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      // Allow if file-type validation passed but multer MIME is different (common for text files)
      if (fileType && UPLOAD.ALLOWED_MIME_TYPES.includes(fileType.mime)) {
        return;
      }
      await fs.unlink(file.path).catch(() => {});
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`
      );
    }
  }

  /**
   * Sanitize filename to prevent path traversal attacks
   */
  sanitizeFilename(filename: string): string {
    // Remove any path components
    const baseName = path.basename(filename);
    // Replace any non-alphanumeric characters (except dots, dashes, underscores) with underscores
    return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Upload and process a file
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: number,
    channelId: number
  ) {
    try {
      // Validate file
      await this.validateFile(file);

      // Sanitize filename
      const sanitizedFilename = this.sanitizeFilename(file.originalname);

      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(file.originalname) || '';
      const filenameWithoutExt = sanitizedFilename.replace(/\.[^/.]+$/, '');
      const uniqueFilename = `${timestamp}-${userId}-${filenameWithoutExt}${ext}`;
      const finalPath = path.join(this.uploadDir, uniqueFilename);

      // Move file to final location
      await fs.rename(file.path, finalPath);

      // Get file stats
      const stats = await fs.stat(finalPath);

      // Create relative URL for serving
      const fileUrl = `/uploads/${uniqueFilename}`;

      // Note: We don't create the attachment in database here
      // It will be created when the message is sent
      return {
        url: fileUrl,
        filename: sanitizedFilename,
        mimeType: file.mimetype,
        size: stats.size,
      };
    } catch (error) {
      // Clean up file on error
      if (file.path) {
        await fs.unlink(file.path).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Create attachment record in database
   */
  async createAttachment(
    url: string,
    filename: string,
    mimeType: string,
    size: number,
    messageId: number,
    userId: number
  ) {
    return this.prisma.attachment.create({
      data: {
        url,
        filename,
        mimeType,
        size,
        messageId,
        uploadedBy: userId,
      },
    });
  }

  /**
   * Get attachments for a message
   */
  async getMessageAttachments(messageId: number) {
    return this.prisma.attachment.findMany({
      where: { messageId },
      select: {
        id: true,
        url: true,
        filename: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: number, userId: number) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            channel: {
              include: {
                server: true,
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Check if user is the uploader or message author
    if (
      attachment.uploadedBy !== userId &&
      attachment.message.userId !== userId
    ) {
      throw new BadRequestException(
        'You do not have permission to delete this attachment'
      );
    }

    // Delete file from disk
    const filePath = path.join(this.uploadDir, path.basename(attachment.url));
    await fs.unlink(filePath).catch(() => {});

    // Delete from database
    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    return { message: 'Attachment deleted successfully' };
  }

  /**
   * Clean up orphaned files (files uploaded but not attached to messages)
   * This should be run periodically
   */
  async cleanupOrphanedFiles() {
    try {
      const files = await fs.readdir(this.uploadDir);
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = await fs.stat(filePath);

        // Check if file is older than 1 hour
        if (now - stats.mtimeMs > ONE_HOUR) {
          // Check if file exists in database
          const exists = await this.prisma.attachment.findFirst({
            where: {
              url: `/uploads/${file}`,
            },
          });

          if (!exists) {
            this.logger.log(`Cleaning up orphaned file: ${file}`);
            await fs.unlink(filePath).catch(() => {});
          }
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up orphaned files:', error.message);
    }
  }
}
