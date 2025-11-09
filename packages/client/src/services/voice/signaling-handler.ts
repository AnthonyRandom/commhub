import { wsService } from '../websocket'
import { webrtcService } from '../webrtc'
import { useVoiceStore } from '../../stores/voice'
import { soundManager } from '../sound-manager'
import { voiceSettingsManager } from './settings-manager'
import { logger } from '../../utils/logger'
import type SimplePeer from 'simple-peer'

/**
 * Handles WebSocket signaling for voice connections
 * Manages WebRTC offer/answer/ICE candidate exchange
 */
export class VoiceSignalingHandler {
  setupWebSocketListeners(): void {
    const socket = wsService.getSocket()
    if (!socket) return

    socket.on('voice-channel-users', this.handleVoiceChannelUsers.bind(this))
    socket.on('voice-user-joined', this.handleVoiceUserJoined.bind(this))
    socket.on('voice-user-left', this.handleVoiceUserLeft.bind(this))
    socket.on('voice-offer', this.handleVoiceOffer.bind(this))
    socket.on('voice-answer', this.handleVoiceAnswer.bind(this))
    socket.on('voice-ice-candidate', this.handleVoiceIceCandidate.bind(this))
    socket.on('voice-channel-members', this.handleVoiceChannelMembers.bind(this))
    socket.on('voice-user-speaking', this.handleVoiceUserSpeaking.bind(this))
    socket.on('voice-user-muted', this.handleVoiceUserMuted.bind(this))
    socket.on('voice-reconnect-request', this.handleVoiceReconnectRequest.bind(this))
    socket.on('voice-camera-enabled', this.handleVoiceCameraEnabled.bind(this))
    socket.on('voice-camera-disabled', this.handleVoiceCameraDisabled.bind(this))
  }

  private handleVoiceChannelUsers(data: {
    channelId: number
    users: Array<{ userId: number; username: string }>
  }): void {
    logger.info('VoiceSignaling', 'Users already in channel', {
      channelId: data.channelId,
      userCount: data.users.length,
      users: data.users,
    })

    // Mark that we've successfully joined
    webrtcService.setVoiceChannelJoined(true)

    // Create peer connections to all existing users (we are the initiator)
    data.users.forEach((user) => {
      logger.info('VoiceSignaling', 'Initiating connection to user', {
        userId: user.userId,
        username: user.username,
      })

      // Add user to voice store so they appear in the UI
      useVoiceStore.getState().addConnectedUser({
        userId: user.userId,
        username: user.username,
        isSpeaking: false,
        isMuted: false,
        hasVideo: false,
        connectionStatus: 'connecting',
        connectionQuality: 'connecting',
        localMuted: false,
        localVolume: 1.0,
      })

      this.createPeerConnection(user.userId, user.username, true)
    })
  }

  private handleVoiceUserJoined(data: {
    channelId: number
    userId: number
    username: string
    reconnecting?: boolean
  }): void {
    logger.info('VoiceSignaling', 'User joined', {
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
      reconnecting: data.reconnecting,
    })

    // Play sound for fresh joins only
    if (
      !data.reconnecting &&
      webrtcService.getCurrentChannelId() === data.channelId &&
      voiceSettingsManager.shouldPlaySounds()
    ) {
      soundManager.playUserJoined()
    }

    // Add user to voice store
    useVoiceStore.getState().addConnectedUser({
      userId: data.userId,
      username: data.username,
      isSpeaking: false,
      isMuted: false,
      hasVideo: false,
      connectionStatus: 'connecting',
      connectionQuality: 'connecting',
      localMuted: false,
      localVolume: 1.0,
    })

    logger.debug('VoiceSignaling', 'Waiting for offer from user', { username: data.username })
  }

  private handleVoiceUserLeft(data: {
    channelId: number
    userId: number
    username: string
    graceful?: boolean
  }): void {
    logger.info('VoiceSignaling', 'User left', {
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
      graceful: data.graceful,
    })

    // Play sound for graceful disconnects only
    if (
      data.graceful &&
      webrtcService.getCurrentChannelId() === data.channelId &&
      voiceSettingsManager.shouldPlaySounds()
    ) {
      soundManager.playUserLeft()
    }

    // Remove peer connection
    webrtcService.removePeer(data.userId)
  }

  private handleVoiceOffer(data: {
    channelId: number
    fromUserId: number
    fromUsername: string
    offer: SimplePeer.SignalData
  }): void {
    logger.info('VoiceSignaling', 'Received WebRTC offer', {
      channelId: data.channelId,
      fromUserId: data.fromUserId,
      fromUsername: data.fromUsername,
    })

    // Create peer connection (we are not the initiator)
    this.createPeerConnection(data.fromUserId, data.fromUsername, false, data.offer)
  }

  private handleVoiceAnswer(data: {
    channelId: number
    fromUserId: number
    fromUsername: string
    answer: SimplePeer.SignalData
  }): void {
    logger.info('VoiceSignaling', 'Received WebRTC answer', {
      channelId: data.channelId,
      fromUserId: data.fromUserId,
      fromUsername: data.fromUsername,
    })

    webrtcService.signal(data.fromUserId, data.answer)
  }

