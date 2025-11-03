import SimplePeer from 'simple-peer'
import { useVoiceStore } from '../stores/voice'

interface PeerConnection {
  peer: SimplePeer.Instance
  userId: number
  username: string
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })

      this.localStream = stream
      useVoiceStore.getState().setLocalStream(stream)

      // Set up audio context for speaking detection
      this.setupSpeakingDetection(stream)

      return stream
    } catch (error) {
      console.error('Failed to get user media:', error)
      throw new Error('Failed to access microphone. Please check permissions.')
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

      // Play the audio
      this.playAudioStream(stream)
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
  private playAudioStream(stream: MediaStream) {
    const audio = new Audio()
    audio.srcObject = stream
    audio.autoplay = true
    audio.play().catch((error) => {
      console.error('Failed to play audio stream:', error)
    })
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
    // Stop speaking detection
    this.stopSpeakingCheck()

    // Destroy all peer connections
    this.peers.forEach((peerConnection) => {
      try {
        peerConnection.peer.destroy()
      } catch (error) {
        console.error('Error destroying peer:', error)
      }
    })
    this.peers.clear()

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
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
