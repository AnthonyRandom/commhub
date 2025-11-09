import { useVoiceStore } from '../../stores/voice'
import { useVoiceSettingsStore } from '../../stores/voice-settings'
import { NoiseSuppressionProcessor, NoiseSuppressionConfig } from '../noise-suppression'
import { EnhancedSpeakingDetector, SpeakingDetectionConfig } from './speaking-detector'
import { logger } from '../../utils/logger'
import { handleError, PermissionError, NotFoundError, ValidationError } from '../../utils/errors'

/**
 * Manages local media streams (audio/video), noise suppression, and speaking detection
 */
export class StreamManager {
  private localStream: MediaStream | null = null
  private processedStream: MediaStream | null = null
  private noiseSuppressor: NoiseSuppressionProcessor | null = null
  private speakingDetector: EnhancedSpeakingDetector | null = null
  private onSpeakingChange: ((isSpeaking: boolean) => void) | null = null

  /**
   * Initialize local audio stream with noise suppression
   */
  async initializeLocalStream(
    onSpeakingChange: (isSpeaking: boolean) => void
  ): Promise<MediaStream> {
    try {
      this.onSpeakingChange = onSpeakingChange

      // Get voice settings from the store
      const voiceSettings = useVoiceSettingsStore.getState().settings

      // Build audio constraints from voice settings
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: voiceSettings.input.echoCancellation,
        noiseSuppression: voiceSettings.input.noiseSuppression,
        autoGainControl: voiceSettings.input.autoGainControl,
      }

      // Use specific device if selected
      if (voiceSettings.input.deviceId && voiceSettings.input.deviceId !== 'default') {
        logger.info(
          'StreamManager',
          `Using selected audio device: ${voiceSettings.input.deviceId}`,
          { deviceId: voiceSettings.input.deviceId }
        )
        audioConstraints.deviceId = { exact: voiceSettings.input.deviceId }
      } else {
        logger.info('StreamManager', 'Using default audio device')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      })