  private handleVoiceIceCandidate(data: {
    channelId: number
    fromUserId: number
    candidate: SimplePeer.SignalData
  }): void {
    logger.debug('VoiceSignaling', 'Received ICE candidate', {
      channelId: data.channelId,
      fromUserId: data.fromUserId,
    })
    webrtcService.signal(data.fromUserId, data.candidate)
  }

  private createPeerConnection(
    userId: number,
    username: string,
    isInitiator: boolean,
    initialSignal?: SimplePeer.SignalData
  ): void {
    const channelId = webrtcService.getCurrentChannelId()
    if (!channelId) {
      logger.error('VoiceSignaling', 'Cannot create peer connection: no channel ID', {
        userId,
        username,
      })
      return
    }

    logger.info('VoiceSignaling', 'Creating peer connection', {
      userId,
      username,
      channelId,
      isInitiator,
    })

    // Add user to voice store if not already there
    const voiceStore = useVoiceStore.getState()
    if (!voiceStore.connectedUsers.has(userId)) {
      voiceStore.addConnectedUser({
        userId,
        username,
        isSpeaking: false,
        isMuted: false,
        hasVideo: false,
        connectionStatus: 'connecting',
        connectionQuality: 'connecting',
        localMuted: false,
        localVolume: 1.0,
      })
    } else {
      voiceStore.updateUserConnectionStatus(userId, 'connecting')
      voiceStore.updateUserConnectionQuality(userId, 'connecting')
    }

    // Create peer connection with callbacks
    webrtcService.createPeerConnection(
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

        logger.debug('VoiceSignaling', `Sending ${eventName}`, { userId, username, eventName })

        const socket = wsService.getSocket()
        if (!socket) {
          logger.error('VoiceSignaling', 'No socket connection', { userId, username })
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
      (stream) => {
        // On stream received
        logger.info('VoiceSignaling', 'Received stream from user', { userId, username })
        voiceStore.updateUserStream(userId, stream)
        voiceStore.updateUserConnectionStatus(userId, 'connected')
      },
      () => {
        // On close
        logger.info('VoiceSignaling', 'Connection closed with user', { userId, username })
        voiceStore.updateUserConnectionStatus(userId, 'disconnected')
      }
    )

    // If we have an initial signal (offer), signal it to the peer
    if (initialSignal) {
      webrtcService.signal(userId, initialSignal)
    }
  }

  private handleVoiceChannelMembers(data: {
    channelId: number
    members: Array<{ userId: number; username: string; hasCamera: boolean }>
  }): void {
    logger.info('VoiceSignaling', 'Voice channel members update', {
      channelId: data.channelId,
      memberCount: data.members.length,
      members: data.members,
    })

    // Update voice members store
    const voiceMembersStore = useVoiceMembersStore()
    voiceMembersStore.setMembers(data.channelId, data.members)

    // Sync camera state to connected users
    const voiceStore = useVoiceStore.getState()
    data.members.forEach((member) => {
      if (voiceStore.connectedUsers.has(member.userId)) {
        voiceStore.updateUserVideo(member.userId, member.hasCamera)
      }
    })
  }

  private handleVoiceUserSpeaking(data: {
    channelId: number
    userId: number
    username: string
    isSpeaking: boolean
  }): void {
    logger.debug('VoiceSignaling', 'User speaking state changed', {
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
      isSpeaking: data.isSpeaking,
    })
    useVoiceStore.getState().updateUserSpeaking(data.userId, data.isSpeaking)
  }

  private handleVoiceUserMuted(data: {
    channelId: number
    userId: number
    username: string
    isMuted: boolean
  }): void {
    logger.info('VoiceSignaling', 'User mute status changed', {
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
      isMuted: data.isMuted,
    })
    useVoiceStore.getState().updateUserMuted(data.userId, data.isMuted)
  }

  private handleVoiceReconnectRequest(data: { channelId: number; targetUserId: number }): void {
    logger.info('VoiceSignaling', 'Reconnection request received', {
      channelId: data.channelId,
      targetUserId: data.targetUserId,
    })

    // Find the user in connected users
    const user = Array.from(useVoiceStore.getState().connectedUsers.values()).find(
      (u) => u.userId === data.targetUserId
    )

    if (!user) {
      logger.warn('VoiceSignaling', 'User not found for reconnection', {
        targetUserId: data.targetUserId,
      })
      return
    }

    // Remove old peer connection
    webrtcService.removePeer(data.targetUserId)

    // Create new peer connection (we initiate)
    this.createPeerConnection(data.targetUserId, user.username, true)
  }

  private handleVoiceCameraEnabled(data: {
    channelId: number
    userId: number
    username: string
  }): void {
    logger.info('VoiceSignaling', 'User enabled camera', {
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
    })

    // Update user's video state in the store
    useVoiceStore.getState().updateUserVideo(data.userId, true)
  }

  private handleVoiceCameraDisabled(data: {
    channelId: number
    userId: number
    username: string
  }): void {
    logger.info('VoiceSignaling', 'User disabled camera', {
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
    })

    // Update user's video state in the store
    useVoiceStore.getState().updateUserVideo(data.userId, false)
  }
}

export const voiceSignalingHandler = new VoiceSignalingHandler()

// Import voiceMembers store (at bottom to avoid circular dependency)
import { useVoiceMembersStore } from '../../stores/voiceMembers'
