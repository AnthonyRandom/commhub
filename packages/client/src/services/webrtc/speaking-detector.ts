import { useVoiceStore } from '../../stores/voice'
import { useAuthStore } from '../../stores/auth'

// Enhanced Speaking Detection Configuration
export interface SpeakingDetectionConfig {
  mode: 'voice_activity' | 'push_to_talk'
  sensitivity: number // 0-100
  noiseGate: number // Minimum volume threshold
  holdTime: number // ms to keep speaking state after audio drops
  cooldownTime: number // ms between speaking detections
  pttKey?: string // key combination for PTT
}

/**
 * Advanced Speaking Detection Class
 * Handles voice activity detection and push-to-talk functionality
 */
export class EnhancedSpeakingDetector {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private speakingConfig: SpeakingDetectionConfig
  private detectionInterval: number | null = null
  private lastSpeakTime = 0
  private isSpeaking = false
  private holdTimeout: number | null = null
  private pttPressed = false
  private keyListeners: ((event: KeyboardEvent) => void)[] = []
  private emitCallback: (isSpeaking: boolean) => void

  constructor(config: SpeakingDetectionConfig, emitCallback: (isSpeaking: boolean) => void) {
    this.speakingConfig = { ...config }
    this.emitCallback = emitCallback
  }

  /**
   * Initialize speaking detection with audio stream
   */
  initialize(stream: MediaStream): void {
    this.setupAudioAnalysis(stream)
    this.setupPTTListeners()
    this.startDetection()
  }

  /**
   * Update speaking detection configuration
   */
  updateConfig(config: Partial<SpeakingDetectionConfig>): void {
    this.speakingConfig = { ...this.speakingConfig, ...config }

    // Restart detection with new config
    if (this.detectionInterval) {
      this.stopDetection()
      this.startDetection()
    }
  }

  /**
   * Set up Web Audio API analysis
   */
  private setupAudioAnalysis(stream: MediaStream): void {
    try {
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()

      // Higher FFT size for better frequency analysis
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.3

      const source = this.audioContext.createMediaStreamSource(stream)
      source.connect(this.analyser)
    } catch (error) {
      console.error('[SpeakingDetector] Failed to set up audio analysis:', error)
    }
  }

  /**
   * Set up push-to-talk key listeners
   */
  private setupPTTListeners(): void {
    if (this.speakingConfig.mode !== 'push_to_talk' || !this.speakingConfig.pttKey) {
      return
    }

    const keyDownListener = (event: KeyboardEvent) => {
      if (this.isPTTKey(event)) {
        event.preventDefault()
        this.pttPressed = true
        this.updateSpeakingState(true)
      }
    }

    const keyUpListener = (event: KeyboardEvent) => {
      if (this.isPTTKey(event)) {
        event.preventDefault()
        this.pttPressed = false
        this.updateSpeakingState(false)
      }
    }

    document.addEventListener('keydown', keyDownListener)
    document.addEventListener('keyup', keyUpListener)

    this.keyListeners = [keyDownListener, keyUpListener]
  }

  /**
   * Check if the pressed key matches PTT configuration
   */
  private isPTTKey(event: KeyboardEvent): boolean {
    if (!this.speakingConfig.pttKey) return false

    const keys = this.speakingConfig.pttKey.toLowerCase().split('+')
    const modifiers = keys.filter((k) => ['ctrl', 'alt', 'shift', 'meta'].includes(k))
    const mainKey = keys.find((k) => !['ctrl', 'alt', 'shift', 'meta'].includes(k))

    // Check modifiers
    for (const mod of modifiers) {
      switch (mod) {
        case 'ctrl':
          if (!event.ctrlKey) return false
          break
        case 'alt':
          if (!event.altKey) return false
          break
        case 'shift':
          if (!event.shiftKey) return false
          break
        case 'meta':
          if (!event.metaKey) return false
          break
      }
    }

    // Check main key
    return event.key.toLowerCase() === mainKey
  }

  /**
   * Start periodic speaking detection
   */
  private startDetection(): void {
    if (this.detectionInterval) return

    let lastSpeakingState = false

    this.detectionInterval = window.setInterval(() => {
      let shouldSpeak = false

      if (this.speakingConfig.mode === 'push_to_talk') {
        shouldSpeak = this.pttPressed
      } else {
        // Voice activity detection
        shouldSpeak = this.analyzeAudioForSpeech()
      }

      // Only emit when speaking state changes to reduce network traffic
      if (shouldSpeak !== lastSpeakingState) {
        lastSpeakingState = shouldSpeak
        this.emitSpeakingChange(shouldSpeak)
      }
    }, 100) // Check every 100ms
  }

