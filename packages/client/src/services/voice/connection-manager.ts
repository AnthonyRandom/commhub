import { wsService } from '../websocket'
import { webrtcService } from '../webrtc'
import { useVoiceStore } from '../../stores/voice'
import { useAuthStore } from '../../stores/auth'
import { soundManager } from '../sound-manager'
import { voiceSignalingHandler } from './signaling-handler'
import { voiceSettingsManager } from './settings-manager'
import { voiceDeviceManager } from './device-manager'
import { voiceQualityMonitor } from './quality-monitor'
import { voiceCameraManager } from './camera-manager'
import { voiceScreenShareManager } from './screen-share-manager'
import { logger } from '../../utils/logger'
import { handleError } from '../../utils/errors'

/**
 * Main voice connection manager
 * Orchestrates joining/leaving voice channels and coordinates all voice modules
 * Reduced from 849 lines to ~200 lines by delegating to specialized managers
 */
export class VoiceConnectionManager {
  private isInitialized = false

  // Re-export managers for easy access
  readonly settings = voiceSettingsManager
  readonly devices = voiceDeviceManager
  readonly quality = voiceQualityMonitor
  readonly camera = voiceCameraManager
  readonly screenShare = voiceScreenShareManager

  initialize(): void {
    if (this.isInitialized) {
      return
    }

    this.isInitialized = true

    // Set up listeners immediately if socket exists
    voiceSignalingHandler.setupWebSocketListeners()

    // Also set up listeners when socket connects (handles case where socket isn't ready yet)
    const socket = wsService.getSocket()
    if (socket) {
      // If socket already connected, listeners are already attached above
      // But also listen for future reconnects
      socket.on('connect', () => {
        voiceSignalingHandler.setupWebSocketListeners()
      })
    }
  }

  async joinVoiceChannel(channelId: number, reconnecting: boolean = false): Promise<void> {
    try {
      useVoiceStore.getState().setIsConnecting(true)
      useVoiceStore.getState().setConnectionError(null)

      // Initialize sound manager
      soundManager.initialize()

      // Initialize local audio stream
      await webrtcService.initializeLocalStream()

      // Set current channel
      webrtcService.setCurrentChannelId(channelId)
      voiceScreenShareManager.setCurrentChannelId(channelId)
      useVoiceStore.getState().setConnectedChannel(channelId)

      // Add local user to voice store
      const localUser = useAuthStore.getState().user
      if (localUser) {
        useVoiceStore.getState().addConnectedUser({
          userId: localUser.id,
          username: localUser.username,
          isSpeaking: false,
          isMuted: useVoiceStore.getState().isMuted,
          hasVideo: false,
          hasScreenShare: false,
          connectionStatus: 'connected',
          connectionQuality: 'excellent',
          localMuted: false,
          localVolume: 1.0,
        })
      }

      // Tell server we're joining
      wsService.getSocket()?.emit('join-voice-channel', { channelId, reconnecting })

      // Track voice channel state in WebSocket service for reconnection
      wsService.setVoiceChannelState(channelId)

      // Play join sound
      if (!reconnecting && voiceSettingsManager.shouldPlaySounds()) {
        soundManager.playUserJoined()
      }

      useVoiceStore.getState().setIsConnecting(false)

      logger.info('VoiceConnection', `Successfully joined voice channel: ${channelId}`, {
        channelId,
        reconnecting,
      })
    } catch (error) {
      logger.error('VoiceConnection', 'Failed to join voice channel', { channelId, error })
      handleError(error, 'VoiceConnection')
      useVoiceStore.getState().setConnectionError('Failed to connect to voice channel')
      useVoiceStore.getState().setIsConnecting(false)
      throw error
    }
  }

