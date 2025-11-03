import SimplePeer from 'simple-peer'
import { useVoiceStore } from '../stores/voice'

interface PeerConnection {
  peer: SimplePeer.Instance
  userId: number
  username: string
  audioElement?: HTMLAudioElement
}

class WebRTCService {
  private peers: Map<number, PeerConnection> = new Map()
  private localStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private speakingCheckInterval: number | null = null
  private currentChannelId: number | null = null

  // Configuration for WebRTC
  private rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  }

  // Speaking detection threshold (0-255)
  private readonly SPEAKING_THRESHOLD = 30
  private readonly SPEAKING_CHECK_INTERVAL = 100 // ms

  /**
   * Initialize local audio stream
   */
  async initializeLocalStream(): Promise<MediaStream> {
    try {
      // Get selected audio device from settings
      const savedSettings = localStorage.getItem('commhub-settings')
      let audioDeviceId: string | undefined

      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings)
          audioDeviceId = settings.audioInputDeviceId
        } catch (error) {
          console.warn('[WebRTC] Failed to parse settings:', error)
        }
      }

      // Build audio constraints
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }

      // Use specific device if selected
      if (audioDeviceId && audioDeviceId !== 'default') {
        console.log(`[WebRTC] Using selected audio device: ${audioDeviceId}`)
        audioConstraints.deviceId = { exact: audioDeviceId }
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
      useVoiceStore.getState().setLocalStream(stream)

      // Set up audio context for speaking detection
      this.setupSpeakingDetection(stream)

      return stream
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
   * Set up audio analysis for detecting when user is speaking
   */
  private setupSpeakingDetection(stream: MediaStream) {
    try {
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.8

      const source = this.audioContext.createMediaStreamSource(stream)
      source.connect(this.analyser)

      // Start checking for speaking
      this.startSpeakingCheck()
    } catch (error) {
      console.error('Failed to set up speaking detection:', error)
    }
  }

  /**
   * Start periodic check for speaking activity
   */
  private startSpeakingCheck() {
    if (this.speakingCheckInterval) {
      return
    }

    this.speakingCheckInterval = window.setInterval(() => {
      this.checkIfSpeaking()
      // You can emit speaking status via websocket here if needed
      // For now, we'll just update local state
    }, this.SPEAKING_CHECK_INTERVAL)
  }

  /**
   * Stop speaking detection
   */
  private stopSpeakingCheck() {
    if (this.speakingCheckInterval) {
      clearInterval(this.speakingCheckInterval)
      this.speakingCheckInterval = null
    }
  }

  /**
   * Check if user is currently speaking based on audio analysis
   */
  private checkIfSpeaking(): boolean {
    if (!this.analyser) {
      return false
    }

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b) / bufferLength

    return average > this.SPEAKING_THRESHOLD
  }

  /**
   * Create a peer connection to another user
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

    // Remove existing peer if it exists
    this.removePeer(userId)

    const peer = new SimplePeer({
      initiator: isInitiator,
      stream: this.localStream,
      config: this.rtcConfig,
      trickle: true,
    })

    // Handle signaling
    peer.on('signal', (signal) => {
      onSignal(signal)
    })

    // Handle incoming stream
    peer.on('stream', (stream) => {
      console.log('Received stream from user:', username)
      useVoiceStore.getState().updateUserStream(userId, stream)
      onStream(stream)

      // Play the audio and store reference
      const audioElement = this.playAudioStream(stream, userId, username)
      const peerConnection = this.peers.get(userId)
      if (peerConnection) {
        peerConnection.audioElement = audioElement
      }
    })

    // Handle connection errors
    peer.on('error', (err) => {
      console.error('Peer connection error:', err)
      this.removePeer(userId)
      onClose()
    })

    // Handle peer disconnection
    peer.on('close', () => {
      console.log('Peer connection closed:', username)
      this.removePeer(userId)
      onClose()
    })

    // Store peer connection
    this.peers.set(userId, { peer, userId, username })

    return peer
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

    // When deafened, also mute
    if (deafened) {
      this.setMuted(true)
    }
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
   * Clean up all connections and streams
   */
  cleanup() {
    console.log('[WebRTC] Cleaning up all connections and streams')

    // Stop speaking detection
    this.stopSpeakingCheck()

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

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log('[WebRTC] Stopping local track:', track.kind)
        track.stop()
      })
      this.localStream = null
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.analyser = null
    this.currentChannelId = null

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
}

// Export singleton instance
export const webrtcService = new WebRTCService()
export default webrtcService
