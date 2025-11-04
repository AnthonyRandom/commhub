import { wsService } from './websocket'
import { webrtcService } from './webrtc'
import { useVoiceStore } from '../stores/voice'
import { soundManager } from './sound-manager'
import { useSettingsStore } from '../stores/settings'
import { useAuthStore } from '../stores/auth'
import type SimplePeer from 'simple-peer'

class VoiceManager {
  private isInitialized = false

  /**
   * Check if sounds are enabled in settings
   */
  private shouldPlaySounds(): boolean {
    return useSettingsStore.getState().sounds
  }

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

    // Listen for voice channel members updates
    socket.on('voice-channel-members', this.handleVoiceChannelMembers.bind(this))

    // Listen for speaking status updates
    socket.on('voice-user-speaking', this.handleVoiceUserSpeaking.bind(this))

    // Listen for reconnection requests
    socket.on('voice-reconnect-request', this.handleVoiceReconnectRequest.bind(this))
  }

  /**
   * Join a voice channel
   */
  async joinVoiceChannel(channelId: number): Promise<void> {
    try {
      useVoiceStore.getState().setIsConnecting(true)
      useVoiceStore.getState().setConnectionError(null)

      // Initialize sound manager
      soundManager.initialize()

      // Initialize local audio stream
      await webrtcService.initializeLocalStream()

      // Set current channel
      webrtcService.setCurrentChannelId(channelId)
      useVoiceStore.getState().setConnectedChannel(channelId)

      // Join the voice channel via WebSocket
      wsService.getSocket()?.emit('join-voice-channel', { channelId })

      // Play join sound for ourselves (if enabled)
      if (this.shouldPlaySounds()) {
        soundManager.playUserJoined()
      }

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

    // Play leave sound for ourselves (if enabled)
    if (this.shouldPlaySounds()) {
      soundManager.playUserLeft()
    }

    // Remove local user from voice store
    const localUser = useAuthStore.getState().user
    if (localUser) {
      useVoiceStore.getState().removeConnectedUser(localUser.id)
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
    console.log(`[VoiceManager] 📋 Users already in voice channel ${data.channelId}:`, data.users)
    console.log(`[VoiceManager] Creating ${data.users.length} peer connection(s) as initiator`)

    // Create peer connections to all existing users (we are the initiator)
    data.users.forEach((user) => {
      console.log(`[VoiceManager] 🤝 Initiating connection to ${user.username} (${user.userId})`)
      this.createPeerConnection(user.userId, user.username, true)
    })
  }

  /**
   * Handle new user joining voice channel
   */
  private handleVoiceUserJoined(data: { channelId: number; userId: number; username: string }) {
    console.log(`[VoiceManager] ➕ User joined voice channel: ${data.username} (${data.userId})`)

    // Play join sound (only if we're already in the channel and sounds are enabled)
    if (webrtcService.getCurrentChannelId() === data.channelId && this.shouldPlaySounds()) {
      soundManager.playUserJoined()
    }

    // Add user to voice store
    useVoiceStore.getState().addConnectedUser({
      userId: data.userId,
      username: data.username,
      isSpeaking: false,
      isMuted: false,
      connectionStatus: 'connecting',
      connectionQuality: 'connecting',
      localMuted: false,
      localVolume: 1.0,
    })

    console.log(`[VoiceManager] ⏳ Waiting for offer from ${data.username}`)
    // Don't create peer connection here - wait for them to send us an offer
  }

  /**
   * Handle user leaving voice channel
   */
  private handleVoiceUserLeft(data: { channelId: number; userId: number; username: string }) {
    console.log('User left voice channel:', data.username)

    // Play leave sound (only if we're still in the channel and sounds are enabled)
    if (webrtcService.getCurrentChannelId() === data.channelId && this.shouldPlaySounds()) {
      soundManager.playUserLeft()
    }

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
    console.log(
      `[VoiceManager] 📨 Received WebRTC offer from: ${data.fromUsername} (${data.fromUserId})`
    )

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
    console.log(
      `[VoiceManager] 📨 Received WebRTC answer from: ${data.fromUsername} (${data.fromUserId})`
    )

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
    console.log(`[VoiceManager] 🧊 Received ICE candidate from user ${data.fromUserId}`)

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
      console.error('[VoiceManager] ❌ Cannot create peer connection: no channel ID')
      return
    }

    console.log(
      `[VoiceManager] 🔗 Creating peer connection to ${username} (${userId}) - Initiator: ${isInitiator}`
    )

    // Add user to voice store if not already there
    const voiceStore = useVoiceStore.getState()
    if (!voiceStore.connectedUsers.has(userId)) {
      voiceStore.addConnectedUser({
        userId,
        username,
        isSpeaking: false,
        isMuted: false,
        connectionStatus: 'connecting',
        connectionQuality: 'connecting',
        localMuted: false,
        localVolume: 1.0,
      })
    } else {
      // Update status to connecting
      voiceStore.updateUserConnectionStatus(userId, 'connecting')
      voiceStore.updateUserConnectionQuality(userId, 'connecting')
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

        console.log(`[VoiceManager] 📤 Sending ${eventName} to ${username}`)

        const socket = wsService.getSocket()
        if (!socket) {
          console.error('[VoiceManager] ❌ No socket connection')
          return
        }

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
        console.log(`[VoiceManager] 🎵 Stream received from ${username}`)
        // Mark as connected when stream is received
        useVoiceStore.getState().updateUserConnectionStatus(userId, 'connected')
      },
      () => {
        console.log(`[VoiceManager] ❌ Peer connection closed: ${username}`)
        voiceStore.removeConnectedUser(userId)
      }
    )

    // If we received an initial signal (offer), signal it to the peer
    if (initialSignal) {
      console.log(`[VoiceManager] 📥 Signaling initial ${initialSignal.type} to peer`)
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
   * Set local mute for a specific user
   */
  setUserLocalMuted(userId: number, muted: boolean) {
    webrtcService.setUserLocalMuted(userId, muted)
    useVoiceStore.getState().setUserLocalMuted(userId, muted)
  }

  /**
   * Set volume for a specific user
   */
  setUserVolume(userId: number, volume: number) {
    webrtcService.setUserVolume(userId, volume)
    useVoiceStore.getState().setUserLocalVolume(userId, volume)
  }

  /**
   * Update voice settings and apply them to the current session
   */
  updateVoiceSettings(settings: any) {
    const { useVoiceSettingsStore } = require('../stores/voice-settings')
    const voiceSettingsStore = useVoiceSettingsStore.getState()

    // Update detection settings if they changed
    if (settings.detection) {
      voiceSettingsStore.updateDetectionSettings(settings.detection)

      // Update speaking detector configuration
      const speakingConfig: any = {}
      if (settings.detection.mode !== undefined) speakingConfig.mode = settings.detection.mode
      if (settings.detection.pttKey !== undefined) speakingConfig.pttKey = settings.detection.pttKey
      if (settings.detection.holdTime !== undefined)
        speakingConfig.holdTime = settings.detection.holdTime
      if (settings.detection.cooldownTime !== undefined)
        speakingConfig.cooldownTime = settings.detection.cooldownTime

      webrtcService.updateSpeakingConfig(speakingConfig)
    }

    // Update input settings if they changed
    if (settings.input) {
      voiceSettingsStore.updateInputSettings(settings.input)

      // If device changed, we might need to reinitialize stream
      if (settings.input.deviceId !== undefined) {
        console.log(
          '[VoiceManager] Audio input device changed, may require stream reinitialization'
        )
      }
    }

    // Update output settings
    if (settings.output) {
      voiceSettingsStore.updateOutputSettings(settings.output)

      // Apply master volume to all current peers
      if (settings.output.masterVolume !== undefined) {
        this.applyMasterVolume(settings.output.masterVolume)
      }

      // Apply attenuation to all current peers
      if (settings.output.attenuation !== undefined) {
        this.applyAttenuation(settings.output.attenuation)
      }
    }
  }

  /**
   * Apply master volume to all connected users
   */
  private applyMasterVolume(masterVolume: number) {
    webrtcService.applyMasterVolumeToAll(masterVolume)
  }

  /**
   * Apply attenuation to all connected users
   */
  private applyAttenuation(attenuation: number) {
    webrtcService.applyAttenuationToAll(attenuation)
  }

  /**
   * Toggle between voice activity and push-to-talk modes
   */
  toggleDetectionMode() {
    const { useVoiceSettingsStore } = require('../stores/voice-settings')
    const currentMode = useVoiceSettingsStore.getState().settings.detection.mode
    const newMode = currentMode === 'voice_activity' ? 'push_to_talk' : 'voice_activity'

    this.updateVoiceSettings({
      detection: { mode: newMode },
    })

    console.log(`[VoiceManager] Switched to ${newMode} mode`)
    return newMode
  }

  /**
   * Set attenuation level (reduces volume of all other users)
   */
  setAttenuation(attenuation: number) {
    this.updateVoiceSettings({
      output: { attenuation: Math.max(0, Math.min(100, attenuation)) },
    })
  }

  /**
   * Set master volume level
   */
  setMasterVolume(volume: number) {
    this.updateVoiceSettings({
      output: { masterVolume: Math.max(0, Math.min(100, volume)) },
    })
  }

  /**
   * Get connection quality information for all users
   */
  getConnectionQualities(): Map<number, string> {
    const qualities = new Map<number, string>()

    // Return connection quality from voice store
    const voiceStore = useVoiceStore.getState()
    voiceStore.connectedUsers.forEach((user, userId) => {
      qualities.set(userId, user.connectionQuality)
    })

    return qualities
  }

  /**
   * Get overall voice quality
   */
  getOverallQuality(): string {
    return useVoiceStore.getState().overallQuality
  }

  /**
   * Get current quality warnings
   */
  getQualityWarnings(): string[] {
    return useVoiceStore.getState().qualityWarnings
  }

  /**
   * Check if voice quality is degraded
   */
  isQualityDegraded(): boolean {
    const quality = this.getOverallQuality()
    return quality === 'poor' || quality === 'critical'
  }

  /**
   * Get quality status description
   */
  getQualityStatusDescription(): string {
    const quality = this.getOverallQuality()
    const warnings = this.getQualityWarnings()

    switch (quality) {
      case 'excellent':
        return 'Voice quality is excellent'
      case 'good':
        return 'Voice quality is good'
      case 'poor':
        return `Voice quality is poor. ${warnings.length > 0 ? warnings[0] : ''}`
      case 'critical':
        return `Voice quality is critical. ${warnings.length > 0 ? warnings[0] : ''}`
      default:
        return 'Voice quality unknown'
    }
  }

  /**
   * Get audio device information
   */
  async getAudioDevices() {
    const { useVoiceSettingsStore } = require('../stores/voice-settings')
    const voiceSettingsStore = useVoiceSettingsStore.getState()
    await voiceSettingsStore.loadDevices()
    return voiceSettingsStore.availableDevices
  }

  /**
   * Change audio input device
   */
  async changeInputDevice(deviceId: string) {
    const { useVoiceSettingsStore } = require('../stores/voice-settings')
    useVoiceSettingsStore.getState().updateInputSettings({ deviceId })

    // Note: This would require reinitializing the audio stream
    // The UI should prompt the user to rejoin voice channels
    console.log(
      `[VoiceManager] Input device changed to ${deviceId}, stream reinitialization may be needed`
    )
  }

  /**
   * Change audio output device
   */
  async changeOutputDevice(deviceId: string) {
    const { useVoiceSettingsStore } = require('../stores/voice-settings')
    useVoiceSettingsStore.getState().updateOutputSettings({ deviceId })

    // HTML5 doesn't support changing output device programmatically
    // This would need to be handled by the operating system
    console.log(`[VoiceManager] Output device preference set to ${deviceId}`)
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
   * Handle voice channel members update broadcast
   */
  private handleVoiceChannelMembers(data: {
    channelId: number
    members: Array<{ userId: number; username: string }>
  }) {
    console.log(`[VoiceManager] 📋 Voice channel ${data.channelId} members update:`, data.members)
    // This will be used by ChannelList to show who's in voice channels
    // Store it in a way that components can access it
    // For now, we'll emit a custom event that components can listen to
    window.dispatchEvent(
      new CustomEvent('voice-channel-members-update', {
        detail: data,
      })
    )
  }

  /**
   * Handle user speaking status update
   */
  private handleVoiceUserSpeaking(data: {
    channelId: number
    userId: number
    username: string
    isSpeaking: boolean
  }) {
    console.log(
      `[VoiceManager] 🎤 ${data.username} is ${data.isSpeaking ? 'speaking' : 'not speaking'}`
    )
    useVoiceStore.getState().updateUserSpeaking(data.userId, data.isSpeaking)
  }

  /**
   * Handle reconnection request from another user
   */
  private handleVoiceReconnectRequest(data: { channelId: number; targetUserId: number }) {
    console.log(`[VoiceManager] 🔄 Reconnection request received for user ${data.targetUserId}`)

    // Only respond if we're in the same channel
    if (webrtcService.getCurrentChannelId() === data.channelId) {
      // Create a new peer connection as initiator
      this.createPeerConnection(data.targetUserId, '', true) // Username will be updated when we get user info
    }
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
