import SimplePeer from 'simple-peer'
import { useVoiceStore } from '../../stores/voice'
import { wsService } from '../websocket'
import { logger } from '../../utils/logger'
import { handleError, NetworkError } from '../../utils/errors'
import type { PeerConnection, ConnectionState, ConnectionCallbacks } from './types'

/**
 * Manages WebRTC peer connections, including creation, signaling, and cleanup
 */
export class PeerConnectionManager {
  private peers: Map<number, PeerConnection> = new Map()
  private connectionStates: Map<number, ConnectionState> = new Map()
  private currentChannelId: number | null = null
  private localStream: MediaStream | null = null

  private readonly CONNECTION_TIMEOUT = 30000 // 30 seconds
  private readonly MAX_RETRY_ATTEMPTS = 3
  private readonly RECONNECT_DELAY_BASE = 2000

  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  }

  setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream
  }

  setCurrentChannelId(channelId: number | null): void {
    this.currentChannelId = channelId
  }

  getCurrentChannelId(): number | null {
    return this.currentChannelId
  }

  /**
   * Create a peer connection to another user with enhanced reliability
   */
  createPeerConnection(
    userId: number,
    username: string,
    isInitiator: boolean,
    callbacks: ConnectionCallbacks
  ): SimplePeer.Instance {
    if (!this.localStream) {
      throw new Error('Local stream not initialized')
    }

    // Initialize connection state
    this.connectionStates.set(userId, {
      quality: 'connecting',
      status: 'connecting',
    })

    // Remove existing peer if it exists
    this.removePeer(userId)

    const peer = this.createPeerWithRetry(userId, username, isInitiator, callbacks)

    // Store peer connection
    this.peers.set(userId, {
      peer,
      userId,
      username,
      retryCount: 0,
      lastConnectAttempt: Date.now(),
    })

    return peer
  }

  /**
   * Create peer with retry logic and enhanced error handling
   */
  private createPeerWithRetry(
    userId: number,
    username: string,
    isInitiator: boolean,
    callbacks: ConnectionCallbacks
  ): SimplePeer.Instance {
    const peer = new SimplePeer({
      initiator: isInitiator,
      stream: this.localStream!,
      config: this.rtcConfig,
      trickle: true,
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      },
    })

    let connectionTimeout: number | null = null

    // Set connection timeout
    connectionTimeout = window.setTimeout(() => {
      if (!peer.connected) {
        logger.warn('PeerManager', `Connection timeout for ${username}`, { userId })
        this.handlePeerError(userId, new NetworkError('Connection timeout'), callbacks.onClose)
      }
    }, this.CONNECTION_TIMEOUT)

    // Handle signaling
    peer.on('signal', (signal) => {
      callbacks.onSignal(signal)
    })

    // Handle incoming stream
    peer.on('stream', (stream) => {
      logger.info('PeerManager', `Received stream from ${username}`, {
        userId,
        tracks: stream.getTracks().length,
      })
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }

      this.updateConnectionQuality(userId, 'excellent')

      // Update user stream in store
      useVoiceStore.getState().updateUserStream(userId, stream)
      useVoiceStore.getState().updateUserVideoStream(userId, stream)

      callbacks.onStream(stream)

      // Play the audio and store reference
      const audioElement = this.playAudioStream(stream, userId, username)
      const peerConnection = this.peers.get(userId)
      if (peerConnection) {
        peerConnection.audioElement = audioElement
      }

      // Start quality monitoring
      const rtcPeerConnection = (peer as any)._pc as RTCPeerConnection
      if (rtcPeerConnection) {
        this.setupICEConnectionMonitoring(rtcPeerConnection, userId, username)
        this.startConnectionQualityMonitoring(userId, rtcPeerConnection)
      }
    })

    // Handle connection established
    peer.on('connect', () => {
      logger.info('PeerManager', `Peer connection established with ${username}`, { userId })
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }

      this.updateConnectionQuality(userId, 'excellent')
      useVoiceStore.getState().updateUserConnectionStatus(userId, 'connected')
    })

    // Enhanced error handling with retry logic
    peer.on('error', (err) => {
      logger.error('PeerManager', `Peer connection error for ${username}`, { userId, error: err })
      handleError(err, 'PeerManager')
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }
      this.handlePeerError(userId, err, callbacks.onClose)
    })

    // Handle peer disconnection
    peer.on('close', () => {
      logger.info('PeerManager', `Peer connection closed: ${username}`, { userId })
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }
      this.handlePeerDisconnect(userId, callbacks.onClose)
    })

    return peer
  }

  /**
   * Set up ICE connection state monitoring
   */
  private setupICEConnectionMonitoring(
    rtcPeerConnection: RTCPeerConnection,
    userId: number,
    username: string
  ) {
    rtcPeerConnection.addEventListener('iceconnectionstatechange', () => {
      const state = rtcPeerConnection.iceConnectionState
      logger.debug('PeerManager', `ICE state change for ${username}: ${state}`, { userId, state })

      const connectionState = this.connectionStates.get(userId)
      if (connectionState) {
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
        }
      }
    })
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
        let jitter = 0

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
            packetsLost += report.packetsLost || 0
            packetsReceived += report.packetsReceived || 0
            jitter = Math.max(jitter, report.jitter || 0)
          }
        })

        if (packetsReceived > 0) {
          const lossRate = packetsLost / (packetsLost + packetsReceived)
          const quality = this.calculateQualityFromStats(lossRate, jitter)
          this.updateConnectionQuality(userId, quality)

          // Store stats
          const connectionState = this.connectionStates.get(userId)
          if (connectionState) {
            connectionState.packetLoss = lossRate * 100
            connectionState.jitter = jitter * 1000
          }
        }
      } catch (error) {
        logger.warn('PeerManager', `Failed to get connection stats for user ${userId}`, {
          userId,
          error,
        })
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
    if (lossRate > 0.1 || jitter > 0.1) {
      return 'poor'
    } else if (lossRate > 0.05 || jitter > 0.05) {
      return 'good'
    } else {
      return 'excellent'
    }
  }

  /**
   * Handle peer connection errors with retry logic
   */
  private handlePeerError(userId: number, error: Error, onClose?: () => void) {
    const peerConnection = this.peers.get(userId)
    if (!peerConnection) return

    logger.error('PeerManager', `Handling peer error for user ${userId}`, { userId, error })
    handleError(error, 'PeerManager')

    // Update connection status
    useVoiceStore.getState().updateUserConnectionStatus(userId, 'failed')

    if (peerConnection.retryCount < this.MAX_RETRY_ATTEMPTS) {
      peerConnection.retryCount++
      const delay = this.RECONNECT_DELAY_BASE * Math.pow(2, peerConnection.retryCount - 1)

      logger.info(
        'PeerManager',
        `Retrying connection to user ${userId} in ${delay}ms (attempt ${peerConnection.retryCount}/${this.MAX_RETRY_ATTEMPTS})`,
        { userId, delay, attempt: peerConnection.retryCount, maxAttempts: this.MAX_RETRY_ATTEMPTS }
      )

      setTimeout(() => {
        this.attemptReconnection(userId)
      }, delay)
    } else {
      logger.error('PeerManager', `Max retry attempts reached for user ${userId}`, { userId })
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
      state.status = 'disconnected'
    }

    useVoiceStore.getState().updateUserConnectionStatus(userId, 'disconnected')
    onClose?.()
  }

  /**
   * Attempt to reconnect to a peer
   */
  private attemptReconnection(userId: number) {
    if (!this.currentChannelId) return

    logger.info('PeerManager', `Attempting reconnection to user ${userId}`, {
      userId,
      channelId: this.currentChannelId,
    })

    // Emit reconnection signal through WebSocket
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
    }

    // Update store with both status and quality
    const storeStatus =
      quality === 'critical' ? 'failed' : quality === 'poor' ? 'connecting' : 'connected'
    useVoiceStore.getState().updateUserConnectionStatus(userId, storeStatus)
    useVoiceStore.getState().updateUserConnectionQuality(userId, quality)
  }

  /**
   * Play audio stream from a peer
   */
  private playAudioStream(stream: MediaStream, userId: number, username: string): HTMLAudioElement {
    const audioElement = new Audio()
    audioElement.srcObject = stream
    audioElement.autoplay = true

    // Apply user-specific volume settings
    const voiceStore = useVoiceStore.getState()
    const connectedUser = voiceStore.connectedUsers.get(userId)
    if (connectedUser) {
      audioElement.volume = connectedUser.localVolume
    }

    audioElement.addEventListener('error', (e) => {
      logger.error('PeerManager', `Audio playback error for ${username}`, {
        userId,
        username,
        error: e,
      })
    })

    audioElement.play().catch((err) => {
      logger.error('PeerManager', `Failed to play audio for ${username}`, {
        userId,
        username,
        error: err,
      })
      handleError(err instanceof Error ? err : new Error(String(err)), 'PeerManager')
    })

    return audioElement
  }

  /**
   * Send signal to a peer
   */
  signal(userId: number, signalData: SimplePeer.SignalData): void {
    const peerConnection = this.peers.get(userId)
    if (peerConnection?.peer) {
      try {
        peerConnection.peer.signal(signalData)
      } catch (error) {
        logger.error('PeerManager', `Failed to signal peer ${userId}`, { userId, error })
        handleError(error instanceof Error ? error : new Error(String(error)), 'PeerManager')
      }
    } else {
      logger.warn('PeerManager', `Cannot signal: peer ${userId} not found`, { userId })
    }
  }

  /**
   * Get a peer connection
   */
  getPeer(userId: number): SimplePeer.Instance | undefined {
    return this.peers.get(userId)?.peer
  }

  /**
   * Remove a peer connection
   */
  removePeer(userId: number): void {
    const peerConnection = this.peers.get(userId)
    if (peerConnection) {
      // Stop audio playback
      if (peerConnection.audioElement) {
        peerConnection.audioElement.pause()
        peerConnection.audioElement.srcObject = null
      }

      // Destroy peer connection
      if (peerConnection.peer) {
        peerConnection.peer.destroy()
      }

      this.peers.delete(userId)
    }

    // Clean up connection state
    const state = this.connectionStates.get(userId)
    if (state) {
      // Clear quality monitor interval
      if ((state as any).qualityMonitorInterval) {
        clearInterval((state as any).qualityMonitorInterval)
      }
      this.connectionStates.delete(userId)
    }

    // Update store
    useVoiceStore.getState().removeConnectedUser(userId)
  }

  /**
   * Get all peers
   */
  getPeers(): Map<number, PeerConnection> {
    return this.peers
  }

  /**
   * Get connection qualities
   */
  getConnectionQualities(): Map<number, ConnectionState['quality']> {
    const qualities = new Map<number, ConnectionState['quality']>()
    this.connectionStates.forEach((state, userId) => {
      qualities.set(userId, state.quality)
    })
    return qualities
  }

  /**
   * Set user volume
   */
  setUserVolume(userId: number, volume: number): void {
    const peerConnection = this.peers.get(userId)
    if (peerConnection?.audioElement) {
      peerConnection.audioElement.volume = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * Apply master volume to all peers
   */
  applyMasterVolumeToAll(masterVolume: number): void {
    const voiceStore = useVoiceStore.getState()
    this.peers.forEach((peerConnection, userId) => {
      if (peerConnection.audioElement) {
        const user = voiceStore.connectedUsers.get(userId)
        const localVolume = user?.localVolume ?? 1.0
        peerConnection.audioElement.volume = localVolume * masterVolume
      }
    })
  }

  /**
   * Apply attenuation to all peers
   */
  applyAttenuationToAll(attenuation: number): void {
    const voiceStore = useVoiceStore.getState()
    const attenuationFactor = 1 - attenuation / 100

    this.peers.forEach((peerConnection, userId) => {
      if (peerConnection.audioElement) {
        const user = voiceStore.connectedUsers.get(userId)
        const localVolume = user?.localVolume ?? 1.0
        peerConnection.audioElement.volume = localVolume * attenuationFactor
      }
    })
  }

  /**
   * Clean up all peer connections
   */
  cleanup(): void {
    this.peers.forEach((_, userId) => {
      this.removePeer(userId)
    })
    this.peers.clear()
    this.connectionStates.clear()
  }
}
