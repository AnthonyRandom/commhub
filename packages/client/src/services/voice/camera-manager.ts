import { useVoiceStore } from '../../stores/voice'
import { webrtcService } from '../webrtc'
import { wsService } from '../websocket'
import { voiceDeviceManager } from './device-manager'
import { logger } from '../../utils/logger'
import { handleError } from '../../utils/errors'

/**
 * Manages camera/video functionality in voice channels
 * Handles enabling, disabling, and device switching for video
 */
export class VoiceCameraManager {
  async enableCamera(): Promise<void> {
    try {
      const channelId = useVoiceStore.getState().connectedChannelId
      if (!channelId) {
        throw new Error('Not connected to a voice channel')
      }

      logger.info('VoiceCamera', 'Enabling camera for channel', { channelId })

      // Enable video in WebRTC
      await webrtcService.enableCamera()

      // Notify server
      wsService.getSocket()?.emit('enable-camera', { channelId })

      // Update local store
      useVoiceStore.getState().setLocalVideoEnabled(true)

      logger.info('VoiceCamera', 'Camera enabled successfully', { channelId })
    } catch (error) {
      logger.error('VoiceCamera', 'Failed to enable camera', { error })
      handleError(error, 'VoiceCamera')
      throw error
    }
  }

  async disableCamera(): Promise<void> {
    try {
      const channelId = useVoiceStore.getState().connectedChannelId
      if (!channelId) {
        throw new Error('Not connected to a voice channel')
      }

      logger.info('VoiceCamera', 'Disabling camera for channel', { channelId })

      // Disable video in WebRTC
      await webrtcService.disableCamera()

      // Notify server
      wsService.getSocket()?.emit('disable-camera', { channelId })

      // Update local store
      useVoiceStore.getState().setLocalVideoEnabled(false)

      logger.info('VoiceCamera', 'Camera disabled successfully', { channelId })
    } catch (error) {
      logger.error('VoiceCamera', 'Failed to disable camera', { error })
      handleError(error, 'VoiceCamera')
      throw error
    }
  }

  isCameraEnabled(): boolean {
    return useVoiceStore.getState().localVideoEnabled
  }

  async getAvailableVideoDevices(): Promise<MediaDeviceInfo[]> {
    return voiceDeviceManager.getAvailableVideoDevices()
  }

  async switchVideoDevice(deviceId: string): Promise<void> {
    return voiceDeviceManager.switchVideoDevice(deviceId)
  }

  handleCameraEnabled(data: { channelId: number; userId: number; username: string }): void {
    logger.info('VoiceCamera', 'User enabled camera', {
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
    })
    useVoiceStore.getState().updateUserVideo(data.userId, true)
  }

  handleCameraDisabled(data: { channelId: number; userId: number; username: string }): void {
    logger.info('VoiceCamera', 'User disabled camera', {
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
    })
    useVoiceStore.getState().updateUserVideo(data.userId, false)
  }
}

export const voiceCameraManager = new VoiceCameraManager()
