import SimplePeer from 'simple-peer'
import { useVoiceStore } from '../stores/voice'
import { useVoiceSettingsStore } from '../stores/voice-settings'
import { wsService } from './websocket'
import { useAuthStore } from '../stores/auth'
import { NoiseSuppressionProcessor, NoiseSuppressionConfig } from './noise-suppression'

// Enhanced Speaking Detection Configuration
interface SpeakingDetectionConfig {
  mode: 'voice_activity' | 'push_to_talk'
  sensitivity: number // 0-100
  noiseGate: number // Minimum volume threshold
  holdTime: number // ms to keep speaking state after audio drops
  cooldownTime: number // ms between speaking detections
  pttKey?: string // key combination for PTT
}

// Advanced Speaking Detection Class
class EnhancedSpeakingDetector {
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

interface PeerConnection {
  peer: SimplePeer.Instance
  userId: number
  username: string
  audioElement?: HTMLAudioElement
}

interface ConnectionState {
  quality: 'excellent' | 'good' | 'poor' | 'critical' | 'connecting'
  retryCount: number
  lastConnected: Date
  reconnecting: boolean
  iceState?: string
}

class WebRTCService {
  private peers: Map<number, PeerConnection> = new Map()
  private localStream: MediaStream | null = null
  private processedStream: MediaStream | null = null
  private localVideoStream: MediaStream | null = null
  private speakingDetector: EnhancedSpeakingDetector | null = null
  private noiseSuppressor: NoiseSuppressionProcessor | null = null
  private currentChannelId: number | null = null
  private connectionStates: Map<number, ConnectionState> = new Map()
  private voiceChannelJoined: boolean = false
  private videoEnabled: boolean = false

  // Configuration for WebRTC
  private rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  }

  // Connection management constants
  private readonly MAX_RETRY_ATTEMPTS = 3
  private readonly RECONNECT_DELAY_BASE = 2000 // ms
  private readonly CONNECTION_TIMEOUT = 30000 // ms

  /**
   * Initialize local audio stream
   */
  async initializeLocalStream(): Promise<MediaStream> {
    try {
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
        console.log(`[WebRTC] Using selected audio device: ${voiceSettings.input.deviceId}`)
        audioConstraints.deviceId = { exact: voiceSettings.input.deviceId }
      } else {
        console.log('[WebRTC] Using default audio device')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      })