      logger.info('StreamManager', '✅ Local audio stream initialized', {
        audioTracks: stream.getAudioTracks().map((t) => ({
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
      })

      // Add a black/silent video track to avoid renegotiation later
      const blackVideoTrack = this.createBlackVideoTrack()
      stream.addTrack(blackVideoTrack)
      logger.info('StreamManager', 'Added black video track to avoid renegotiation')

      this.localStream = stream

      // Apply noise suppression
      const processedStream = await this.initializeNoiseSuppression(stream)

      // Store both streams
      this.processedStream = processedStream
      useVoiceStore.getState().setLocalStream(processedStream)

      // Initialize enhanced speaking detection (use processed stream for analysis)
      this.initializeSpeakingDetection(processedStream)

      return processedStream
    } catch (error) {
      logger.error('StreamManager', 'Failed to get user media', { error })
      handleError(error, 'StreamManager')

      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new PermissionError(
            'Microphone access denied. Please allow microphone permissions.'
          )
        } else if (error.name === 'NotFoundError') {
          throw new NotFoundError('No microphone found. Please connect a microphone.')
        } else if (error.name === 'OverconstrainedError') {
          throw new ValidationError('Selected microphone not available. Try using default device.')
        }
      }

      throw new Error('Failed to access microphone. Please check permissions and try again.')
    }
  }

  /**
   * Initialize enhanced speaking detection
   */
  private initializeSpeakingDetection(stream: MediaStream) {
    try {
      if (!this.onSpeakingChange) return

      // Get speaking detection settings from the voice settings store
      const voiceSettings = useVoiceSettingsStore.getState().settings

      const speakingConfig: SpeakingDetectionConfig = {
        mode: voiceSettings.detection.mode,
        sensitivity: voiceSettings.input.sensitivity,
        noiseGate: voiceSettings.input.noiseGate,
        holdTime: voiceSettings.detection.holdTime,
        cooldownTime: voiceSettings.detection.cooldownTime,
        pttKey: voiceSettings.detection.pttKey,
      }

      this.speakingDetector = new EnhancedSpeakingDetector(speakingConfig, this.onSpeakingChange)
      this.speakingDetector.initialize(stream)

      logger.info('StreamManager', 'Enhanced speaking detection initialized', {
        config: speakingConfig,
      })
    } catch (error) {
      logger.error('StreamManager', 'Failed to initialize speaking detection', { error })
      handleError(error, 'StreamManager')
    }
  }

  /**
   * Initialize noise suppression
   */
  private async initializeNoiseSuppression(stream: MediaStream): Promise<MediaStream> {
    try {
      // Get voice settings for noise suppression config
      const voiceSettings = useVoiceSettingsStore.getState().settings

      const noiseConfig: NoiseSuppressionConfig = {
        method: voiceSettings.input.noiseSuppressionMethod,
        intensity: voiceSettings.input.noiseSuppressionIntensity,
        noiseGateThreshold: voiceSettings.input.noiseGate,
        attackTime: 10,
        releaseTime: 100,
        enabled: voiceSettings.input.noiseSuppression,
      }

      // Initialize noise suppressor
      this.noiseSuppressor = new NoiseSuppressionProcessor(noiseConfig)
      const processedStream = await this.noiseSuppressor.initialize(stream)

      logger.info('StreamManager', 'Noise suppression initialized', { config: noiseConfig })
      return processedStream
    } catch (error) {
      logger.error('StreamManager', 'Failed to initialize noise suppression', { error })
      handleError(error, 'StreamManager')
      // Return original stream on error
      return stream
    }
  }

  /**
   * Update noise suppression configuration
   */
  updateNoiseSuppressionConfig(config: Partial<NoiseSuppressionConfig>): void {
    if (this.noiseSuppressor) {
      this.noiseSuppressor.updateConfig(config)
      logger.info('StreamManager', 'Noise suppression config updated', { config })
    }
  }

  /**
   * Update speaking detection configuration
   */
  updateSpeakingConfig(config: Partial<SpeakingDetectionConfig>): void {
    if (this.speakingDetector) {
      this.speakingDetector.updateConfig(config)

      // Update the voice settings store
      const voiceSettingsStore = useVoiceSettingsStore.getState()

      if (
        config.mode !== undefined ||
        config.pttKey !== undefined ||
        config.holdTime !== undefined ||
        config.cooldownTime !== undefined
      ) {
        const detectionUpdates: any = {}
        if (config.mode !== undefined) detectionUpdates.mode = config.mode
        if (config.pttKey !== undefined) detectionUpdates.pttKey = config.pttKey
        if (config.holdTime !== undefined) detectionUpdates.holdTime = config.holdTime
        if (config.cooldownTime !== undefined) detectionUpdates.cooldownTime = config.cooldownTime

        voiceSettingsStore.updateDetectionSettings(detectionUpdates)
      }

      if (config.sensitivity !== undefined || config.noiseGate !== undefined) {
        const inputUpdates: any = {}
        if (config.sensitivity !== undefined) inputUpdates.sensitivity = config.sensitivity
        if (config.noiseGate !== undefined) inputUpdates.noiseGate = config.noiseGate

        voiceSettingsStore.updateInputSettings(inputUpdates)
      }

      logger.info('StreamManager', 'Speaking config updated', { config })
    }
  }

  /**
   * Create a black/silent video track as placeholder
   */
  private createBlackVideoTrack(): MediaStreamTrack {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const stream = canvas.captureStream(1) // 1 FPS
    const track = stream.getVideoTracks()[0]

    // Mark as placeholder
    ;(track as any).isPlaceholder = true

    return track
  }

  /**
   * Set microphone muted state
   */
  setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted
      })
      logger.info('StreamManager', `Microphone ${muted ? 'muted' : 'unmuted'}`, { muted })
    }
  }

  /**
   * Set deafened state
   * Note: Audio track muting is handled by the voice store
   * This method exists for API compatibility but doesn't need to do anything
   * since the voice store handles the full deafen logic
   */
  setDeafened(_deafened: boolean): void {
    // No-op: Voice store handles deafen/mute state
    // Keeping this method for API compatibility
  }

  /**
   * Change audio input device
   */
  async changeAudioDevice(deviceId: string): Promise<void> {
    if (!this.onSpeakingChange) {
      throw new Error('Stream manager not initialized')
    }

    logger.info('StreamManager', `Changing audio device to: ${deviceId}`, { deviceId })

    // Stop current stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
    }

    // Clean up noise suppressor
    if (this.noiseSuppressor) {
      this.noiseSuppressor.destroy()
      this.noiseSuppressor = null
    }

    // Clean up speaking detector
    if (this.speakingDetector) {
      this.speakingDetector.destroy()
      this.speakingDetector = null
    }

    // Update voice settings with new device
    useVoiceSettingsStore.getState().updateInputSettings({ deviceId })

    // Reinitialize with new device
    await this.initializeLocalStream(this.onSpeakingChange)
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((device) => device.kind === 'audioinput')
    } catch (error) {
      logger.error('StreamManager', 'Failed to enumerate audio devices', { error })
      handleError(error, 'StreamManager')
      return []
    }
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /**
   * Get processed stream
   */
  getProcessedStream(): MediaStream | null {
    return this.processedStream
  }

  /**
   * Get speaking detector
   */
  getSpeakingDetector(): EnhancedSpeakingDetector | null {
    return this.speakingDetector
  }

  /**
   * Get noise suppression stats
   */
  getNoiseSuppressionStats() {
    return this.noiseSuppressor?.getStats() || null
  }

  /**
   * Get noise suppression method
   */
  getNoiseSuppressionMethod() {
    const stats = this.noiseSuppressor?.getStats()
    return stats?.method || 'none'
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.processedStream) {
      this.processedStream.getTracks().forEach((track) => track.stop())
      this.processedStream = null
    }

    // Clean up noise suppressor
    if (this.noiseSuppressor) {
      this.noiseSuppressor.destroy()
      this.noiseSuppressor = null
    }

    // Clean up speaking detector
    if (this.speakingDetector) {
      this.speakingDetector.destroy()
      this.speakingDetector = null
    }

    logger.info('StreamManager', 'Cleaned up all resources')
  }
}
