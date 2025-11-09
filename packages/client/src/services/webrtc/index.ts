import SimplePeer from 'simple-peer'
import { wsService } from '../websocket'
import { PeerConnectionManager } from './peer-manager'
import { StreamManager } from './stream-manager'
import { VideoManager } from './video-manager'
import type { ConnectionCallbacks } from './types'

/**
 * Main WebRTC Service - orchestrates all WebRTC functionality
 * Delegates responsibilities to specialized managers
 */
class WebRTCService {
  private peerManager: PeerConnectionManager
  private streamManager: StreamManager
  private videoManager: VideoManager
  private currentChannelId: number | null = null
  private voiceChannelJoined = false

  constructor() {
    this.peerManager = new PeerConnectionManager()
    this.streamManager = new StreamManager()
    this.videoManager = new VideoManager()
  }

  /**
   * Initialize local audio stream with noise suppression
   */
  async initializeLocalStream(): Promise<MediaStream> {
    const stream = await this.streamManager.initializeLocalStream(
      this.handleSpeakingChange.bind(this)
    )
    this.peerManager.setLocalStream(stream)
    this.videoManager.setLocalStream(stream)
    return stream
  }

  /**
   * Handle speaking state change
   */
  handleSpeakingChange(isSpeaking: boolean): void {
    const socket = wsService.getSocket()
    if (socket && this.currentChannelId) {
      socket.emit('voice-speaking', {
        channelId: this.currentChannelId,
        isSpeaking,
      })
    }
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
    const callbacks: ConnectionCallbacks = { onSignal, onStream, onClose }
    return this.peerManager.createPeerConnection(userId, username, isInitiator, callbacks)
  }

  /**
   * Send signal to a peer
   */
  signal(userId: number, signalData: SimplePeer.SignalData): void {
    this.peerManager.signal(userId, signalData)
  }

  /**
   * Get a peer connection
   */
  getPeer(userId: number): SimplePeer.Instance | undefined {
    return this.peerManager.getPeer(userId)
  }

  /**
   * Remove a peer connection
   */
  removePeer(userId: number): void {
    this.peerManager.removePeer(userId)
  }

  /**
   * Set microphone muted state
   */
  setMuted(muted: boolean): void {
    this.streamManager.setMuted(muted)
  }

  /**
   * Set deafened state (mutes all remote audio)
   */
  setDeafened(deafened: boolean): void {
    this.streamManager.setDeafened(deafened)
    // Mute all remote audio elements when deafened
    this.peerManager.setAllAudioMuted(deafened)
  }

  /**
   * Change audio input device
   */
  async changeAudioDevice(deviceId: string): Promise<void> {
    await this.streamManager.changeAudioDevice(deviceId)
    // Update peer manager with new stream
    const stream = this.streamManager.getProcessedStream()
    this.peerManager.setLocalStream(stream)
    this.videoManager.setLocalStream(stream)
  }

  /**
   * Change audio output device (for supported browsers)
   */
  async changeOutputDevice(deviceId: string): Promise<void> {
    // Note: Output device selection is handled by setting sinkId on audio elements
    // This is already handled by the peer manager when playing audio streams
    console.log('[WebRTC] Output device change requested:', deviceId)
    // Future: Could store this and apply to all audio elements
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    return this.streamManager.getAudioDevices()
  }

  /**
   * Enable camera
   */
  async enableCamera(): Promise<void> {
    // Update video manager with current peers
    this.videoManager.setPeers(this.peerManager.getPeers())
    await this.videoManager.enableCamera()
  }

  /**
   * Disable camera
   */
  async disableCamera(): Promise<void> {
    // Update video manager with current peers
    this.videoManager.setPeers(this.peerManager.getPeers())
    await this.videoManager.disableCamera()
  }

  /**
   * Check if camera is enabled
   */
  isCameraEnabled(): boolean {
    return this.videoManager.isCameraEnabled()
  }

