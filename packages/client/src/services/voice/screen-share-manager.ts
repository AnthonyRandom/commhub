import { wsService } from '../websocket'
import { useVoiceStore } from '../../stores/voice'
import { logger } from '../../utils/logger'
import { handleError } from '../../utils/errors'

/**
 * Manages screen sharing functionality
 * Handles screen capture, track management, and signaling
 */
export class VoiceScreenShareManager {
  private screenShareStream: MediaStream | null = null
  private screenShareEnabled = false
  private currentChannelId: number | null = null

  /**
   * Enable screen sharing with optional audio capture
   */
  async enableScreenShare(captureAudio: boolean = false): Promise<void> {
    try {
      if (this.screenShareEnabled) {
        logger.warn('ScreenShareManager', 'Screen share already enabled')
        return
      }

      logger.info('ScreenShareManager', 'Enabling screen share...', { captureAudio })

      // Request display media
      const constraints: MediaStreamConstraints = {
        video: {
          cursor: 'always' as any,
        } as MediaTrackConstraints,
        audio: captureAudio,
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints)

      logger.info('ScreenShareManager', '✅ Got screen share stream:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      })

      this.screenShareStream = stream
      this.screenShareEnabled = true

      // Update voice store
      useVoiceStore.getState().setLocalScreenShareEnabled(true)
      useVoiceStore.getState().setLocalScreenShareStream(stream)

      // Listen for track ended (user stops sharing via browser UI)
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          logger.info('ScreenShareManager', 'Screen share track ended by user')
          this.disableScreenShare()
        })
      }

      // Notify server
      const channelId = this.currentChannelId
      if (channelId) {
        wsService.getSocket()?.emit('screen-share-enabled', { channelId })
      }

      logger.info('ScreenShareManager', 'Screen share enabled successfully')
    } catch (error) {
      logger.error('ScreenShareManager', 'Failed to enable screen share', { error })
      handleError(error instanceof Error ? error : new Error(String(error)), 'ScreenShareManager')
      throw error
    }
  }

  /**
   * Disable screen sharing
   */
  disableScreenShare(): void {
    try {
      if (!this.screenShareEnabled) {
        logger.warn('ScreenShareManager', 'Screen share not enabled')
        return
      }

      logger.info('ScreenShareManager', 'Disabling screen share...')

      // Stop all tracks
      if (this.screenShareStream) {
        this.screenShareStream.getTracks().forEach((track) => {
          track.stop()
          logger.debug('ScreenShareManager', `Stopped ${track.kind} track`)
        })
        this.screenShareStream = null
      }

      this.screenShareEnabled = false

      // Update voice store
      useVoiceStore.getState().setLocalScreenShareEnabled(false)
      useVoiceStore.getState().setLocalScreenShareStream(null)

      // Notify server
      const channelId = this.currentChannelId
      if (channelId) {
        wsService.getSocket()?.emit('screen-share-disabled', { channelId })
      }

      logger.info('ScreenShareManager', 'Screen share disabled successfully')
    } catch (error) {
      logger.error('ScreenShareManager', 'Error disabling screen share', { error })
      handleError(error instanceof Error ? error : new Error(String(error)), 'ScreenShareManager')
    }
  }

  /**
   * Check if screen share is enabled
   */
  isScreenShareEnabled(): boolean {
    return this.screenShareEnabled
  }

  /**
   * Get the current screen share stream
   */
  getScreenShareStream(): MediaStream | null {
    return this.screenShareStream
  }

  /**
   * Set the current channel ID for signaling
   */
  setCurrentChannelId(channelId: number | null): void {
    this.currentChannelId = channelId
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.screenShareEnabled) {
      this.disableScreenShare()
    }
    this.currentChannelId = null
  }
}

export const voiceScreenShareManager = new VoiceScreenShareManager()
