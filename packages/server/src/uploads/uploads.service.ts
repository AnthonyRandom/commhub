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
  /**
   * Upload directory path.
   * Uses Railway volume mount if UPLOADS_DIR is set, otherwise falls back to process.cwd()/uploads for local development.
   * Railway volume should be mounted at /data/uploads for persistent storage.
   */
  private readonly uploadDir: string;

  constructor(private prisma: PrismaService) {
    // Use Railway volume mount if available, otherwise use local uploads directory
    this.uploadDir =
      process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

    // Log the upload directory being used
    this.logger.log(`Using upload directory: ${this.uploadDir}`);

    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
      this.logger.log(`Upload directory exists: ${this.uploadDir}`);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }

    // Also ensure temp directory exists
    const tempDir = path.join(this.uploadDir, 'temp');
    try {
      await fs.access(tempDir);
    } catch {
      await fs.mkdir(tempDir, { recursive: true });
      this.logger.log(`Created temp directory: ${tempDir}`);
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
   * Upload and process a file for direct messages
   */
  async uploadFileForDM(
    file: Express.Multer.File,
    userId: number,
    receiverId: number
  ) {
    // Same logic as uploadFile, but for DMs (no channelId needed)
    return this.uploadFile(file, userId, 0); // Use 0 as placeholder channelId
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
    // Extract filename from URL (e.g., /uploads/filename.ext -> filename.ext)
    const filename = path.basename(attachment.url);
    const filePath = path.join(this.uploadDir, filename);

    try {
      // Check if file exists before attempting to delete
      await fs.access(filePath);
      await fs.unlink(filePath);
      this.logger.log(`Deleted file from disk: ${filePath}`);
    } catch (error) {
      // File might not exist (already deleted or never existed)
      // Log warning but continue with database deletion
      this.logger.warn(
        `File not found or could not be deleted: ${filePath}. Error: ${error.message}`
      );
    }

    // Delete from database
    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    this.logger.log(`Deleted attachment ${attachmentId} from database`);

    return { message: 'Attachment deleted successfully' };
  }

  /**
   * Clean up orphaned files (files uploaded but not attached to messages)
   * This should be run periodically
   *
   * NOTE: This checks for attachments linked to BOTH Message and DirectMessage records.
   * Only deletes files that are:
   * 1. Older than 1 hour
   * 2. Not referenced in any Attachment record (regardless of message type)
   */
  async cleanupOrphanedFiles() {
    try {
      const files = await fs.readdir(this.uploadDir);
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);

        // Skip temp directory
        if (file === 'temp') continue;

        try {
          const stats = await fs.stat(filePath);

          // Skip directories
          if (stats.isDirectory()) continue;

          // Check if file is older than 1 hour
          if (now - stats.mtimeMs > ONE_HOUR) {
            // Check if file exists in database (checks both Message and DirectMessage attachments)
            const exists = await this.prisma.attachment.findFirst({
              where: {
                url: `/uploads/${file}`,
              },
            });

            if (!exists) {
              this.logger.log(`Cleaning up orphaned file: ${file}`);
              await fs.unlink(filePath).catch(err => {
                this.logger.warn(
                  `Failed to delete orphaned file ${file}:`,
                  err.message
                );
              });
            }
          }
        } catch (statError) {
          // File might have been deleted already or doesn't exist
          this.logger.debug(`Skipping file ${file}:`, statError.message);
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up orphaned files:', error.message);
    }
  }
}
