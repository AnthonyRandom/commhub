/**
 * Application-wide constants
 *
 * This file centralizes magic numbers and configuration values
 * to improve maintainability and make the codebase more understandable.
 */

/**
 * Security and Authentication constants
 */
export const SECURITY = {
  // Password hashing
  BCRYPT_SALT_ROUNDS: 10,

  // JWT
  JWT_EXPIRATION: '24h',

  // Rate limiting
  DEFAULT_THROTTLE_TTL: 60000, // 1 minute in ms
  DEFAULT_THROTTLE_LIMIT: 10, // requests per TTL
  STRICT_THROTTLE_TTL: 60000, // 1 minute in ms
  STRICT_THROTTLE_LIMIT: 3, // requests per TTL for sensitive endpoints
} as const;

/**
 * Message and Content constants
 */
export const CONTENT = {
  // Message limits
  MAX_MESSAGE_LENGTH: 2000, // characters
  MAX_MESSAGES_PER_REQUEST: 100, // pagination limit
  DEFAULT_MESSAGE_LIMIT: 50,

  // Edit time window
  MESSAGE_EDIT_WINDOW: 15 * 60 * 1000, // 15 minutes in ms
} as const;

/**
 * WebRTC and Voice constants
 */
export const VOICE = {
  // Connection management
  MAX_RETRY_ATTEMPTS: 3,
  RECONNECT_DELAY_BASE: 2000, // ms
  CONNECTION_TIMEOUT: 30000, // ms

  // Quality monitoring
  QUALITY_CHECK_INTERVAL: 5000, // ms
  VIDEO_QUALITY_ADJUSTMENT_DELAY: 30000, // ms

  // Quality thresholds
  CRITICAL_PACKET_LOSS: 0.1, // 10%
  HIGH_PACKET_LOSS: 0.05, // 5%
  GOOD_PACKET_LOSS: 0.01, // 1%

  CRITICAL_JITTER: 0.1,
  HIGH_JITTER: 0.05,
  GOOD_JITTER: 0.02,
} as const;

/**
 * WebSocket constants
 */
export const WEBSOCKET = {
  // Reconnection
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY_MULTIPLIER: 2000, // ms, multiplied by attempt number

  // Timeouts
  CONNECTION_TIMEOUT: 10000, // ms
  PING_INTERVAL: 25000, // ms
  PING_TIMEOUT: 5000, // ms
} as const;

/**
 * Database query constants
 */
export const DATABASE = {
  // Pagination
  MAX_LIMIT: 100,
  DEFAULT_LIMIT: 50,
  DEFAULT_OFFSET: 0,
} as const;

/**
 * Server limits
 */
export const LIMITS = {
  // Per-server limits
  MAX_CHANNELS_PER_SERVER: 50,
  MAX_MEMBERS_PER_SERVER: 50, // MVP limit
  MAX_ROLES_PER_SERVER: 20,

  // Per-user limits
  MAX_SERVERS_PER_USER: 100,
  MAX_FRIENDS_PER_USER: 1000,

  // Content limits
  SERVER_NAME_MAX_LENGTH: 100,
  SERVER_DESCRIPTION_MAX_LENGTH: 500,
  CHANNEL_NAME_MAX_LENGTH: 100,
  USERNAME_MAX_LENGTH: 32,
  USERNAME_MIN_LENGTH: 3,
} as const;

/**
 * Cache TTLs (if/when caching is implemented)
 */
export const CACHE = {
  USER_PROFILE_TTL: 5 * 60, // 5 minutes in seconds
  SERVER_LIST_TTL: 2 * 60, // 2 minutes in seconds
  CHANNEL_LIST_TTL: 2 * 60, // 2 minutes in seconds
} as const;

/**
 * File Upload constants
 */
export const UPLOAD = {
  // File size limits
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB in bytes

  // Allowed MIME types
  ALLOWED_MIME_TYPES: [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    // Videos
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    // Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    // Documents
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar',
    // Executables
    'application/x-msdownload',
    'application/x-executable',
    'application/octet-stream',
  ] as readonly string[],

  // Compression settings
  COMPRESSION_QUALITY: 85,
  MAX_IMAGE_WIDTH: 2048,
  MAX_IMAGE_HEIGHT: 2048,
  VIDEO_TARGET_HEIGHT: 720,
  AUDIO_BITRATE: '128k',

  // Rate limiting
  MAX_UPLOADS_PER_MINUTE: 10,
} as const;

/**
 * HTTP status codes (for reference, Node/Express provide these too)
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Export all constants as a single object for convenience
 */
export const CONSTANTS = {
  SECURITY,
  CONTENT,
  VOICE,
  WEBSOCKET,
  DATABASE,
  LIMITS,
  CACHE,
  UPLOAD,
  HTTP_STATUS,
} as const;

export default CONSTANTS;
