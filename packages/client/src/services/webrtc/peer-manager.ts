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

    // Remove existing peer if it exists (but don't remove from voice store)
    this.cleanupPeerConnection(userId)

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

      // Listen for dynamically added tracks (e.g., screen share audio during renegotiation)
      stream.addEventListener('addtrack', (event) => {
        const track = event.track
        if (track.kind === 'audio') {
          const audioTracks = stream.getAudioTracks()
          const trackIndex = audioTracks.indexOf(track)
          const label = track.label.toLowerCase()

          // Identify if this is a screen share audio track
          // Screen share audio typically has labels containing "desktop", "screen", "system", etc.
          // OR it's a track after the first one (microphone)
          const isScreenShareAudio =
            trackIndex > 0 ||
            label.includes('desktop') ||
            label.includes('screen') ||
            label.includes('system') ||
            label.includes('audio capture')

          if (isScreenShareAudio) {
            // Check if this user is currently focused
            const focusedUserId = useVoiceStore.getState().focusedStreamUserId
            const shouldEnable = focusedUserId === userId

            track.enabled = shouldEnable
            logger.info(
              'PeerManager',
              `New screen share audio track added for ${username}, ${shouldEnable ? 'enabled' : 'disabled'} based on focus state`,
              {
                userId,
                trackId: track.id,
                trackIndex,
                trackLabel: track.label,
                focusedUserId,
              }
            )
          } else {
            // This is likely the microphone track - ensure it's always enabled
            track.enabled = true
            logger.debug('PeerManager', `Ensured microphone track enabled for ${username}`, {
              userId,
              trackId: track.id,
              trackLabel: track.label,
            })
          }
        }
      })

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

    // Handle multiple audio tracks: first is voice (always on), rest are screen share audio (off by default)
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length > 1) {
      logger.info(
        'PeerManager',
        `Stream has ${audioTracks.length} audio tracks, muting screen share audio by default`,
        {
          userId,
          username,
        }
      )
      // Keep first track (microphone) enabled, disable additional tracks (screen share audio)
      for (let i = 1; i < audioTracks.length; i++) {
        audioTracks[i].enabled = false
        logger.info('PeerManager', `Disabled screen share audio track ${i} for ${username}`, {
          userId,
          trackId: audioTracks[i].id,
        })
      }
    }

    // Apply user-specific volume settings
    const voiceStore = useVoiceStore.getState()
    const connectedUser = voiceStore.connectedUsers.get(userId)
    if (connectedUser) {
      audioElement.volume = connectedUser.localVolume
    }

    // Mute audio if user is deafened
    if (voiceStore.isDeafened) {
      audioElement.muted = true
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
   * Clean up peer connection without removing from voice store
   * Used when recreating a connection to an existing user
   */
  private cleanupPeerConnection(userId: number): void {
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
  }

  /**
   * Remove a peer connection and remove from voice store
   * Used when a user actually leaves the channel
   */
  removePeer(userId: number): void {
    this.cleanupPeerConnection(userId)

    // Update store - only called when user actually leaves
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
      // Clamp volume to 0-1 range (HTML5 Audio API limitation)
      // Note: Values above 1.0 from UI (for boost) are clamped to 1.0
      peerConnection.audioElement.volume = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * Set user local muted state
   */
  setUserLocalMuted(userId: number, muted: boolean): void {
    const peerConnection = this.peers.get(userId)
    if (peerConnection?.audioElement) {
      peerConnection.audioElement.muted = muted
      logger.info('PeerManager', `${muted ? 'Locally muted' : 'Locally unmuted'} user ${userId}`, {
        userId,
        username: peerConnection.username,
      })
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
   * Mute or unmute all remote audio elements (for deafen functionality)
   */
  setAllAudioMuted(muted: boolean): void {
    this.peers.forEach((peerConnection) => {
      if (peerConnection.audioElement) {
        peerConnection.audioElement.muted = muted
      }
    })

    logger.info('PeerManager', `${muted ? 'Muted' : 'Unmuted'} all remote audio`, {
      peerCount: this.peers.size,
    })
  }

  /**
   * Enable or disable screen share audio for a specific user
   * Screen share audio is in additional audio tracks (beyond the first microphone track)
   * Uses track labels to identify screen share audio more reliably than index
   */
  setUserScreenShareAudio(userId: number, enabled: boolean): void {
    const peerConnection = this.peers.get(userId)
    if (!peerConnection?.audioElement?.srcObject) {
      logger.debug(
        'PeerManager',
        `No audio element for user ${userId}, skipping screen share audio update`
      )
      return
    }

    const stream = peerConnection.audioElement.srcObject as MediaStream
    const audioTracks = stream.getAudioTracks()

    if (audioTracks.length === 0) {
      logger.debug('PeerManager', `No audio tracks for user ${userId}`)
      return
    }

    // Identify microphone track (first track is typically the microphone)
    // Screen share audio tracks typically have labels like "Desktop Audio" or similar
    const microphoneTrack = audioTracks[0]
    const screenShareTracks: MediaStreamTrack[] = []

    // Find screen share audio tracks
    // They are typically tracks after the first one (microphone is always first)
    for (let i = 0; i < audioTracks.length; i++) {
      const track = audioTracks[i]

      // Skip the first track (microphone) - it's never screen share audio
      if (i === 0) {
        continue
      }

      // All tracks after the first are considered screen share audio
      screenShareTracks.push(track)
    }

    // CRITICAL: Always ensure microphone track stays enabled
    if (microphoneTrack) {
      microphoneTrack.enabled = true
      logger.debug('PeerManager', `Ensured microphone track stays enabled for user ${userId}`, {
        userId,
        trackId: microphoneTrack.id,
        trackLabel: microphoneTrack.label,
      })
    }

    // Enable/disable screen share audio tracks
    for (const track of screenShareTracks) {
      track.enabled = enabled
      logger.info(
        'PeerManager',
        `${enabled ? 'Enabled' : 'Disabled'} screen share audio track for user ${userId}`,
        {
          userId,
          trackId: track.id,
          trackLabel: track.label,
        }
      )
    }

    if (screenShareTracks.length === 0 && audioTracks.length > 1) {
      // Fallback: if we couldn't identify screen share tracks by label,
      // assume tracks after the first are screen share (original behavior)
      logger.debug(
        'PeerManager',
        `Using fallback: treating tracks after first as screen share for user ${userId}`
      )
      for (let i = 1; i < audioTracks.length; i++) {
        audioTracks[i].enabled = enabled
        logger.info(
          'PeerManager',
          `${enabled ? 'Enabled' : 'Disabled'} screen share audio track ${i} (fallback) for user ${userId}`,
          {
            userId,
            trackId: audioTracks[i].id,
            trackLabel: audioTracks[i].label,
          }
        )
      }
    }
  }

  /**
   * Disable screen share audio for all users except the specified one
   * Used when focusing on a specific user's stream
   */
  setFocusedUserScreenShareAudio(focusedUserId: number | null): void {
    this.peers.forEach((_, userId) => {
      const shouldEnable = focusedUserId === userId
      this.setUserScreenShareAudio(userId, shouldEnable)
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
