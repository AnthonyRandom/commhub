import { useVoiceStore } from '../../stores/voice'
import { webrtcService } from '../webrtc'
import { useSettingsStore } from '../../stores/settings'
import { wsService } from '../websocket'
import { logger } from '../../utils/logger'

/**
 * Manages voice settings like mute, deafen, volume
 * Handles user audio controls and preferences
 */
export class VoiceSettingsManager {
  toggleMute(): void {
    const voiceStore = useVoiceStore.getState()

    // Can't unmute while deafened
    if (voiceStore.isDeafened && voiceStore.isMuted) {
      logger.warn('VoiceSettings', 'Cannot unmute while deafened')
      return
    }

    const newMutedState = !voiceStore.isMuted
    voiceStore.setIsMuted(newMutedState)
    webrtcService.setMuted(newMutedState)

    // Broadcast mute state to other users
    const socket = wsService.getSocket()
    const channelId = webrtcService.getCurrentChannelId()
    if (socket && channelId) {
      socket.emit('voice-user-muted', {
        channelId,
        isMuted: newMutedState,
      })
    }
  }

  toggleDeafen(): void {
    const voiceStore = useVoiceStore.getState()
    const newDeafenedState = !voiceStore.isDeafened
    voiceStore.setIsDeafened(newDeafenedState)
    webrtcService.setDeafened(newDeafenedState)

    // Broadcast deafen state to other users
    // When deafened, also broadcast muted state
    const socket = wsService.getSocket()
    const channelId = webrtcService.getCurrentChannelId()
    if (socket && channelId) {
      socket.emit('voice-user-muted', {
        channelId,
        isMuted: newDeafenedState || voiceStore.isMuted,
      })
    }
  }

  setUserLocalMuted(userId: number, muted: boolean): void {
    useVoiceStore.getState().setUserLocalMuted(userId, muted)
    webrtcService.setUserLocalMuted(userId, muted)
  }

  setUserVolume(userId: number, volume: number): void {
    const volumePercentage = Math.max(0, Math.min(200, volume))
    useVoiceStore.getState().setUserLocalVolume(userId, volumePercentage / 100)
    webrtcService.setUserVolume(userId, volumePercentage)
  }

  updateVoiceSettings(settings: { attenuation?: number; masterVolume?: number }): void {
    if (settings.attenuation !== undefined) {
      this.applyAttenuation(settings.attenuation)
    }

    if (settings.masterVolume !== undefined) {
      this.applyMasterVolume(settings.masterVolume)
    }
  }

  private applyMasterVolume(masterVolume: number): void {
    webrtcService.applyMasterVolumeToAll(masterVolume)
  }

  private applyAttenuation(attenuation: number): void {
    webrtcService.applyAttenuationToAll(attenuation)
  }

  setAttenuation(attenuation: number): void {
    this.applyAttenuation(attenuation)
    logger.info('VoiceSettings', 'Attenuation set', { attenuation })
  }

  setMasterVolume(volume: number): void {
    this.applyMasterVolume(volume)
    logger.info('VoiceSettings', 'Master volume set', { volume })
  }

  shouldPlaySounds(): boolean {
    return useSettingsStore.getState().sounds
  }
}

export const voiceSettingsManager = new VoiceSettingsManager()