  /**
   * Analyze audio for speech using multiple algorithms
   */
  private analyzeAudioForSpeech(): boolean {
    if (!this.analyser) return false

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)

    const metrics = this.calculateAudioMetrics(dataArray)
    return this.shouldDetectSpeaking(metrics)
  }

  /**
   * Calculate comprehensive audio metrics
   */
  private calculateAudioMetrics(dataArray: Uint8Array): {
    rms: number
    lowAvg: number
    highAvg: number
    spectralCentroid: number
  } {
    const length = dataArray.length

    // RMS (Root Mean Square) for volume
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += dataArray[i] * dataArray[i]
    }
    const rms = Math.sqrt(sum / length)

    // Frequency analysis
    const lowFreq = dataArray.slice(0, Math.floor(length * 0.1)) // 0-1kHz approx
    const highFreq = dataArray.slice(Math.floor(length * 0.1)) // 1kHz+

    const lowAvg = lowFreq.reduce((a, b) => a + b) / lowFreq.length
    const highAvg = highFreq.reduce((a, b) => a + b) / highFreq.length

    // Spectral centroid (center of mass of spectrum)
    let weightedSum = 0
    let totalWeight = 0
    for (let i = 0; i < length; i++) {
      weightedSum += i * dataArray[i]
      totalWeight += dataArray[i]
    }
    const spectralCentroid = totalWeight > 0 ? weightedSum / totalWeight / length : 0

    return { rms, lowAvg, highAvg, spectralCentroid }
  }

  /**
   * Determine if audio contains speech using multiple criteria
   */
  private shouldDetectSpeaking(metrics: ReturnType<typeof this.calculateAudioMetrics>): boolean {
    const { rms } = metrics

    // Very low threshold to detect any microphone noise
    // Use sensitivity to adjust how easily it triggers (lower sensitivity = easier to trigger)
    const baseThreshold = 5 // Much lower base threshold
    const sensitivityFactor = (100 - this.speakingConfig.sensitivity) / 100 // 0-1 scale where higher sensitivity = lower threshold
    const threshold = baseThreshold * (0.1 + sensitivityFactor * 2) // Range from 0.5 to 5.0

    // Simple volume check - trigger on any detectable noise
    return rms > threshold
  }

  /**
   * Update speaking state with hold time and cooldown
   */
  private updateSpeakingState(speaking: boolean): void {
    const now = Date.now()

    if (speaking && !this.isSpeaking) {
      // Started speaking
      if (now - this.lastSpeakTime > this.speakingConfig.cooldownTime) {
        this.isSpeaking = true
        this.emitSpeakingChange(true)
      }
    } else if (!speaking && this.isSpeaking) {
      // Stopped speaking - use hold time
      if (this.holdTimeout) clearTimeout(this.holdTimeout)

      this.holdTimeout = window.setTimeout(() => {
        this.isSpeaking = false
        this.emitSpeakingChange(false)
        this.lastSpeakTime = now
      }, this.speakingConfig.holdTime)
    }
  }

  /**
   * Emit speaking change event
   */
  private emitSpeakingChange(isSpeaking: boolean): void {
    // Always update local store
    const user = useAuthStore.getState().user
    if (user) {
      useVoiceStore.getState().updateUserSpeaking(user.id, isSpeaking)
    }

    // Call the WebRTC service callback for server communication
    this.emitCallback(isSpeaking)
  }

  /**
   * Stop detection and clean up
   */
  destroy(): void {
    this.stopDetection()

    // Remove key listeners
    this.keyListeners.forEach((listener, index) => {
      const eventType = index % 2 === 0 ? 'keydown' : 'keyup'
      document.removeEventListener(eventType, listener as EventListener)
    })
    this.keyListeners = []

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.analyser = null
  }

  /**
   * Stop detection interval
   */
  private stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval)
      this.detectionInterval = null
    }

    if (this.holdTimeout) {
      clearTimeout(this.holdTimeout)
      this.holdTimeout = null
    }
  }
}
