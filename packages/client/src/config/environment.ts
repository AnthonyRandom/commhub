/**
 * Environment configuration for CommHub client
 *
 * These values are loaded from environment variables at build time.
 * For local development, create a .env file in the client directory.
 *
 * Environment variables must be prefixed with VITE_ to be exposed to the client.
 */

export const config = {
  /**
   * WebSocket server URL for real-time communication
   * @default 'http://localhost:3000/chat' in development
   * @example 'https://commhub-production.up.railway.app/chat'
   */
  WS_URL: import.meta.env.VITE_WS_URL || 'https://commhub-production.up.railway.app/chat',

  /**
   * HTTP API server URL for REST endpoints
   * @default 'http://localhost:3000' in development
   * @example 'https://commhub-production.up.railway.app'
   */
  API_URL: import.meta.env.VITE_API_URL || 'https://commhub-production.up.railway.app',

  /**
   * Client application version (synced with package.json)
   */
  CLIENT_VERSION: import.meta.env.VITE_CLIENT_VERSION || '1.2.3',

  /**
   * Environment mode (development, production, test)
   */
  MODE: import.meta.env.MODE || 'development',

  /**
   * Whether the app is running in development mode
   */
  IS_DEV: import.meta.env.DEV,

  /**
   * Whether the app is running in production mode
   */
  IS_PROD: import.meta.env.PROD,
} as const

// Type-safe config access
export type Config = typeof config

// Validate required config on app initialization
export function validateConfig(): void {
  const errors: string[] = []

  if (!config.WS_URL) {
    errors.push('VITE_WS_URL is required')
  }

  if (!config.API_URL) {
    errors.push('VITE_API_URL is required')
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`)
  }

  // Log configuration in development
  if (config.IS_DEV) {
    console.log('[Config] Environment configuration loaded:', {
      WS_URL: config.WS_URL,
      API_URL: config.API_URL,
      CLIENT_VERSION: config.CLIENT_VERSION,
      MODE: config.MODE,
    })
  }
}

export default config
