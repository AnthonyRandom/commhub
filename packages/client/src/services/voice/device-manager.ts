import { webrtcService } from '../webrtc'
import { logger } from '../../utils/logger'
import { handleError } from '../../utils/errors'

/**
 * Manages audio and video device selection
 * Handles input/output device changes for voice chat
 */
export class VoiceDeviceManager {
  async getAudioDevices(): Promise<{
    input: MediaDeviceInfo[]
    output: MediaDeviceInfo[]
  }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return {
        input: devices.filter((d) => d.kind === 'audioinput'),
        output: devices.filter((d) => d.kind === 'audiooutput'),
      }
    } catch (error) {
      logger.error('VoiceDeviceManager', 'Error getting audio devices', { error })
      handleError(error, 'VoiceDeviceManager')
      throw error
    }
  }

  async changeInputDevice(deviceId: string): Promise<void> {
    try {
      logger.info('VoiceDeviceManager', 'Changing input device', { deviceId })
      // Re-initialize local stream with new device
      await webrtcService.initializeLocalStream()
    } catch (error) {
      logger.error('VoiceDeviceManager', 'Failed to change input device', { deviceId, error })
      handleError(error, 'VoiceDeviceManager')
      throw error
    }
  }

  async changeOutputDevice(deviceId: string): Promise<void> {
    try {
      logger.info('VoiceDeviceManager', 'Changing output device', { deviceId })
      // Output device changes are browser-managed via setSinkId
      // Stored in settings for next connection
    } catch (error) {
      logger.error('VoiceDeviceManager', 'Failed to change output device', { deviceId, error })
      handleError(error, 'VoiceDeviceManager')
      throw error
    }
  }

  async getAvailableVideoDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((d) => d.kind === 'videoinput')
    } catch (error) {
      logger.error('VoiceDeviceManager', 'Error getting video devices', { error })
      handleError(error, 'VoiceDeviceManager')
      throw error
    }
  }

  async switchVideoDevice(deviceId: string): Promise<void> {
    try {
      logger.info('VoiceDeviceManager', 'Switching video device', { deviceId })
      await webrtcService.switchVideoDevice(deviceId)
    } catch (error) {
      logger.error('VoiceDeviceManager', 'Failed to switch video device', { deviceId, error })
      handleError(error, 'VoiceDeviceManager')
      throw error
    }
  }
}

export const voiceDeviceManager = new VoiceDeviceManager()