  /**
   * Get available video devices
   */
  async getAvailableVideoDevices(): Promise<MediaDeviceInfo[]> {
    return this.videoManager.getAvailableVideoDevices()
  }

  /**
   * Switch video device
   */
  async switchVideoDevice(deviceId: string): Promise<void> {
    await this.videoManager.switchVideoDevice(deviceId)
  }

  /**
   * Get local video stream
   */
  getLocalVideoStream(): MediaStream | null {
    return this.videoManager.getLocalVideoStream()
  }

  /**
   * Handle video quality adjustment
   */
  async handleVideoQualityAdjustment(
    userId: number,
    lossRate: number,
    jitter: number
  ): Promise<void> {
    await this.videoManager.handleVideoQualityAdjustment(userId, lossRate, jitter)
  }

  /**
   * Set user volume
   */
  setUserVolume(userId: number, volume: number): void {
    this.peerManager.setUserVolume(userId, volume)
  }

  /**
   * Set user local muted state
   */
  setUserLocalMuted(userId: number, muted: boolean): void {
    // This is handled in the voice store directly, WebRTC doesn't need to know
    console.log('[WebRTC] User local mute state changed:', userId, muted)
  }

  /**
   * Apply master volume to all peers
   */
  setMasterVolume(masterVolume: number): void {
    this.peerManager.applyMasterVolumeToAll(masterVolume)
  }

  /**
   * Apply attenuation to all peers (alias for backward compatibility)
   */
  applyMasterVolumeToAll(masterVolume: number): void {
    this.peerManager.applyMasterVolumeToAll(masterVolume)
  }

  /**
   * Apply attenuation to all peers
   */
  setAttenuation(attenuation: number): void {
    this.peerManager.applyAttenuationToAll(attenuation)
  }

  /**
   * Apply attenuation to all peers (alias for backward compatibility)
   */
  applyAttenuationToAll(attenuation: number): void {
    this.peerManager.applyAttenuationToAll(attenuation)
  }

  /**
   * Set detection mode for speaking detection
   */
  setDetectionMode(mode: 'voice_activity' | 'push_to_talk'): void {
    this.streamManager.updateSpeakingConfig({ mode })
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
  setCurrentChannelId(channelId: number | null): void {
    this.currentChannelId = channelId
    this.peerManager.setCurrentChannelId(channelId)
  }

  /**
   * Set voice channel joined state
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
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.streamManager.getLocalStream()
  }

  /**
   * Get speaking detector
   */
  getSpeakingDetector() {
    return this.streamManager.getSpeakingDetector()
  }

  /**
   * Get noise suppression stats
   */
  getNoiseSuppressionStats() {
    return this.streamManager.getNoiseSuppressionStats()
  }

  /**
   * Get noise suppression method
   */
  getNoiseSuppressionMethod() {
    return this.streamManager.getNoiseSuppressionMethod()
  }

  /**
   * Update noise suppression config
   */
  updateNoiseSuppressionConfig(config: any): void {
    this.streamManager.updateNoiseSuppressionConfig(config)
  }

  /**
   * Update speaking config
   */
  updateSpeakingConfig(config: any): void {
    this.streamManager.updateSpeakingConfig(config)
  }

  /**
   * Get connection qualities
   */
  getConnectionQualities() {
    return this.peerManager.getConnectionQualities()
  }

  /**
   * Get all peers
   */
  getPeers() {
    return this.peerManager.getPeers()
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.currentChannelId !== null
  }

  /**
   * Request reconnection to a peer
   */
  requestReconnect(userId: number): void {
    // This is typically handled by the connection manager via WebSocket
    console.log('[WebRTC] Reconnection request for user:', userId)
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    this.streamManager.cleanup()
    this.videoManager.cleanup()
    this.peerManager.cleanup()
    this.currentChannelId = null
    this.voiceChannelJoined = false
    console.log('[WebRTC] Cleaned up all resources')
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService()
export default webrtcService