  leaveVoiceChannel(): void {
    const channelId = webrtcService.getCurrentChannelId()
    if (!channelId) {
      logger.warn('VoiceConnection', 'Not in a voice channel')
      return
    }

    logger.info('VoiceConnection', 'Leaving voice channel', { channelId })

    // Disable camera and screen share before leaving
    if (this.camera.isCameraEnabled()) {
      logger.info('VoiceConnection', 'Disabling camera before leaving')
      this.camera.disableCamera().catch((error) => {
        logger.error('VoiceConnection', 'Failed to disable camera while leaving', { error })
      })
    }

    if (this.screenShare.isScreenShareEnabled()) {
      logger.info('VoiceConnection', 'Disabling screen share before leaving')
      this.screenShare.disableScreenShare().catch((error) => {
        logger.error('VoiceConnection', 'Failed to disable screen share while leaving', { error })
      })
    }

    // Notify server we're leaving
    wsService.getSocket()?.emit('leave-voice-channel', { channelId })

    // Clear voice channel state in WebSocket service
    wsService.clearVoiceChannelState()

    // Clean up WebRTC connections
    webrtcService.cleanup()

    // Clear voice store (this also stops all streams)
    useVoiceStore.getState().clearConnectedUsers()
    useVoiceStore.getState().setConnectedChannel(null)

    // Reset local streaming state
    useVoiceStore.getState().setLocalVideoEnabled(false)
    useVoiceStore.getState().setLocalVideoStream(null)
    useVoiceStore.getState().setLocalScreenShareEnabled(false)
    useVoiceStore.getState().setLocalScreenShareStream(null)

    // Play leave sound
    if (voiceSettingsManager.shouldPlaySounds()) {
      soundManager.playUserLeft()
    }

    logger.info('VoiceConnection', 'Successfully left voice channel', { channelId })
  }

  isConnected(): boolean {
    return webrtcService.getCurrentChannelId() !== null
  }

  getCurrentChannelId(): number | null {
    return webrtcService.getCurrentChannelId()
  }

  cleanup(): void {
    webrtcService.cleanup()
  }

  // Delegate methods to specialized managers for backwards compatibility
  toggleMute = () => this.settings.toggleMute()
  toggleDeafen = () => this.settings.toggleDeafen()
  setUserLocalMuted = (userId: number, muted: boolean) =>
    this.settings.setUserLocalMuted(userId, muted)
  setUserVolume = (userId: number, volume: number) => this.settings.setUserVolume(userId, volume)
  updateVoiceSettings = (settings: any) => this.settings.updateVoiceSettings(settings)
  setAttenuation = (attenuation: number) => this.settings.setAttenuation(attenuation)
  setMasterVolume = (volume: number) => this.settings.setMasterVolume(volume)

  getConnectionQualities = () => this.quality.getConnectionQualities()
  getOverallQuality = () => this.quality.getOverallQuality()
  getQualityWarnings = () => this.quality.getQualityWarnings()
  isQualityDegraded = () => this.quality.isQualityDegraded()
  getQualityStatusDescription = () => this.quality.getQualityStatusDescription()

  getAudioDevices = () => this.devices.getAudioDevices()
  changeInputDevice = (deviceId: string) => this.devices.changeInputDevice(deviceId)
  changeOutputDevice = (deviceId: string) => this.devices.changeOutputDevice(deviceId)

  enableCamera = () => this.camera.enableCamera()
  disableCamera = () => this.camera.disableCamera()
  isCameraEnabled = () => this.camera.isCameraEnabled()
  getAvailableVideoDevices = () => this.camera.getAvailableVideoDevices()
  switchVideoDevice = (deviceId: string) => this.camera.switchVideoDevice(deviceId)

  enableScreenShare = (captureAudio: boolean) => this.screenShare.enableScreenShare(captureAudio)
  disableScreenShare = () => this.screenShare.disableScreenShare()
  isScreenShareEnabled = () => this.screenShare.isScreenShareEnabled()

  // Control screen share audio based on focused user
  setFocusedUserScreenShareAudio = (userId: number | null) =>
    webrtcService.setFocusedUserScreenShareAudio(userId)
}

export const voiceConnectionManager = new VoiceConnectionManager()
