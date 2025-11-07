import { io, Socket } from 'socket.io-client'

// WebSocket URL - adjust for production
const WS_BASE_URL = 'https://commhub-production.up.railway.app/chat'

// Client version - should match package.json version
const CLIENT_VERSION = '1.1.8'

export interface WSMessage {
  id: number
  content: string
  userId: number
  username: string
  channelId: number
  createdAt: string
  isEdited?: boolean
  editedAt?: string
  replyTo?: {
    id: number
    content: string
    user: {
      id: number
      username: string
    }
  }
}

export interface FriendPresence {
  userId: number
  username: string
  status: 'online' | 'offline'
}

export interface UserJoined {
  serverId: number
  userId: number
  username: string
}

export interface UserLeft {
  serverId: number
  userId: number
  username: string
}

export interface DirectMessageWS {
  id: number
  content: string
  senderId: number
  receiverId: number
  createdAt: string
  isEdited: boolean
  editedAt?: string
  isRead: boolean
  sender: {
    id: number
    username: string
  }
  receiver: {
    id: number
    username: string
  }
}

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private joinedServers: Set<number> = new Set()
  private joinedChannels: Set<number> = new Set()
  private wasInVoiceChannel: boolean = false
  private voiceChannelId: number | null = null

  // Event listeners
  private messageListeners: ((message: WSMessage) => void)[] = []
  private friendPresenceListeners: ((presence: FriendPresence) => void)[] = []
  private userJoinedListeners: ((data: UserJoined) => void)[] = []
  private userLeftListeners: ((data: UserLeft) => void)[] = []
  private onlineFriendsListeners: ((friends: any[]) => void)[] = []
  private directMessageListeners: ((message: DirectMessageWS) => void)[] = []
  private errorListeners: ((error: any) => void)[] = []
  private statusUpdateListeners: ((data: { userId: number; status: string }) => void)[] = []

  connect(token: string): void {
    if (this.socket?.connected) {
      return
    }

    this.socket = io(WS_BASE_URL, {
      auth: {
        token,
      },
      query: {
        clientVersion: CLIENT_VERSION,
      },
      transports: ['websocket', 'polling'],
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0

      // Restore previous state after reconnection
      this.restoreConnectionState()
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        // Server or client initiated disconnect, don't reconnect
        return
      }
      this.attemptReconnect(token)
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.attemptReconnect(token)
    })

    // Handle version mismatch
    this.socket.on(
      'version-mismatch',
      (data: { currentVersion: string; requiredVersion: string; message: string }) => {
        console.error('Version mismatch:', data)
        alert(
          `⚠️ App Update Required\n\n${data.message}\n\nYour version: ${data.currentVersion}\nRequired version: ${data.requiredVersion}\n\nPlease refresh the page (Ctrl+R or Cmd+R) or restart the app.`
        )
        // Prevent reconnection attempts
        this.maxReconnectAttempts = 0
      }
    )

    // Set up message listeners
    this.socket.on('message', (message: WSMessage) => {
      this.messageListeners.forEach((listener) => listener(message))
    })

    this.socket.on('friend-presence', (presence: FriendPresence) => {
      this.friendPresenceListeners.forEach((listener) => listener(presence))
    })

    this.socket.on('user-joined', (data: UserJoined) => {
      this.userJoinedListeners.forEach((listener) => listener(data))
    })

    this.socket.on('user-left', (data: UserLeft) => {
      this.userLeftListeners.forEach((listener) => listener(data))
    })

    this.socket.on('online-friends', (friends: any[]) => {
      this.onlineFriendsListeners.forEach((listener) => listener(friends))
    })

    this.socket.on('direct-message', (message: DirectMessageWS) => {
      this.directMessageListeners.forEach((listener) => listener(message))
    })

    this.socket.on('status-update', (data: { userId: number; status: string }) => {
      this.statusUpdateListeners.forEach((listener) => listener(data))
    })

    this.socket.on('error', (error: any) => {
      this.errorListeners.forEach((listener) => listener(error))
    })
  }

  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    )

    setTimeout(() => {
      this.connect(token)
    }, 2000 * this.reconnectAttempts) // Exponential backoff
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.reconnectAttempts = 0
    // Clear state on manual disconnect
    this.clearConnectionState()
  }

  /**
   * Restore connection state after reconnection
   */
  private restoreConnectionState(): void {
    // Rejoin server rooms
    this.joinedServers.forEach((serverId) => {
      if (this.socket) {
        console.log(`[WebSocket] Rejoining server room: ${serverId}`)
        this.socket.emit('join-server', { serverId })
      }
    })

    // Rejoin channel rooms
    this.joinedChannels.forEach((channelId) => {
      if (this.socket) {
        console.log(`[WebSocket] Rejoining channel room: ${channelId}`)
        this.socket.emit('join-channel', { channelId })
      }
    })

    // Rejoin voice channel if we were in one
    if (this.wasInVoiceChannel && this.voiceChannelId) {
      console.log(`[WebSocket] Rejoining voice channel: ${this.voiceChannelId}`)
      // Import voice manager dynamically to avoid circular dependency
      import('./voice-manager').then(({ voiceManager }) => {
        // Only rejoin if we're still supposed to be in a voice channel
        const currentChannelId = voiceManager.getCurrentChannelId()
        if (currentChannelId === this.voiceChannelId! && this.voiceChannelId) {
          voiceManager.joinVoiceChannel(this.voiceChannelId!).catch((error) => {
            console.error('[WebSocket] Failed to rejoin voice channel:', error)
            // Clear voice state if rejoin fails
            this.clearVoiceChannelState()
          })
        } else {
          // Voice state has changed, clear our tracking
          this.clearVoiceChannelState()
        }
      })
    }
  }

  /**
   * Clear all connection state
   */
  private clearConnectionState(): void {
    this.joinedServers.clear()
    this.joinedChannels.clear()
    this.clearVoiceChannelState()
  }

  /**
   * Set voice channel state
   */
  setVoiceChannelState(channelId: number): void {
    this.wasInVoiceChannel = true
    this.voiceChannelId = channelId
  }

  /**
   * Clear voice channel state
   */
  clearVoiceChannelState(): void {
    this.wasInVoiceChannel = false
    this.voiceChannelId = null
  }

  // Server room management
  joinServer(serverId: number): void {
    if (this.socket) {
      this.socket.emit('join-server', { serverId })
      this.joinedServers.add(serverId)
    }
  }

  leaveServer(serverId: number): void {
    if (this.socket) {
      this.socket.emit('leave-server', { serverId })
    }
    this.joinedServers.delete(serverId)
  }

  // Channel room management
  joinChannel(channelId: number): void {
    if (this.socket) {
      this.socket.emit('join-channel', { channelId })
      this.joinedChannels.add(channelId)
    }
  }

  leaveChannel(channelId: number): void {
    if (this.socket) {
      this.socket.emit('leave-channel', { channelId })
    }
    this.joinedChannels.delete(channelId)
  }

  // Messaging
  sendMessage(channelId: number, content: string, replyToId?: number): void {
    if (this.socket) {
      this.socket.emit('send-message', { channelId, content, replyToId })
    }
  }

  // Friends
  getOnlineFriends(): void {
    if (this.socket) {
      this.socket.emit('get-online-friends')
    }
  }

  // Status
  notifyStatusChange(userId: number, status: string): void {
    if (this.socket) {
      this.socket.emit('status-change', { userId, status })
    }
  }

  // Event listener management
  onMessage(listener: (message: WSMessage) => void): () => void {
    this.messageListeners.push(listener)
    return () => {
      const index = this.messageListeners.indexOf(listener)
      if (index > -1) {
        this.messageListeners.splice(index, 1)
      }
    }
  }

  onFriendPresence(listener: (presence: FriendPresence) => void): () => void {
    this.friendPresenceListeners.push(listener)
    return () => {
      const index = this.friendPresenceListeners.indexOf(listener)
      if (index > -1) {
        this.friendPresenceListeners.splice(index, 1)
      }
    }
  }

  onUserJoined(listener: (data: UserJoined) => void): () => void {
    this.userJoinedListeners.push(listener)
    return () => {
      const index = this.userJoinedListeners.indexOf(listener)
      if (index > -1) {
        this.userJoinedListeners.splice(index, 1)
      }
    }
  }

  onUserLeft(listener: (data: UserLeft) => void): () => void {
    this.userLeftListeners.push(listener)
    return () => {
      const index = this.userLeftListeners.indexOf(listener)
      if (index > -1) {
        this.userLeftListeners.splice(index, 1)
      }
    }
  }

  onOnlineFriends(listener: (friends: any[]) => void): () => void {
    this.onlineFriendsListeners.push(listener)
    return () => {
      const index = this.onlineFriendsListeners.indexOf(listener)
      if (index > -1) {
        this.onlineFriendsListeners.splice(index, 1)
      }
    }
  }

  onError(listener: (error: any) => void): () => void {
    this.errorListeners.push(listener)
    return () => {
      const index = this.errorListeners.indexOf(listener)
      if (index > -1) {
        this.errorListeners.splice(index, 1)
      }
    }
  }

  onDirectMessage(listener: (message: DirectMessageWS) => void): () => void {
    this.directMessageListeners.push(listener)
    return () => {
      const index = this.directMessageListeners.indexOf(listener)
      if (index > -1) {
        this.directMessageListeners.splice(index, 1)
      }
    }
  }

  onStatusUpdate(listener: (data: { userId: number; status: string }) => void): () => void {
    this.statusUpdateListeners.push(listener)
    return () => {
      const index = this.statusUpdateListeners.indexOf(listener)
      if (index > -1) {
        this.statusUpdateListeners.splice(index, 1)
      }
    }
  }

  // Connection status
  get isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  // Get socket instance (for voice manager)
  getSocket() {
    return this.socket
  }
}

// Create and export a singleton instance
export const wsService = new WebSocketService()
export default wsService
