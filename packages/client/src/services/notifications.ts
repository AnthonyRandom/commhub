import { invoke } from '@tauri-apps/api/tauri'

class NotificationService {
  private audioContext: AudioContext | null = null

  constructor() {
    // Initialize Web Audio API context (don't play anything yet)
    this.initializeAudioContext()
  }

  /**
   * Initialize the Web Audio API context
   */
  private initializeAudioContext() {
    try {
      // Just create the audio context, don't play anything
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn('[Notifications] Could not initialize Web Audio API:', error)
      this.audioContext = null
    }
  }

  /**
   * Show a desktop notification for a DM
   */
  async showDMNotification(
    senderName: string,
    message: string,
    settings: any,
    userStatus?: string
  ) {
    // Check if notifications are enabled
    if (!settings.notifications) {
      console.log('[Notifications] Notifications disabled, skipping DM notification')
      return
    }

    // Check if user is in Do Not Disturb mode
    if (userStatus === 'dnd') {
      console.log('[Notifications] User is in DND mode, suppressing notification')
      return
    }

    // Check if we're in a DM window with this user (don't notify for self-messages)
    const currentPath = window.location.pathname
    const isInDM = currentPath.includes('/dm/')

    if (isInDM) {
      console.log('[Notifications] User is in DM window, skipping notification')
      return
    }

    try {
      // Show desktop notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(`DM from ${senderName}`, {
          body: message,
          icon: '/icon.png', // You might want to use the app icon
          tag: 'commhub-dm', // Group similar notifications
        })

        // Auto-close after 5 seconds (if close method exists)
        setTimeout(() => {
          if (typeof notification.close === 'function') {
            notification.close()
          }
        }, 5000)
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        // Request permission if not already granted/denied
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          this.showDMNotification(senderName, message, settings, userStatus)
        }
      }

      // Play sound if enabled
      if (settings.sounds) {
        this.playNotificationSound()
      }

      // Flash taskbar (Windows-specific)
      this.flashTaskbar()
    } catch (error) {
      console.error('[Notifications] Failed to show DM notification:', error)
    }
  }

  /**
   * Play notification sound
   */
  playNotificationSound() {
    if (this.audioContext) {
      try {
        // Create a new beep sound
        const oscillator = this.audioContext.createOscillator()
        const gainNode = this.audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(this.audioContext.destination)

        // Configure beep sound (800Hz tone for 200ms)
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime)
        oscillator.type = 'sine'

        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2)

        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + 0.2)
      } catch (error) {
        console.warn('[Notifications] Failed to play notification sound:', error)
      }
    }
  }

  /**
   * Play mention sound (higher pitched for mentions)
   */
  async playMentionSound() {
    if (this.audioContext) {
      try {
        const oscillator = this.audioContext.createOscillator()
        const gainNode = this.audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(this.audioContext.destination)

        oscillator.frequency.value = 800 // Higher pitch for mentions
        oscillator.type = 'sine'

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5)

        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + 0.5)
      } catch (error) {
        console.error('[Notifications] Failed to play mention sound:', error)
      }
    }
  }

  /**
   * Flash the taskbar icon (Windows-specific)
   */
  async flashTaskbar() {
    try {
      // Use Tauri command to flash the taskbar
      // This would need to be implemented in the Tauri backend
      await invoke('flash_taskbar')
    } catch (error) {
      console.warn('[Notifications] Taskbar flashing not available:', error)
      // Fallback: could use document.title manipulation for basic flashing
      this.fallbackFlash()
    }
  }

  /**
   * Fallback flashing using document title
   */
  private fallbackFlash() {
    const originalTitle = document.title
    let isFlashing = true
    let flashCount = 0
    const maxFlashes = 6

    const flashInterval = setInterval(() => {
      document.title = isFlashing ? '🔔 New Message - CommHub' : originalTitle
      isFlashing = !isFlashing
      flashCount++

      if (flashCount >= maxFlashes) {
        clearInterval(flashInterval)
        document.title = originalTitle
      }
    }, 500)
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[Notifications] Browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      console.warn('[Notifications] Notification permission denied by user')
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return 'Notification' in window
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): string {
    if (!('Notification' in window)) {
      return 'not-supported'
    }
    return Notification.permission
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
export default notificationService