      console.log('[WebRTC] ✅ Local audio stream initialized')
      console.log(
        '[WebRTC] Audio tracks:',
        stream.getAudioTracks().map((t) => ({
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        }))
      )

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
      console.error('[WebRTC] Failed to get user media:', error)

      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Microphone access denied. Please allow microphone permissions.')
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone.')
        } else if (error.name === 'OverconstrainedError') {
          throw new Error('Selected microphone not available. Try using default device.')
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

      this.speakingDetector = new EnhancedSpeakingDetector(
        speakingConfig,
        this.handleSpeakingChange.bind(this)
      )
      this.speakingDetector.initialize(stream)

      console.log('[WebRTC] Enhanced speaking detection initialized with config:', speakingConfig)
    } catch (error) {
      console.error('[WebRTC] Failed to initialize speaking detection:', error)
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

      console.log('[WebRTC] Noise suppression initialized:', noiseConfig)
      return processedStream
    } catch (error) {
      console.error('[WebRTC] Failed to initialize noise suppression:', error)
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
      console.log('[WebRTC] Noise suppression config updated:', config)
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

      console.log('[WebRTC] Speaking config updated:', config)
    }
  }

  /**
   * Create a peer connection to another user with enhanced reliability
   */
  createPeerConnection(
    userId: number,
    username: string,
    isInitiator: boolean,
    onSignal: (signal: SimplePeer.SignalData) => void,
    onStream: (stream: MediaStream) => void,
    onClose: () => void
  ): SimplePeer.Instance {
    if (!this.localStream) {
      throw new Error('Local stream not initialized')
    }

    // Initialize connection state
    this.connectionStates.set(userId, {
      quality: 'connecting',
      retryCount: 0,
      lastConnected: new Date(),
      reconnecting: false,
    })

    // Remove existing peer if it exists
    this.removePeer(userId)

    const peer = this.createPeerWithRetry(
      userId,
      username,
      isInitiator,
      onSignal,
      onStream,
      onClose
    )

    // Store peer connection
    this.peers.set(userId, { peer, userId, username })

    return peer
  }

  /**
   * Create peer with retry logic and enhanced error handling
   */
  private createPeerWithRetry(
    userId: number,
    username: string,
    isInitiator: boolean,
    onSignal: (signal: SimplePeer.SignalData) => void,
    onStream: (stream: MediaStream) => void,
    onClose: () => void
  ): SimplePeer.Instance {
    const peer = new SimplePeer({
      initiator: isInitiator,
      stream: this.localStream!,
      config: this.rtcConfig,
      trickle: true,
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true, // Allow video to be added dynamically
      },
    })

    let connectionTimeout: number | null = null

    // Set connection timeout
    connectionTimeout = window.setTimeout(() => {
      if (!peer.connected) {
        console.warn(`[WebRTC] Connection timeout for ${username}`)
        this.handlePeerError(userId, new Error('Connection timeout'))
      }
    }, this.CONNECTION_TIMEOUT)

    // Handle signaling
    peer.on('signal', (signal) => {
      onSignal(signal)
    })

    // Handle incoming stream
    peer.on('stream', (stream) => {
      console.log(`[WebRTC] Received stream from ${username}`)
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }

      this.updateConnectionQuality(userId, 'excellent')

      // Check if stream has video tracks
      const hasVideo = stream.getVideoTracks().length > 0
      console.log(`[WebRTC] Stream from ${username} has video: ${hasVideo}`)

      // Update user stream in store
      useVoiceStore.getState().updateUserStream(userId, stream)

      // Update video state if there are video tracks
      if (hasVideo) {
        useVoiceStore.getState().updateUserVideo(userId, true)
        useVoiceStore.getState().updateUserVideoStream(userId, stream)
      }

      onStream(stream)

      // Play the audio and store reference
      const audioElement = this.playAudioStream(stream, userId, username)
      const peerConnection = this.peers.get(userId)
      if (peerConnection) {
        peerConnection.audioElement = audioElement
      }

      // Listen for track changes (when peer enables/disables camera dynamically)
      stream.addEventListener('addtrack', (event) => {
        console.log(`[WebRTC] Track added to ${username}'s stream:`, event.track.kind)
        if (event.track.kind === 'video') {
          useVoiceStore.getState().updateUserVideo(userId, true)
          useVoiceStore.getState().updateUserVideoStream(userId, stream)
        }
      })

      stream.addEventListener('removetrack', (event) => {
        console.log(`[WebRTC] Track removed from ${username}'s stream:`, event.track.kind)
        if (event.track.kind === 'video') {
          // Check if there are any remaining video tracks
          const hasVideo = stream.getVideoTracks().length > 0
          if (!hasVideo) {
            useVoiceStore.getState().updateUserVideo(userId, false)
          }
        }
      })
    })

    // Handle connection established
    peer.on('connect', () => {
      console.log(`[WebRTC] Peer connection established with ${username}`)
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }

      this.updateConnectionQuality(userId, 'excellent')
      useVoiceStore.getState().updateUserConnectionStatus(userId, 'connected')
    })

    // Enhanced error handling with retry logic
    peer.on('error', (err) => {
      console.error(`[WebRTC] Peer connection error for ${username}:`, err)
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }
      this.handlePeerError(userId, err, onClose)
    })

    // Handle peer disconnection
    peer.on('close', () => {
      console.log(`[WebRTC] Peer connection closed: ${username}`)
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }
      this.handlePeerDisconnect(userId, onClose)
    })

    // Monitor ICE connection state for quality assessment
    this.setupICEConnectionMonitoring(peer, userId, username)

    return peer
  }

  /**
   * Set up ICE connection state monitoring
   */
  private setupICEConnectionMonitoring(
    peer: SimplePeer.Instance,
    userId: number,
    username: string
  ) {
    // Access the underlying RTCPeerConnection
    const rtcPeerConnection = (peer as any)._pc as RTCPeerConnection

    if (rtcPeerConnection) {
      rtcPeerConnection.addEventListener('iceconnectionstatechange', () => {
        const state = rtcPeerConnection.iceConnectionState
        console.log(`[WebRTC] ICE state change for ${username}: ${state}`)

        this.updateConnectionState(userId, { iceState: state })

        switch (state) {
          case 'connected':
          case 'completed':
            this.updateConnectionQuality(userId, 'excellent')
            break
          case 'disconnected':
            this.updateConnectionQuality(userId, 'poor')
            break
          case 'failed':
          case 'closed':
            this.updateConnectionQuality(userId, 'critical')
            break
          default:
            // Keep current quality for other states
            break
        }
      })

      // Monitor connection quality periodically
      this.startConnectionQualityMonitoring(userId, rtcPeerConnection)
    }
  }

  /**
   * Monitor connection quality using RTCPeerConnection stats
   */
  private startConnectionQualityMonitoring(userId: number, rtcPeerConnection: RTCPeerConnection) {
    const monitor = async () => {
      try {
        const stats = await rtcPeerConnection.getStats()
        let packetsLost = 0
        let packetsReceived = 0
        let bytesReceived = 0
        let jitter = 0

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
            packetsLost += report.packetsLost || 0
            packetsReceived += report.packetsReceived || 0
            bytesReceived += report.bytesReceived || 0
            jitter = Math.max(jitter, report.jitter || 0)
          }
        })

        if (packetsReceived > 0) {
          const lossRate = packetsLost / (packetsLost + packetsReceived)
          const quality = this.calculateQualityFromStats(lossRate, jitter)

          this.updateConnectionQuality(userId, quality)

          // Trigger adaptive video quality adjustment if video is enabled
          if (this.videoEnabled) {
            this.handleVideoQualityAdjustment(userId, lossRate, jitter)
          }
        }
      } catch (error) {
        console.warn(`[WebRTC] Failed to get connection stats for user ${userId}:`, error)
      }
    }

    // Monitor every 5 seconds
    const intervalId = window.setInterval(monitor, 5000)

    // Store interval ID for cleanup
    const state = this.connectionStates.get(userId)
    if (state) {
      ;(state as any).qualityMonitorInterval = intervalId
    }
  }

  /**
   * Calculate connection quality from WebRTC stats
   */
  private calculateQualityFromStats(lossRate: number, jitter: number): ConnectionState['quality'] {
    // High packet loss or jitter indicates poor quality
    if (lossRate > 0.1 || jitter > 0.1) {
      return 'critical'
    } else if (lossRate > 0.05 || jitter > 0.05) {
      return 'poor'
    } else if (lossRate > 0.01 || jitter > 0.02) {
      return 'good'
    } else {
      return 'excellent'
    }
  }

  /**
   * Handle peer connection errors with retry logic
   */
  private handlePeerError(userId: number, error: Error, onClose?: () => void) {
    const state = this.connectionStates.get(userId)
    if (!state) return

    console.error(`[WebRTC] Handling peer error for user ${userId}:`, error)

    // Update connection status
    useVoiceStore.getState().updateUserConnectionStatus(userId, 'failed')

    if (state.retryCount < this.MAX_RETRY_ATTEMPTS && !state.reconnecting) {
      state.retryCount++
      state.reconnecting = true
      this.connectionStates.set(userId, state)

      const delay = this.RECONNECT_DELAY_BASE * Math.pow(2, state.retryCount - 1) // Exponential backoff

      console.log(
        `[WebRTC] Retrying connection to user ${userId} in ${delay}ms (attempt ${state.retryCount}/${this.MAX_RETRY_ATTEMPTS})`
      )

      setTimeout(() => {
        this.attemptReconnection(userId)
      }, delay)
    } else {
      console.error(`[WebRTC] Max retry attempts reached for user ${userId}`)
      // Give up and clean up
      this.removePeer(userId)
      onClose?.()
    }
  }

  /**
   * Handle peer disconnection
   */
  private handlePeerDisconnect(userId: number, onClose?: () => void) {
    const state = this.connectionStates.get(userId)
    if (state) {
      state.quality = 'critical'
      this.connectionStates.set(userId, state)
    }

    useVoiceStore.getState().updateUserConnectionStatus(userId, 'disconnected')
    onClose?.()
  }

  /**
   * Attempt to reconnect to a peer
   */
  private attemptReconnection(userId: number) {
    const state = this.connectionStates.get(userId)
    if (!state || !this.currentChannelId) return

    console.log(`[WebRTC] Attempting reconnection to user ${userId}`)

    state.reconnecting = false
    this.connectionStates.set(userId, state)

    // Emit reconnection signal through WebSocket
    // This will trigger the voice manager to create a new peer connection
    wsService.getSocket()?.emit('voice-reconnect-request', {
      channelId: this.currentChannelId,
      targetUserId: userId,
    })
  }

  /**
   * Update connection quality for a user
   */
  private updateConnectionQuality(userId: number, quality: ConnectionState['quality']) {
    const state = this.connectionStates.get(userId)
    if (state) {
      state.quality = quality
      state.lastConnected = new Date()
      this.connectionStates.set(userId, state)
    }

    // Update store with both status and quality
    const storeStatus =
      quality === 'critical' ? 'failed' : quality === 'poor' ? 'connecting' : 'connected'
    useVoiceStore.getState().updateUserConnectionStatus(userId, storeStatus)
    useVoiceStore.getState().updateUserConnectionQuality(userId, quality)

    // Update overall quality based on all connections
    this.updateOverallQuality()

    // Add/remove quality warnings
    this.updateQualityWarnings(userId, quality)
  }

  /**
   * Update overall voice quality based on all connections
   */
  private updateOverallQuality() {
    const qualities = Array.from(this.connectionStates.values()).map((state) => state.quality)

    if (qualities.length === 0) {
      useVoiceStore.getState().setOverallQuality('unknown')
      return
    }

    // Overall quality is the worst quality among all connections
    const qualityPriority = {
      critical: 4,
      poor: 3,
      good: 2,
      excellent: 1,
      connecting: 0,
      unknown: 0,
    }
    const worstQuality = qualities.reduce((worst, current) =>
      qualityPriority[current] > qualityPriority[worst] ? current : worst
    )

    useVoiceStore.getState().setOverallQuality(worstQuality as any)
  }

  /**
   * Update quality warnings based on connection quality
   */
  private updateQualityWarnings(userId: number, quality: ConnectionState['quality']) {
    const store = useVoiceStore.getState()
    const peerConnection = this.peers.get(userId)

    if (!peerConnection) return

    const warningKey = `user-${userId}`

    // Remove existing warnings for this user
    store.removeQualityWarning(`${warningKey}-poor`)
    store.removeQualityWarning(`${warningKey}-critical`)

    // Add new warnings
    if (quality === 'poor') {
      store.addQualityWarning(`${warningKey}-poor`)
    } else if (quality === 'critical') {
      store.addQualityWarning(`${warningKey}-critical`)
    }
  }

  /**
   * Update connection state properties
   */
  private updateConnectionState(userId: number, updates: Partial<ConnectionState>) {
    const state = this.connectionStates.get(userId)
    if (state) {
      Object.assign(state, updates)
      this.connectionStates.set(userId, state)
    }
  }

  /**
   * Play remote audio stream
   */
  private playAudioStream(stream: MediaStream, userId: number, username: string): HTMLAudioElement {
    console.log(`[WebRTC] Setting up audio playback for ${username} (${userId})`)

    // Create audio element
    const audio = document.createElement('audio')
    audio.srcObject = stream
    audio.autoplay = true

    // Check if user is deafened and mute the audio element accordingly
    const isDeafened = useVoiceStore.getState().isDeafened
    audio.muted = isDeafened

    // Set audio element properties for better compatibility
    audio.setAttribute('data-user-id', userId.toString())
    audio.setAttribute('data-username', username)

    // Add to DOM (required for some browsers)
    audio.style.display = 'none'
    document.body.appendChild(audio)

    // Attempt to play with detailed error handling
    audio
      .play()
      .then(() => {
        console.log(`[WebRTC] ✅ Audio playback started for ${username}`)
      })
      .catch((error) => {
        console.error(`[WebRTC] ❌ Failed to play audio for ${username}:`, error)
        console.error('[WebRTC] Error details:', {
          name: error.name,
          message: error.message,
          autoplay: audio.autoplay,
          muted: audio.muted,
          paused: audio.paused,
          readyState: audio.readyState,
          networkState: audio.networkState,
        })

        // Try unmuting and playing again (some browsers require this)
        audio.muted = false
        audio.play().catch((retryError) => {
          console.error(`[WebRTC] ❌ Retry failed for ${username}:`, retryError)
        })
      })

    // Add event listeners for debugging
    audio.addEventListener('loadedmetadata', () => {
      console.log(`[WebRTC] Audio metadata loaded for ${username}`)
    })

    audio.addEventListener('canplay', () => {
      console.log(`[WebRTC] Audio can play for ${username}`)
    })

    audio.addEventListener('playing', () => {
      console.log(`[WebRTC] Audio is playing for ${username}`)
    })

    audio.addEventListener('error', (event) => {
      console.error(`[WebRTC] Audio element error for ${username}:`, event)
    })

    return audio
  }

  /**
   * Signal a peer with WebRTC signal data
   */
  signal(userId: number, signalData: SimplePeer.SignalData) {
    const peerConnection = this.peers.get(userId)
    if (peerConnection) {
      try {
        peerConnection.peer.signal(signalData)
      } catch (error) {
        console.error('Failed to signal peer:', error)
      }
    }
  }

  /**
   * Remove a peer connection
   */
  removePeer(userId: number) {
    const peerConnection = this.peers.get(userId)
    if (peerConnection) {
      try {
        peerConnection.peer.destroy()
      } catch (error) {
        console.error('Error destroying peer:', error)
      }

      // Remove audio element from DOM
      if (peerConnection.audioElement) {
        console.log(`[WebRTC] Removing audio element for user ${userId}`)
        peerConnection.audioElement.pause()
        peerConnection.audioElement.srcObject = null
        if (peerConnection.audioElement.parentNode) {
          peerConnection.audioElement.parentNode.removeChild(peerConnection.audioElement)
        }
      }

      this.peers.delete(userId)
      useVoiceStore.getState().removeConnectedUser(userId)
    }
  }

  /**
   * Mute/unmute local microphone
   */
  setMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted
      })
      useVoiceStore.getState().setIsMuted(muted)
    }
  }

  /**
   * Deafen/undeafen (mute output)
   */
  setDeafened(deafened: boolean) {
    useVoiceStore.getState().setIsDeafened(deafened)

    // When deafened, also mute the microphone
    if (deafened) {
      this.setMuted(true)
    }

    // Mute/unmute all remote audio elements
    this.peers.forEach((peerConnection) => {
      if (peerConnection.audioElement) {
        peerConnection.audioElement.muted = deafened
        console.log(
          `[WebRTC] ${deafened ? 'Muted' : 'Unmuted'} audio from ${peerConnection.username}`
        )
      }
    })
  }

  /**
   * Get current channel ID
   */
  getCurrentChannelId(): number | null {
    return this.currentChannelId
  }

  /**
   * Set current channel ID
   */
  setCurrentChannelId(channelId: number | null) {
    this.currentChannelId = channelId
  }

  /**
   * Mark voice channel as joined (allows speaking events)
   */
  setVoiceChannelJoined(joined: boolean): void {
    this.voiceChannelJoined = joined
  }

  /**
   * Check if voice channel is joined
   */
  isVoiceChannelJoined(): boolean {
    return this.voiceChannelJoined
  }

  /**
   * Handle speaking change events from the detector
   */
  handleSpeakingChange(isSpeaking: boolean): void {
    // Only emit to server if we're properly joined to a voice channel
    if (this.voiceChannelJoined && this.currentChannelId) {
      wsService.getSocket()?.emit('voice-speaking', {
        channelId: this.currentChannelId,
        isSpeaking: isSpeaking,
      })
    }
  }

  /**
   * Clean up all connections and streams
   */
  cleanup() {
    console.log('[WebRTC] Cleaning up all connections and streams')

    // Stop speaking detection
    if (this.speakingDetector) {
      this.speakingDetector.destroy()
      this.speakingDetector = null
    }

    // Stop noise suppression
    if (this.noiseSuppressor) {
      this.noiseSuppressor.destroy()
      this.noiseSuppressor = null
    }

    // Clean up connection quality monitoring intervals
    this.connectionStates.forEach((state) => {
      if ((state as any).qualityMonitorInterval) {
        clearInterval((state as any).qualityMonitorInterval)
      }
    })

    // Destroy all peer connections and remove audio elements
    this.peers.forEach((peerConnection, userId) => {
      try {
        peerConnection.peer.destroy()

        // Remove audio element
        if (peerConnection.audioElement) {
          peerConnection.audioElement.pause()
          peerConnection.audioElement.srcObject = null
          if (peerConnection.audioElement.parentNode) {
            peerConnection.audioElement.parentNode.removeChild(peerConnection.audioElement)
          }
        }
      } catch (error) {
        console.error(`Error destroying peer ${userId}:`, error)
      }
    })
    this.peers.clear()

    // Clear connection states
    this.connectionStates.clear()

    // Stop local and processed streams
    if (this.processedStream) {
      this.processedStream.getTracks().forEach((track) => {
        console.log('[WebRTC] Stopping processed track:', track.kind)
        track.stop()
      })
      this.processedStream = null
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log('[WebRTC] Stopping local track:', track.kind)
        track.stop()
      })
      this.localStream = null
    }

    // Stop local video stream
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach((track) => {
        console.log('[WebRTC] Stopping local video track:', track.kind)
        track.stop()
      })
      this.localVideoStream = null
    }

    this.currentChannelId = null
    this.voiceChannelJoined = false
    this.videoEnabled = false

    // Reset voice store
    useVoiceStore.getState().reset()

    console.log('[WebRTC] Cleanup complete')
  }

  /**
   * Get all active peer connections
   */
  getPeers(): Map<number, PeerConnection> {
    return this.peers
  }

  /**
   * Check if connected to any peers
   */
  isConnected(): boolean {
    return this.peers.size > 0
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /**
   * Get speaking detector instance
   */
  getSpeakingDetector(): EnhancedSpeakingDetector | null {
    return this.speakingDetector
  }

  /**
   * Get noise suppression stats
   */
  getNoiseSuppressionStats() {
    return this.noiseSuppressor ? this.noiseSuppressor.getStats() : null
  }

  /**
   * Get current noise suppression method
   */
  getNoiseSuppressionMethod() {
    return this.noiseSuppressor ? this.noiseSuppressor.getCurrentMethod() : 'none'
  }

  /**
   * Set local mute for a specific user
   */
  setUserLocalMuted(userId: number, muted: boolean) {
    const peerConnection = this.peers.get(userId)
    if (peerConnection?.audioElement) {
      peerConnection.audioElement.muted = muted
      console.log(
        `[WebRTC] ${muted ? 'Locally muted' : 'Locally unmuted'} ${peerConnection.username}`
      )
    }
  }

  /**
   * Set volume for a specific user (combines user volume with master volume and attenuation)
   */
  setUserVolume(userId: number, volume: number) {
    const peerConnection = this.peers.get(userId)
    if (peerConnection?.audioElement) {
      // Get voice settings for attenuation and master volume
      const voiceSettings = useVoiceSettingsStore.getState().settings

      // Apply attenuation (reduction from master volume)
      const attenuationFactor = (100 - voiceSettings.output.attenuation) / 100

      // Apply a more pronounced volume curve for better user experience
      // Use a curve that makes volume changes more noticeable, especially at lower levels
      const normalizedVolume = volume / 100 // 0-2 range from slider 0-200
      const curvedVolume =
        normalizedVolume < 1
          ? Math.pow(normalizedVolume, 1.5) // More pronounced at lower volumes
          : 1 + Math.pow(normalizedVolume - 1, 1.2) // Less aggressive at higher volumes

      // Combine master volume, curved user volume, and attenuation
      const masterVolumeFactor = voiceSettings.output.masterVolume / 100
      const finalVolume = masterVolumeFactor * curvedVolume * attenuationFactor

      // Clamp volume between 0 and 3 (0% to 300% for more headroom)
      const clampedVolume = Math.max(0, Math.min(3, finalVolume))

      peerConnection.audioElement.volume = clampedVolume
      console.log(
        `[WebRTC] Set volume for ${peerConnection.username} to ${(clampedVolume * 100).toFixed(0)}% (slider: ${volume}%, master: ${voiceSettings.output.masterVolume}%, attenuation: ${voiceSettings.output.attenuation}%)`
      )
    }
  }

  /**
   * Apply attenuation to all connected users
   */
  applyAttenuationToAll(attenuation: number) {
    console.log(`[WebRTC] Applying attenuation of ${attenuation}% to all users`)

    this.peers.forEach((peerConnection, userId) => {
      if (peerConnection.audioElement) {
        // Get current user volume from voice store (stored as decimal 0-2)
        const userVolumeDecimal =
          useVoiceStore.getState().connectedUsers.get(userId)?.localVolume || 1.0
        // Convert to percentage for setUserVolume
        const userVolumePercentage = userVolumeDecimal * 100
        this.setUserVolume(userId, userVolumePercentage)
      }
    })
  }

  /**
   * Apply master volume to all connected users
   */
  applyMasterVolumeToAll(masterVolume: number) {
    console.log(`[WebRTC] Applying master volume of ${masterVolume}% to all users`)

    this.peers.forEach((peerConnection, userId) => {
      if (peerConnection.audioElement) {
        // Get current user volume from voice store (stored as decimal 0-2)
        const userVolumeDecimal =
          useVoiceStore.getState().connectedUsers.get(userId)?.localVolume || 1.0
        // Convert to percentage for setUserVolume
        const userVolumePercentage = userVolumeDecimal * 100
        this.setUserVolume(userId, userVolumePercentage)
      }
    })
  }

  /**
   * Get video constraints based on settings
   */
  private getVideoConstraints(): MediaTrackConstraints {
    const voiceSettings = useVoiceSettingsStore.getState().settings

    // Resolution mapping
    const resolutionMap = {
      '360p': { width: 640, height: 360 },
      '480p': { width: 854, height: 480 },
      '720p': { width: 1280, height: 720 },
    }

    const resolution = resolutionMap[voiceSettings.video.resolution]

    const constraints: MediaTrackConstraints = {
      width: { ideal: resolution.width },
      height: { ideal: resolution.height },
      frameRate: { ideal: voiceSettings.video.frameRate },
    }

    // Use specific device if selected
    if (voiceSettings.video.deviceId && voiceSettings.video.deviceId !== 'default') {
      constraints.deviceId = { exact: voiceSettings.video.deviceId }
    }

    return constraints
  }

  /**
   * Enable camera and add video track to all peer connections
   */
  async enableCamera(): Promise<void> {
    try {
      console.log('[WebRTC] Enabling camera...')

      if (this.videoEnabled) {
        console.log('[WebRTC] Camera already enabled')
        return
      }

      // Get video constraints
      const videoConstraints = this.getVideoConstraints()

      // Request video stream
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      })

      console.log('[WebRTC] ✅ Got video stream:', videoStream.getVideoTracks())

      this.localVideoStream = videoStream
      this.videoEnabled = true

      // Update voice store
      useVoiceStore.getState().setLocalVideoEnabled(true)
      useVoiceStore.getState().setLocalVideoStream(videoStream)

      // Add video track to the local stream so it becomes part of the same stream
      // that the peer connections are using
      const videoTrack = videoStream.getVideoTracks()[0]
      if (videoTrack && this.localStream) {
        // Add the video track to the existing audio stream
        this.localStream.addTrack(videoTrack)
        console.log('[WebRTC] Added video track to localStream')

        // Now add the track to all peer connections using the localStream
        for (const [userId, peerConnection] of this.peers.entries()) {
          try {
            const simplePeer = peerConnection.peer
            const rtcPeerConnection = (simplePeer as any)._pc as RTCPeerConnection

            if (rtcPeerConnection && rtcPeerConnection.signalingState === 'stable') {
              // Add the video track and associate it with localStream (the stream the peer knows about)
              const sender = rtcPeerConnection.addTrack(videoTrack, this.localStream)
              console.log(`[WebRTC] Added video track to peer ${userId}`, sender)

              console.log(`[WebRTC] Triggering renegotiation for peer ${userId}`)

              // Create new offer and trigger SimplePeer's signal emission
              rtcPeerConnection
                .createOffer()
                .then((offer) => {
                  console.log(`[WebRTC] Created renegotiation offer for peer ${userId}`)
                  return rtcPeerConnection.setLocalDescription(offer)
                })
                .then(() => {
                  console.log(
                    `[WebRTC] Set local description for renegotiation with peer ${userId}`
                  )

                  // Manually trigger SimplePeer's signal event with the new offer
                  const localDescription = rtcPeerConnection.localDescription
                  if (localDescription) {
                    simplePeer.emit('signal', {
                      type: localDescription.type,
                      sdp: localDescription.sdp,
                    })
                    console.log(`[WebRTC] Emitted renegotiation signal for peer ${userId}`)
                  }
                })
                .catch((error) => {
                  console.error(`[WebRTC] Renegotiation failed for peer ${userId}:`, error)
                })
            }
          } catch (error) {
            console.error(`[WebRTC] Failed to add video track to peer ${userId}:`, error)
          }
        }
      }

      console.log('[WebRTC] Camera enabled successfully')
    } catch (error) {
      console.error('[WebRTC] Failed to enable camera:', error)
      this.videoEnabled = false
      useVoiceStore.getState().setLocalVideoEnabled(false)

      // Provide specific error messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error(
            'Camera access denied. Please allow camera permissions in your browser settings.'
          )
        } else if (error.name === 'NotFoundError') {
          throw new Error('No camera found. Please connect a camera device.')
        } else if (error.name === 'NotReadableError') {
          throw new Error('Camera is already in use by another application.')
        } else if (error.name === 'OverconstrainedError') {
          throw new Error(
            'Selected camera does not support the requested settings. Try a different resolution.'
          )
        }
      }

      throw new Error('Failed to access camera. Please check your device and try again.')
    }
  }

  /**
   * Disable camera and remove video track from all peer connections
   */
  async disableCamera(): Promise<void> {
    try {
      console.log('[WebRTC] Disabling camera...')

      if (!this.videoEnabled || !this.localVideoStream) {
        console.log('[WebRTC] Camera already disabled')
        return
      }

      // First, remove video track from localStream
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks()
        videoTracks.forEach((track) => {
          this.localStream!.removeTrack(track)
          track.stop()
          console.log('[WebRTC] Removed and stopped video track from localStream:', track.label)
        })
      }

      // Remove video track from all peer connections
      this.peers.forEach((peerConnection, userId) => {
        try {
          const simplePeer = peerConnection.peer
          const rtcPeerConnection = (simplePeer as any)._pc as RTCPeerConnection

          if (rtcPeerConnection && rtcPeerConnection.signalingState === 'stable') {
            // Find and remove video senders
            const senders = rtcPeerConnection.getSenders()
            senders.forEach((sender) => {
              if (sender.track && sender.track.kind === 'video') {
                rtcPeerConnection.removeTrack(sender)
                console.log(`[WebRTC] Removed video track from peer ${userId}`)
              }
            })

            // Trigger renegotiation after removing track
            console.log(
              `[WebRTC] Triggering renegotiation after removing video from peer ${userId}`
            )
            rtcPeerConnection
              .createOffer()
              .then((offer) => {
                console.log(`[WebRTC] Created renegotiation offer for peer ${userId}`)
                return rtcPeerConnection.setLocalDescription(offer)
              })
              .then(() => {
                console.log(`[WebRTC] Set local description for renegotiation with peer ${userId}`)

                // Manually trigger SimplePeer's signal event with the new offer
                const localDescription = rtcPeerConnection.localDescription
                if (localDescription) {
                  simplePeer.emit('signal', {
                    type: localDescription.type,
                    sdp: localDescription.sdp,
                  })
                  console.log(`[WebRTC] Emitted renegotiation signal for peer ${userId}`)
                }
              })
              .catch((error) => {
                console.error(`[WebRTC] Renegotiation failed for peer ${userId}:`, error)
              })
          }
        } catch (error) {
          console.error(`[WebRTC] Failed to remove video track from peer ${userId}:`, error)
        }
      })

      // Stop and clean up the separate video stream
      if (this.localVideoStream) {
        this.localVideoStream.getTracks().forEach((track) => {
          track.stop()
        })
      }

      this.localVideoStream = null
      this.videoEnabled = false

      // Update voice store
      useVoiceStore.getState().setLocalVideoEnabled(false)
      useVoiceStore.getState().setLocalVideoStream(null)

      console.log('[WebRTC] Camera disabled successfully')
    } catch (error) {
      console.error('[WebRTC] Error disabling camera:', error)
      throw error
    }
  }

  /**
   * Get available video devices
   */
  async getAvailableVideoDevices(): Promise<MediaDeviceInfo[]> {
    try {
      // Request permission first to get device labels
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true })

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === 'videoinput')

      // Stop permission stream
      permissionStream.getTracks().forEach((track) => track.stop())

      return videoDevices
    } catch (error) {
      console.error('[WebRTC] Failed to get video devices:', error)
      return []
    }
  }

  /**
   * Switch to a different camera device
   */
  async switchVideoDevice(deviceId: string): Promise<void> {
    try {
      console.log(`[WebRTC] Switching to camera device: ${deviceId}`)

      const wasEnabled = this.videoEnabled

      // If camera is currently enabled, disable it first
      if (wasEnabled) {
        await this.disableCamera()
      }

      // Update settings
      useVoiceSettingsStore.getState().updateVideoSettings({ deviceId })

      // If camera was enabled, re-enable it with new device
      if (wasEnabled) {
        await this.enableCamera()
      }

      console.log('[WebRTC] Switched camera device successfully')
    } catch (error) {
      console.error('[WebRTC] Failed to switch camera device:', error)
      throw error
    }
  }

  /**
   * Check if camera is enabled
   */
  isCameraEnabled(): boolean {
    return this.videoEnabled
  }

  /**
   * Get local video stream
   */
  getLocalVideoStream(): MediaStream | null {
    return this.localVideoStream
  }

  /**
   * Adaptive video quality management
   * Steps down quality based on connection issues
   */
  private currentVideoQuality: { resolution: '360p' | '480p' | '720p'; frameRate: 15 | 30 } = {
    resolution: '720p',
    frameRate: 30,
  }

  private qualityAdjustmentTimeout: number | null = null

  /**
   * Adjust video quality based on connection stats
   */
  private async adjustVideoQuality(
    _lossRate: number,
    _jitter: number,
    shouldIncrease: boolean = false
  ): Promise<void> {
    if (!this.videoEnabled || !this.localVideoStream) {
      return
    }

    // Clear any pending adjustments
    if (this.qualityAdjustmentTimeout) {
      clearTimeout(this.qualityAdjustmentTimeout)
      this.qualityAdjustmentTimeout = null
    }

    const currentRes = this.currentVideoQuality.resolution
    const currentFps = this.currentVideoQuality.frameRate

    let newResolution = currentRes
    let newFrameRate = currentFps

    if (shouldIncrease) {
      // Step up quality when connection improves
      if (currentRes === '360p' && currentFps === 15) {
        newResolution = '360p'
        newFrameRate = 30
      } else if (currentRes === '360p' && currentFps === 30) {
        newResolution = '480p'
        newFrameRate = 30
      } else if (currentRes === '480p') {
        newResolution = '720p'
        newFrameRate = 30
      }
    } else {
      // Step down quality when connection degrades
      if (currentRes === '720p') {
        newResolution = '480p'
        newFrameRate = 30
      } else if (currentRes === '480p') {
        newResolution = '360p'
        newFrameRate = 30
      } else if (currentRes === '360p' && currentFps === 30) {
        newResolution = '360p'
        newFrameRate = 15
      }
      // If already at lowest quality, can't reduce further
    }

    // Check if quality needs to change
    if (newResolution !== currentRes || newFrameRate !== currentFps) {
      console.log(
        `[WebRTC] Adjusting video quality from ${currentRes}@${currentFps}fps to ${newResolution}@${newFrameRate}fps`
      )

      this.currentVideoQuality = {
        resolution: newResolution,
        frameRate: newFrameRate,
      }

      // Apply new constraints to the video track
      try {
        const videoTrack = this.localVideoStream.getVideoTracks()[0]
        if (videoTrack) {
          const resolutionMap = {
            '360p': { width: 640, height: 360 },
            '480p': { width: 854, height: 480 },
            '720p': { width: 1280, height: 720 },
          }

          const resolution = resolutionMap[newResolution]

          await videoTrack.applyConstraints({
            width: { ideal: resolution.width },
            height: { ideal: resolution.height },
            frameRate: { ideal: newFrameRate },
          })

          console.log('[WebRTC] Video quality adjusted successfully')

          // Show notification to user
          if (!shouldIncrease) {
            useVoiceStore
              .getState()
              .addQualityWarning(
                `Video quality reduced to ${newResolution}@${newFrameRate}fps due to connection issues`
              )
          }
        }
      } catch (error) {
        console.error('[WebRTC] Failed to adjust video quality:', error)
      }
    }
  }

  /**
   * Monitor connection stats and trigger quality adjustments
   * This is called periodically from the quality monitoring system
   */
  async handleVideoQualityAdjustment(
    _userId: number,
    lossRate: number,
    jitter: number
  ): Promise<void> {
    // Define thresholds for quality adjustment
    const CRITICAL_LOSS = 0.1
    const HIGH_LOSS = 0.05
    const GOOD_LOSS = 0.01

    const CRITICAL_JITTER = 0.1
    const HIGH_JITTER = 0.05
    const GOOD_JITTER = 0.02

    const isCritical = lossRate > CRITICAL_LOSS || jitter > CRITICAL_JITTER
    const isHigh = lossRate > HIGH_LOSS || jitter > HIGH_JITTER
    const isGood = lossRate < GOOD_LOSS && jitter < GOOD_JITTER

    if (isCritical || isHigh) {
      // Poor connection - reduce quality
      await this.adjustVideoQuality(lossRate, jitter, false)
    } else if (isGood) {
      // Good connection - try to increase quality after a delay
      // Wait 30 seconds before increasing to ensure stable connection
      if (!this.qualityAdjustmentTimeout) {
        this.qualityAdjustmentTimeout = window.setTimeout(async () => {
          await this.adjustVideoQuality(lossRate, jitter, true)
          this.qualityAdjustmentTimeout = null
        }, 30000)
      }
    }
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService()
export default webrtcService
