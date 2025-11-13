import { useVoiceStore } from '../../stores/voice'
import { useVoiceSettingsStore } from '../../stores/voice-settings'
import type { PeerConnection } from './types'
import { wsService } from '../websocket'

/**
 * Manages video/camera functionality including enable/disable, device switching,
 * and adaptive quality management
 */
export class VideoManager {
  private localStream: MediaStream | null = null
  private localVideoStream: MediaStream | null = null
  private localScreenShareStream: MediaStream | null = null
  private videoEnabled = false
  private screenShareEnabled = false
  private currentVideoQuality: { resolution: '360p' | '480p' | '720p'; frameRate: 15 | 30 } = {
    resolution: '720p',
    frameRate: 30,
  }
  private qualityAdjustmentTimeout: number | null = null
  private peers: Map<number, PeerConnection> = new Map()
  private currentChannelId: number | null = null
  private negotiationQueue: Set<number> = new Set() // Track peers currently negotiating
  private isProcessingNegotiation = false // Global flag to prevent concurrent negotiations

  setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream
  }

  setPeers(peers: Map<number, PeerConnection>): void {
    this.peers = peers
  }

  setCurrentChannelId(channelId: number | null): void {
    this.currentChannelId = channelId
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
   * Create a black video track to avoid renegotiation
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

    // Mark this as our placeholder track
    ;(track as any).isPlaceholder = true

    return track
  }

  /**
   * Enable camera and add video track to all peer connections
   */
  async enableCamera(): Promise<void> {
    try {
      console.log('[VideoManager] Enabling camera...')

      if (this.videoEnabled) {
        console.log('[VideoManager] Camera already enabled')
        return
      }

      // If screen share is enabled, disable it first
      if (this.screenShareEnabled) {
        console.log('[VideoManager] Disabling screen share before enabling camera')
        await this.disableScreenShare()
      }

      // Get video constraints
      const videoConstraints = this.getVideoConstraints()

      // Request video stream
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      })

      console.log('[VideoManager] ✅ Got video stream:', videoStream.getVideoTracks())

      this.localVideoStream = videoStream
      this.videoEnabled = true

      // Update voice store
      useVoiceStore.getState().setLocalVideoEnabled(true)
      useVoiceStore.getState().setLocalVideoStream(videoStream)

      // Replace the black video track with the real camera track
      const videoTrack = videoStream.getVideoTracks()[0]
      if (videoTrack && this.localStream) {
        // Find and replace the black placeholder track in localStream
        const placeholderTrack = this.localStream
          .getVideoTracks()
          .find((t) => (t as any).isPlaceholder)
        if (placeholderTrack) {
          this.localStream.removeTrack(placeholderTrack)
          placeholderTrack.stop()
        }

        this.localStream.addTrack(videoTrack)
        console.log('[VideoManager] Replaced placeholder video track with camera track')

        // Replace the track in all peer connections (no renegotiation needed!)
        for (const [userId, peerConnection] of this.peers.entries()) {
          try {
            const rtcPeerConnection = peerConnection.peerConnection

            if (rtcPeerConnection) {
              // Find the video sender
              const senders = rtcPeerConnection.getSenders()
              const videoSender = senders.find((sender) => sender.track?.kind === 'video')

              if (videoSender) {
                // Replace the black track with the real camera track
                await videoSender.replaceTrack(videoTrack)
                console.log(`[VideoManager] ✅ Replaced video track for peer ${userId}`)
              }
            }
          } catch (error) {
            console.error(`[VideoManager] Failed to replace video track for peer ${userId}:`, error)
          }
        }
      }

      console.log('[VideoManager] Camera enabled successfully')
    } catch (error) {
      console.error('[VideoManager] Failed to enable camera:', error)
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
      console.log('[VideoManager] Disabling camera...')

      if (!this.videoEnabled || !this.localVideoStream) {
        console.log('[VideoManager] Camera already disabled')
        return
      }

      // Replace camera track with black track in localStream
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks()
        videoTracks.forEach((track) => {
          this.localStream!.removeTrack(track)
          track.stop()
          console.log('[VideoManager] Removed and stopped camera track:', track.label)
        })

        // Add a new black placeholder track
        const blackTrack = this.createBlackVideoTrack()
        this.localStream.addTrack(blackTrack)
        console.log('[VideoManager] Added black placeholder track')
      }

      // Replace camera track with black track in all peer connections
      this.peers.forEach((peerConnection, userId) => {
        try {
          const rtcPeerConnection = peerConnection.peerConnection

          if (rtcPeerConnection) {
            // Find the video sender
            const senders = rtcPeerConnection.getSenders()
            const videoSender = senders.find((sender) => sender.track?.kind === 'video')

            if (videoSender && this.localStream) {
              // Get the new black placeholder track
              const blackTrack = this.localStream.getVideoTracks()[0]

              if (blackTrack) {
                // Replace camera with black track (no renegotiation needed!)
                videoSender
                  .replaceTrack(blackTrack)
                  .then(() => {
                    console.log(
                      `[VideoManager] ✅ Replaced camera with black track for peer ${userId}`
                    )
                  })
                  .catch((error) => {
                    console.error(
                      `[VideoManager] Failed to replace track for peer ${userId}:`,
                      error
                    )
                  })
              }
            }
          }
        } catch (error) {
          console.error(`[VideoManager] Failed to replace video track for peer ${userId}:`, error)
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

      console.log('[VideoManager] Camera disabled successfully')
    } catch (error) {
      console.error('[VideoManager] Error disabling camera:', error)
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
      console.error('[VideoManager] Failed to get video devices:', error)
      return []
    }
  }

  /**
   * Switch to a different camera device
   */
  async switchVideoDevice(deviceId: string): Promise<void> {
    try {
      console.log(`[VideoManager] Switching to camera device: ${deviceId}`)

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

      console.log('[VideoManager] Switched camera device successfully')
    } catch (error) {
      console.error('[VideoManager] Failed to switch camera device:', error)
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
    }

    // Check if quality needs to change
    if (newResolution !== currentRes || newFrameRate !== currentFps) {
      console.log(
        `[VideoManager] Adjusting video quality from ${currentRes}@${currentFps}fps to ${newResolution}@${newFrameRate}fps`
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

          console.log('[VideoManager] Video quality adjusted successfully')

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
        console.error('[VideoManager] Failed to adjust video quality:', error)
      }
    }
  }

  /**
   * Monitor connection stats and trigger quality adjustments
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

  /**
   * Enable screen share and replace video track in all peer connections
   */
  async enableScreenShare(screenShareStream: MediaStream): Promise<void> {
    try {
      console.log('[VideoManager] Enabling screen share...')

      if (this.screenShareEnabled) {
        console.log('[VideoManager] Screen share already enabled')
        return
      }

      // If camera is enabled, disable it first
      if (this.videoEnabled) {
        console.log('[VideoManager] Disabling camera before enabling screen share')
        await this.disableCamera()
      }

      this.localScreenShareStream = screenShareStream
      this.screenShareEnabled = true

      // Replace the video track with screen share track
      const videoTrack = screenShareStream.getVideoTracks()[0]
      if (videoTrack && this.localStream) {
        // Get current video tracks before removal
        const currentVideoTracks = this.localStream.getVideoTracks()

        // Replace the track in all peer connections FIRST (before removing from local stream)
        // This ensures the new track is ready before the old one is stopped
        const replacementPromises: Promise<void>[] = []

        for (const [userId, peerConnection] of this.peers.entries()) {
          try {
            const rtcPeerConnection = peerConnection.peerConnection

            if (rtcPeerConnection && rtcPeerConnection.connectionState === 'connected') {
              const senders = rtcPeerConnection.getSenders()
              const videoSender = senders.find((sender) => sender.track?.kind === 'video')

              if (videoSender) {
                // Replace track and wait for it to complete
                replacementPromises.push(
                  videoSender
                    .replaceTrack(videoTrack)
                    .then(() => {
                      console.log(
                        `[VideoManager] ✅ Replaced video track with screen share for peer ${userId}`
                      )
                    })
                    .catch((error) => {
                      console.error(
                        `[VideoManager] Failed to replace video track for peer ${userId}:`,
                        error
                      )
                    })
                )
              }
            }
          } catch (error) {
            console.error(`[VideoManager] Failed to replace video track for peer ${userId}:`, error)
          }
        }

        // Wait for all replacements to complete before removing old tracks
        await Promise.all(replacementPromises)

        // Now remove old video tracks from localStream and add new one
        currentVideoTracks.forEach((track) => {
          this.localStream!.removeTrack(track)
          // Stop track after a small delay to ensure replacement is complete
          setTimeout(() => track.stop(), 100)
        })

        this.localStream.addTrack(videoTrack)
        console.log('[VideoManager] Replaced video track with screen share track')
      }

      // Handle screen share audio tracks (desktop audio)
      const audioTracks = screenShareStream.getAudioTracks()
      if (audioTracks.length > 0) {
        console.log('[VideoManager] Screen share has audio tracks, adding to peer connections...', {
          audioTrackCount: audioTracks.length,
        })

        // Add audio tracks to local stream first
        audioTracks.forEach((track) => {
          if (this.localStream) {
            this.localStream.addTrack(track)
            console.log('[VideoManager] Added screen share audio track to local stream')
          }
        })

        // Add audio tracks to all peer connections and trigger renegotiation properly
        // We need to add tracks to RTCPeerConnection AND let SimplePeer handle renegotiation
        for (const [userId, peerConnection] of this.peers.entries()) {
          try {
            const rtcPeerConnection = peerConnection.peerConnection

            if (!rtcPeerConnection) {
              console.warn(`[VideoManager] No RTCPeerConnection for peer ${userId}`)
              continue
            }

            // Check connection state - only proceed if connected or connecting
            const connectionState = rtcPeerConnection.connectionState
            if (connectionState !== 'connected' && connectionState !== 'connecting') {
              console.warn(
                `[VideoManager] Peer ${userId} not in valid state for audio track addition`,
                { connectionState }
              )
              continue
            }

            // Set up negotiationneeded handler BEFORE adding tracks
            // This ensures we catch the event when tracks are added
            let negotiationHandler: (() => void) | null = null

            negotiationHandler = async () => {
              // Prevent concurrent negotiations across ALL peers
              // This prevents bandwidth spikes when screen sharing starts
              if (this.isProcessingNegotiation) {
                console.log(`[VideoManager] Global negotiation in progress, queuing peer ${userId}`)
                this.negotiationQueue.add(userId)
                return
              }

              // Check if this peer is already in queue or being processed
              if (this.negotiationQueue.has(userId)) {
                console.log(`[VideoManager] Peer ${userId} already queued for negotiation`)
                return
              }

              // Only proceed if connection is stable and connected
              if (
                rtcPeerConnection.signalingState !== 'stable' ||
                rtcPeerConnection.connectionState !== 'connected'
              ) {
                console.log(
                  `[VideoManager] Not in stable/connected state for negotiation, skipping`,
                  {
                    signalingState: rtcPeerConnection.signalingState,
                    connectionState: rtcPeerConnection.connectionState,
                  }
                )
                return
              }

              // Mark as processing and add to queue
              this.isProcessingNegotiation = true
              this.negotiationQueue.add(userId)
              // For renegotiation, we (the local peer) are always the initiator
              // since we're the ones detecting the need to add/remove tracks
              const isInitiator = true

              try {
                // Create renegotiation offer
                if (isInitiator) {
                  console.log(`[VideoManager] Creating renegotiation offer for peer ${userId}`)

                  const offer = await rtcPeerConnection.createOffer()
                  await rtcPeerConnection.setLocalDescription(offer)

                  if (!this.currentChannelId) {
                    console.error('[VideoManager] No channel ID available for renegotiation')
                    this.negotiationQueue.delete(userId)
                    this.isProcessingNegotiation = false
                    this.processNextNegotiation()
                    return
                  }

                  const socket = wsService.getSocket()
                  if (socket) {
                    socket.emit('voice-offer', {
                      targetUserId: userId,
                      offer: offer,
                      channelId: this.currentChannelId,
                    })
                    console.log(
                      `[VideoManager] ✅ Sent renegotiation offer to peer ${userId} via WebSocket`
                    )
                  } else {
                    console.error('[VideoManager] WebSocket not available for renegotiation')
                    this.negotiationQueue.delete(userId)
                    this.isProcessingNegotiation = false
                    this.processNextNegotiation()
                    return
                  }
                } else {
                  // Non-initiator waits for offer from remote peer
                  console.log(
                    `[VideoManager] Non-initiator: waiting for renegotiation offer from peer ${userId}`
                  )
                  this.negotiationQueue.delete(userId)
                  this.isProcessingNegotiation = false
                  this.processNextNegotiation()
                  return
                }

                // Remove from queue and process next after a short delay
                // This allows the offer to be sent before starting the next negotiation
                setTimeout(() => {
                  this.negotiationQueue.delete(userId)
                  this.isProcessingNegotiation = false
                  this.processNextNegotiation()
                }, 100)
              } catch (error) {
                console.error(
                  `[VideoManager] Failed to handle negotiation for peer ${userId}:`,
                  error
                )
                this.negotiationQueue.delete(userId)
                this.isProcessingNegotiation = false
                this.processNextNegotiation()
              }
            }

            // Add event listener for negotiationneeded
            rtcPeerConnection.addEventListener('negotiationneeded', negotiationHandler)

            // Add tracks to RTCPeerConnection
            // This will trigger negotiationneeded event
            for (const audioTrack of audioTracks) {
              try {
                rtcPeerConnection.addTrack(audioTrack, this.localStream!)
                console.log(`[VideoManager] ✅ Added screen share audio track to peer ${userId}`, {
                  trackId: audioTrack.id,
                })
              } catch (error) {
                console.error(
                  `[VideoManager] Failed to add audio track to RTCPeerConnection for peer ${userId}:`,
                  error
                )
              }
            }

            // Clean up handler after a delay (negotiation should have started by then)
            // Store cleanup function in peer connection for later removal
            setTimeout(() => {
              if (negotiationHandler) {
                rtcPeerConnection.removeEventListener('negotiationneeded', negotiationHandler)
                negotiationHandler = null
              }
            }, 5000)
          } catch (error) {
            console.error(
              `[VideoManager] Failed to add screen share audio track for peer ${userId}:`,
              error
            )
          }
        }
      } else {
        console.log('[VideoManager] No audio tracks in screen share stream')
      }

      console.log('[VideoManager] Screen share enabled successfully')
    } catch (error) {
      console.error('[VideoManager] Failed to enable screen share:', error)
      this.screenShareEnabled = false
      throw error
    }
  }

  /**
   * Disable screen share and replace with black placeholder track
   */
  async disableScreenShare(): Promise<void> {
    try {
      console.log('[VideoManager] Disabling screen share...')

      if (!this.screenShareEnabled || !this.localScreenShareStream) {
        console.log('[VideoManager] Screen share already disabled')
        return
      }

      // Get the screen share audio tracks before we stop the stream
      const screenShareAudioTracks = this.localScreenShareStream.getAudioTracks()

      // Replace screen share track with black track in localStream
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks()
        videoTracks.forEach((track) => {
          this.localStream!.removeTrack(track)
          track.stop()
          console.log('[VideoManager] Removed and stopped screen share track:', track.label)
        })

        // Remove screen share audio tracks from local stream
        screenShareAudioTracks.forEach((track) => {
          if (this.localStream && this.localStream.getTrackById(track.id)) {
            this.localStream.removeTrack(track)
            console.log('[VideoManager] Removed screen share audio track from local stream')
          }
        })

        // Add a new black placeholder track
        const blackTrack = this.createBlackVideoTrack()
        this.localStream.addTrack(blackTrack)
        console.log('[VideoManager] Added black placeholder track')
      }

      // Replace screen share track with black track in all peer connections
      // Do this BEFORE removing tracks from local stream to ensure smooth transition
      const replacementPromises: Promise<void>[] = []

      for (const [userId, peerConnection] of this.peers.entries()) {
        try {
          const rtcPeerConnection = peerConnection.peerConnection

          if (!rtcPeerConnection || rtcPeerConnection.connectionState !== 'connected') {
            console.warn(
              `[VideoManager] Peer ${userId} not connected, skipping screen share cleanup`
            )
            continue
          }

          const senders = rtcPeerConnection.getSenders()

          // Replace video track with black track
          const videoSender = senders.find((sender) => sender.track?.kind === 'video')
          if (videoSender && this.localStream) {
            const blackTrack = this.localStream.getVideoTracks()[0]
            if (blackTrack) {
              replacementPromises.push(
                videoSender
                  .replaceTrack(blackTrack)
                  .then(() => {
                    console.log(
                      `[VideoManager] ✅ Replaced screen share with black track for peer ${userId}`
                    )
                  })
                  .catch((error) => {
                    console.error(
                      `[VideoManager] Failed to replace video track for peer ${userId}:`,
                      error
                    )
                  })
              )
            }
          }

          // Remove screen share audio senders
          for (const audioTrack of screenShareAudioTracks) {
            const audioSender = senders.find((sender) => sender.track?.id === audioTrack.id)
            if (audioSender) {
              try {
                rtcPeerConnection.removeTrack(audioSender)
                console.log(
                  `[VideoManager] ✅ Removed screen share audio track from peer ${userId}`
                )
                // Note: Removing tracks will trigger negotiationneeded, but we don't need to handle it
                // as we're just removing tracks (not adding), so the remote peer will handle it
              } catch (error) {
                console.error(
                  `[VideoManager] Failed to remove audio track for peer ${userId}:`,
                  error
                )
              }
            }
          }
        } catch (error) {
          console.error(
            `[VideoManager] Failed to replace screen share track for peer ${userId}:`,
            error
          )
        }
      }

      // Wait for all replacements to complete
      await Promise.all(replacementPromises)

      // Stop screen share stream tracks
      this.localScreenShareStream.getTracks().forEach((track) => track.stop())
      this.localScreenShareStream = null
      this.screenShareEnabled = false

      console.log('[VideoManager] Screen share disabled successfully')
    } catch (error) {
      console.error('[VideoManager] Error disabling screen share:', error)
      throw error
    }
  }

  /**
   * Check if screen share is enabled
   */
  isScreenShareEnabled(): boolean {
    return this.screenShareEnabled
  }

  /**
   * Process next negotiation in queue
   * Ensures negotiations happen sequentially, not concurrently
   */
  private processNextNegotiation(): void {
    if (this.isProcessingNegotiation || this.negotiationQueue.size === 0) {
      return
    }

    // Get next peer from queue
    const nextUserId = this.negotiationQueue.values().next().value
    if (!nextUserId) {
      return
    }

    const peerConnection = this.peers.get(nextUserId)
    if (!peerConnection) {
      this.negotiationQueue.delete(nextUserId)
      this.processNextNegotiation()
      return
    }

    const rtcPeerConnection = peerConnection.peerConnection

    if (
      !rtcPeerConnection ||
      rtcPeerConnection.signalingState !== 'stable' ||
      rtcPeerConnection.connectionState !== 'connected'
    ) {
      this.negotiationQueue.delete(nextUserId)
      this.processNextNegotiation()
      return
    }

    // Manually trigger negotiationneeded event handling
    // This will be caught by the event listener we set up
    this.isProcessingNegotiation = true
    rtcPeerConnection.dispatchEvent(new Event('negotiationneeded'))
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach((track) => track.stop())
      this.localVideoStream = null
    }

    if (this.localScreenShareStream) {
      this.localScreenShareStream.getTracks().forEach((track) => track.stop())
      this.localScreenShareStream = null
    }

    if (this.qualityAdjustmentTimeout) {
      clearTimeout(this.qualityAdjustmentTimeout)
      this.qualityAdjustmentTimeout = null
    }

    this.negotiationQueue.clear()
    this.isProcessingNegotiation = false
    this.videoEnabled = false
    this.screenShareEnabled = false
  }
}
