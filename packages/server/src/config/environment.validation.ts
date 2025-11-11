/**
 * Environment variable validation for CommHub server
 *
 * This module validates that all required environment variables are set
 * before the application starts. This prevents runtime errors from missing config.
 */

interface EnvironmentConfig {
  // Database
  DATABASE_URL: string;

  // Security
  JWT_SECRET: string;

  // Server configuration
  PORT?: string;
  NODE_ENV?: string;
  MIN_CLIENT_VERSION?: string;

  // CORS
  ALLOWED_ORIGINS?: string;

  // HTTPS (optional)
  HTTPS_ENABLED?: string;
  SSL_KEY_PATH?: string;
  SSL_CERT_PATH?: string;

  // External APIs (optional)
  TENOR_API_KEY?: string;

  // File storage (optional)
  UPLOADS_DIR?: string; // Path to persistent uploads directory (e.g., /data/uploads for Railway volumes)

  // Rate limiting (optional)
  THROTTLE_TTL?: string;
  THROTTLE_LIMIT?: string;
}

/**
 * Validates required environment variables
 * @throws Error if any required variables are missing or invalid
 */
export function validateEnvironmentConfig(): EnvironmentConfig {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required for database connection');
  }

  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required for authentication security');
  }

  // Validate JWT_SECRET strength (minimum 32 characters recommended)
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push(
      `JWT_SECRET is too short (${process.env.JWT_SECRET.length} characters). Recommended: at least 32 characters for security.`
    );
  }

  // Validate NODE_ENV
  const validEnvironments = ['development', 'production', 'test'];
  if (
    process.env.NODE_ENV &&
    !validEnvironments.includes(process.env.NODE_ENV)
  ) {
    warnings.push(
      `NODE_ENV "${process.env.NODE_ENV}" is not standard. Expected: ${validEnvironments.join(', ')}`
    );
  }

  // Validate HTTPS configuration
  if (process.env.HTTPS_ENABLED === 'true') {
    if (!process.env.SSL_KEY_PATH || !process.env.SSL_CERT_PATH) {
      if (process.env.NODE_ENV === 'production') {
        errors.push(
          'HTTPS_ENABLED is true but SSL_KEY_PATH and SSL_CERT_PATH are not set'
        );
      } else {
        warnings.push(
          'HTTPS_ENABLED is true but SSL certificates are not configured. Will fall back to HTTP.'
        );
      }
    }
  }

  // Validate Tenor API key if GIF features are being used
  if (!process.env.TENOR_API_KEY) {
    warnings.push(
      'TENOR_API_KEY is not set. GIF search functionality will not work.'
    );
  }

  // Validate rate limiting configuration
  if (process.env.THROTTLE_TTL) {
    const ttl = parseInt(process.env.THROTTLE_TTL, 10);
    if (isNaN(ttl) || ttl <= 0) {
      warnings.push(
        `THROTTLE_TTL "${process.env.THROTTLE_TTL}" is not a valid positive number`
      );
    }
  }

  if (process.env.THROTTLE_LIMIT) {
    const limit = parseInt(process.env.THROTTLE_LIMIT, 10);
    if (isNaN(limit) || limit <= 0) {
      warnings.push(
        `THROTTLE_LIMIT "${process.env.THROTTLE_LIMIT}" is not a valid positive number`
      );
    }
  }

  // Validate PORT
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(
        `PORT "${process.env.PORT}" is not a valid port number (1-65535)`
      );
    }
  }

  // Validate MIN_CLIENT_VERSION format (semantic versioning)
  if (process.env.MIN_CLIENT_VERSION) {
    const semverPattern = /^\d+\.\d+\.\d+$/;
    if (!semverPattern.test(process.env.MIN_CLIENT_VERSION)) {
      warnings.push(
        `MIN_CLIENT_VERSION "${process.env.MIN_CLIENT_VERSION}" does not follow semantic versioning (e.g., 1.0.0)`
      );
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Environment Configuration Warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.warn('');
  }

  // Throw error if any required variables are missing
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment Configuration Errors:',
      ...errors.map(error => `   - ${error}`),
      '',
      'Please set the required environment variables and restart the server.',
      'See docker.env.example for reference.',
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Log success
  console.log('✅ Environment configuration validated successfully');
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Port: ${process.env.PORT || 3000}`);
  console.log(
    `   HTTPS: ${process.env.HTTPS_ENABLED === 'true' ? 'enabled' : 'disabled'}`
  );
  console.log(
    `   Database: ${process.env.DATABASE_URL ? 'configured' : 'not configured'}`
  );
  console.log('');

  return process.env as unknown as EnvironmentConfig;
}

/**
 * Get a validated environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return process.env as unknown as EnvironmentConfig;
}
