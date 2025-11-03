import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    httpsOptions: getHttpsOptions(),
  });

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // Enable CORS with restricted origins for security
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:1420', // Add Vite dev server port
    ], // Default for development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  // Note: ThrottlerGuard is automatically applied globally through ThrottlerModule configuration

  // Enable global validation with transformation and sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that do not have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are provided
      transform: true, // Transform payload to DTO instances
      disableErrorMessages: process.env.NODE_ENV === 'production', // Hide error messages in production
    })
  );

  await app.listen(process.env.PORT || 3000);
}

function getHttpsOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const httpsEnabled = process.env.HTTPS_ENABLED === 'true';

  if (!httpsEnabled) {
    return undefined; // Use HTTP
  }

  if (isProduction) {
    // In production, use certificates from environment variables or files
    const keyPath = process.env.SSL_KEY_PATH;
    const certPath = process.env.SSL_CERT_PATH;

    if (!keyPath || !certPath) {
      console.warn(
        'HTTPS enabled but SSL_KEY_PATH and SSL_CERT_PATH not provided. Falling back to HTTP.'
      );
      return undefined;
    }

    return {
      key: fs.readFileSync(path.resolve(keyPath)),
      cert: fs.readFileSync(path.resolve(certPath)),
    };
  } else {
    // In development, use self-signed certificates or generate them
    try {
      const keyPath = path.join(__dirname, '../ssl/key.pem');
      const certPath = path.join(__dirname, '../ssl/cert.pem');

      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        };
      } else {
        console.warn(
          'HTTPS enabled but SSL certificates not found in development. Run: npm run generate-ssl'
        );
        return undefined;
      }
    } catch (error) {
      console.warn('Error loading SSL certificates:', error.message);
      return undefined;
    }
  }
}

bootstrap();
