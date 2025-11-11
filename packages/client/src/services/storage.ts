import { readTextFile, writeTextFile, exists, createDir, removeFile } from '@tauri-apps/api/fs'
import { appConfigDir } from '@tauri-apps/api/path'
import { logger } from '../utils/logger'

/**
 * Persistent storage service using Tauri's filesystem API
 * This ensures data persists across app updates, unlike localStorage
 */
class StorageService {
  private configDir: string | null = null
  private authFile = 'auth.json'

  /**
   * Initialize storage directory
   */
  private async ensureConfigDir(): Promise<string> {
    if (this.configDir) {
      return this.configDir
    }

    try {
      const configDirPath = await appConfigDir()
      const commhubDir = `${configDirPath}commhub`

      // Check if directory exists, create if not
      const dirExists = await exists(commhubDir)
      if (!dirExists) {
        await createDir(commhubDir, { recursive: true })
        logger.info('Storage', 'Created CommHub config directory', { path: commhubDir })
      }

      this.configDir = commhubDir
      return commhubDir
    } catch (error) {
      logger.error('Storage', 'Failed to initialize config directory', { error })
      // Fallback to localStorage if Tauri API fails
      throw error
    }
  }

  /**
   * Get full path to auth file
   */
  private async getAuthFilePath(): Promise<string> {
    const dir = await this.ensureConfigDir()
    return `${dir}/${this.authFile}`
  }

  /**
   * Save authentication data
   */
  async saveAuth(token: string, user: any): Promise<void> {
    try {
      const filePath = await this.getAuthFilePath()
      const data = { token, user, timestamp: Date.now() }
      await writeTextFile(filePath, JSON.stringify(data))
      logger.info('Storage', 'Saved auth data', { filePath })
    } catch (error) {
      logger.error('Storage', 'Failed to save auth data', { error })
      // Fallback to localStorage
      localStorage.setItem('auth_token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }
  }

  /**
   * Load authentication data
   */
  async loadAuth(): Promise<{ token: string | null; user: any | null }> {
    try {
      const filePath = await this.getAuthFilePath()
      const fileExists = await exists(filePath)

      if (!fileExists) {
        // Try to migrate from localStorage if it exists
        const oldToken = localStorage.getItem('auth_token')
        const oldUser = localStorage.getItem('user')
        if (oldToken && oldUser) {
          logger.info('Storage', 'Migrating auth data from localStorage')
          await this.saveAuth(oldToken, JSON.parse(oldUser))
          return { token: oldToken, user: JSON.parse(oldUser) }
        }
        return { token: null, user: null }
      }

      const content = await readTextFile(filePath)
      const data = JSON.parse(content)
      logger.info('Storage', 'Loaded auth data', { hasToken: !!data.token, hasUser: !!data.user })
      return { token: data.token || null, user: data.user || null }
    } catch (error) {
      logger.error('Storage', 'Failed to load auth data', { error })
      // Fallback to localStorage
      const token = localStorage.getItem('auth_token')
      const userStr = localStorage.getItem('user')
      return {
        token,
        user: userStr ? JSON.parse(userStr) : null,
      }
    }
  }

  /**
   * Remove authentication data
   */
  async removeAuth(): Promise<void> {
    try {
      const filePath = await this.getAuthFilePath()
      const fileExists = await exists(filePath)
      if (fileExists) {
        await removeFile(filePath)
        logger.info('Storage', 'Removed auth data', { filePath })
      }
    } catch (error) {
      logger.error('Storage', 'Failed to remove auth data', { error })
    }

    // Also clear localStorage as fallback
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
  }
}

export const storageService = new StorageService()
