import { io, Socket } from 'socket.io-client'

// WebSocket URL - adjust for production
const WS_BASE_URL = 'https://commhub-production.up.railway.app/chat'

export interface WSMessage {
  id: number
  content: string
  userId: number
  username: string
  channelId: number
  createdAt: string
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

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  // Event listeners
  private messageListeners: ((message: WSMessage) => void)[] = []
  private friendPresenceListeners: ((presence: FriendPresence) => void)[] = []
  private userJoinedListeners: ((data: UserJoined) => void)[] = []
  private userLeftListeners: ((data: UserLeft) => void)[] = []
  private onlineFriendsListeners: ((friends: any[]) => void)[] = []
  private errorListeners: ((error: any) => void)[] = []

  connect(token: string): void {
    if (this.socket?.connected) {
      return
    }

    this.socket = io(WS_BASE_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
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
  }

  // Server room management
  joinServer(serverId: number): void {
    if (this.socket) {
      this.socket.emit('join-server', { serverId })
    }
  }

  leaveServer(serverId: number): void {
    if (this.socket) {
      this.socket.emit('leave-server', { serverId })
    }
  }

  // Channel room management
  joinChannel(channelId: number): void {
    if (this.socket) {
      this.socket.emit('join-channel', { channelId })
    }
  }

  leaveChannel(channelId: number): void {
    if (this.socket) {
      this.socket.emit('leave-channel', { channelId })
    }
  }

  // Messaging
  sendMessage(channelId: number, content: string): void {
    if (this.socket) {
      this.socket.emit('send-message', { channelId, content })
    }
  }

  // Friends
  getOnlineFriends(): void {
    if (this.socket) {
      this.socket.emit('get-online-friends')
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
