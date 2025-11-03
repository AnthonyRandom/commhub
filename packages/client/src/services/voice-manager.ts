import { wsService } from './websocket'
import { webrtcService } from './webrtc'
import { useVoiceStore } from '../stores/voice'
import type SimplePeer from 'simple-peer'

class VoiceManager {
  private isInitialized = false

  /**
   * Initialize voice manager and set up WebSocket listeners
   */
  initialize() {
    if (this.isInitialized) {
      return
    }

    this.isInitialized = true
    this.setupWebSocketListeners()
  }

  /**
   * Set up WebSocket event listeners for voice signaling
   */
  private setupWebSocketListeners() {
    const socket = wsService.getSocket()
    if (!socket) return

    // Listen for existing users in voice channel
    socket.on('voice-channel-users', this.handleVoiceChannelUsers.bind(this))

    // Listen for new user joining voice channel
    socket.on('voice-user-joined', this.handleVoiceUserJoined.bind(this))

    // Listen for user leaving voice channel
    socket.on('voice-user-left', this.handleVoiceUserLeft.bind(this))

    // Listen for WebRTC offers
    socket.on('voice-offer', this.handleVoiceOffer.bind(this))

    // Listen for WebRTC answers
    socket.on('voice-answer', this.handleVoiceAnswer.bind(this))

    // Listen for ICE candidates
    socket.on('voice-ice-candidate', this.handleVoiceIceCandidate.bind(this))
  }

  /**
   * Join a voice channel
   */
  async joinVoiceChannel(channelId: number): Promise<void> {
    try {
      useVoiceStore.getState().setIsConnecting(true)
      useVoiceStore.getState().setConnectionError(null)

      // Initialize local audio stream
      await webrtcService.initializeLocalStream()

      // Set current channel
      webrtcService.setCurrentChannelId(channelId)
      useVoiceStore.getState().setConnectedChannel(channelId)

      // Join the voice channel via WebSocket
      wsService.getSocket()?.emit('join-voice-channel', { channelId })

      useVoiceStore.getState().setIsConnecting(false)
    } catch (error) {
      console.error('Failed to join voice channel:', error)
      useVoiceStore.getState().setIsConnecting(false)
      useVoiceStore
        .getState()
        .setConnectionError(error instanceof Error ? error.message : 'Failed to join voice channel')
      this.cleanup()
      throw error
    }
  }

  /**
   * Leave the current voice channel
   */
  leaveVoiceChannel() {
    const channelId = webrtcService.getCurrentChannelId()
    if (!channelId) {
      return
    }

    // Notify server
    wsService.getSocket()?.emit('leave-voice-channel', { channelId })

    // Clean up
    this.cleanup()
  }

  /**
   * Handle receiving list of users already in voice channel
   */
  private handleVoiceChannelUsers(data: {
    channelId: number
    users: Array<{ userId: number; username: string }>
  }) {
    console.log('Users in voice channel:', data.users)

    // Create peer connections to all existing users (we are the initiator)
    data.users.forEach((user) => {
      this.createPeerConnection(user.userId, user.username, true)
    })
  }

  /**
   * Handle new user joining voice channel
   */
  private handleVoiceUserJoined(data: { channelId: number; userId: number; username: string }) {
    console.log('User joined voice channel:', data.username)

    // Add user to voice store
    useVoiceStore.getState().addConnectedUser({
      userId: data.userId,
      username: data.username,
      isSpeaking: false,
      isMuted: false,
    })

    // Don't create peer connection here - wait for them to send us an offer
  }

  /**
   * Handle user leaving voice channel
   */
  private handleVoiceUserLeft(data: { channelId: number; userId: number; username: string }) {
    console.log('User left voice channel:', data.username)

    // Remove peer connection
    webrtcService.removePeer(data.userId)
  }

  /**
   * Handle receiving WebRTC offer
   */
  private handleVoiceOffer(data: {
    channelId: number
    fromUserId: number
    fromUsername: string
    offer: SimplePeer.SignalData
  }) {
    console.log('Received voice offer from:', data.fromUsername)

    // Create peer connection (we are not the initiator)
    this.createPeerConnection(data.fromUserId, data.fromUsername, false, data.offer)
  }

  /**
   * Handle receiving WebRTC answer
   */
  private handleVoiceAnswer(data: {
    channelId: number
    fromUserId: number
    fromUsername: string
    answer: SimplePeer.SignalData
  }) {
    console.log('Received voice answer from:', data.fromUsername)

    // Signal the peer with the answer
    webrtcService.signal(data.fromUserId, data.answer)
  }

  /**
   * Handle receiving ICE candidate
   */
  private handleVoiceIceCandidate(data: {
    channelId: number
    fromUserId: number
    candidate: SimplePeer.SignalData
  }) {
    // Signal the peer with the ICE candidate
    webrtcService.signal(data.fromUserId, data.candidate)
  }

  /**
   * Create a peer connection to another user
   */
  private createPeerConnection(
    userId: number,
    username: string,
    isInitiator: boolean,
    initialSignal?: SimplePeer.SignalData
  ) {
    const channelId = webrtcService.getCurrentChannelId()
    if (!channelId) {
      return
    }

    // Add user to voice store if not already there
    const voiceStore = useVoiceStore.getState()
    if (!voiceStore.connectedUsers.has(userId)) {
      voiceStore.addConnectedUser({
        userId,
        username,
        isSpeaking: false,
        isMuted: false,
      })
    }

    // Create peer connection
    const peer = webrtcService.createPeerConnection(
      userId,
      username,
      isInitiator,
      (signal) => {
        // Send signaling data via WebSocket
        const eventName =
          signal.type === 'offer'
            ? 'voice-offer'
            : signal.type === 'answer'
              ? 'voice-answer'
              : 'voice-ice-candidate'

        const socket = wsService.getSocket()
        if (!socket) return

        if (eventName === 'voice-offer') {
          socket.emit('voice-offer', {
            channelId,
            targetUserId: userId,
            offer: signal,
          })
        } else if (eventName === 'voice-answer') {
          socket.emit('voice-answer', {
            channelId,
            targetUserId: userId,
            answer: signal,
          })
        } else {
          socket.emit('voice-ice-candidate', {
            channelId,
            targetUserId: userId,
            candidate: signal,
          })
        }
      },
      () => {
        console.log('Received stream from:', username)
      },
      () => {
        console.log('Peer connection closed:', username)
        voiceStore.removeConnectedUser(userId)
      }
    )

    // If we received an initial signal (offer), signal it to the peer
    if (initialSignal) {
      peer.signal(initialSignal)
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    const voiceStore = useVoiceStore.getState()
    const newMutedState = !voiceStore.isMuted
    webrtcService.setMuted(newMutedState)
  }

  /**
   * Toggle deafen state
   */
  toggleDeafen() {
    const voiceStore = useVoiceStore.getState()
    const newDeafenedState = !voiceStore.isDeafened
    webrtcService.setDeafened(newDeafenedState)
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return webrtcService.getCurrentChannelId() !== null
  }

  /**
   * Get current channel ID
   */
  getCurrentChannelId(): number | null {
    return webrtcService.getCurrentChannelId()
  }

  /**
   * Clean up all voice connections
   */
  cleanup() {
    webrtcService.cleanup()
  }
}

// Export singleton instance
export const voiceManager = new VoiceManager()
export default voiceManager
