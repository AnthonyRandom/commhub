import { wsService } from './websocket'
import { apiService } from './api'
import { useMessagesStore } from '../stores/messages'
import { useServersStore } from '../stores/servers'
import { useDirectMessagesStore } from '../stores/directMessages'
import { useFriendsStore } from '../stores/friends'
import { useChannelsStore } from '../stores/channels'
import { useAuthStore } from '../stores/auth'
import { useVoiceMembersStore } from '../stores/voiceMembers'

class WebSocketManager {
  private isInitialized = false

  initialize() {
    if (this.isInitialized) {
      return
    }

    this.isInitialized = true

    // Initialize WebSocket listeners
    useMessagesStore.getState().initializeWebSocketListeners()
    this.initializeServerListeners()
    this.initializeChannelListeners()
    this.initializeDirectMessageListeners()
    this.initializeFriendRequestListeners()

    // Set up auth-based connection management
    this.checkAndConnect()
  }

  private initializeServerListeners() {
    // Listen for users joining servers
    wsService.onUserJoined((data) => {
      useServersStore.getState().addMemberToServer(data.serverId, {
        id: data.userId,
        username: data.username,
      })
    })

    // Listen for users leaving servers
    wsService.onUserLeft((data) => {
      useServersStore.getState().removeMemberFromServer(data.serverId, data.userId)
    })
  }

  // NEW: Attach listeners that require direct socket reference
  private attachSocketListeners(socket: any) {
    // Ensure we don't attach duplicates when reconnecting
    socket.off('channel-created')
    socket.off('channel-updated')
    socket.off('channel-deleted')
    socket.off('voice-channel-members')
    socket.off('friend-request-received')
    socket.off('friend-request-responded')
    socket.off('initial-sync')
    socket.off('friend-presence')
    socket.off('dm-thread-created')

    // Channel events
    socket.on('channel-created', (data: any) => {
      console.log('[WebSocket] Channel created:', data)
      useChannelsStore.getState().addChannel(data.channel)
    })
    socket.on('channel-updated', (data: any) => {
      console.log('[WebSocket] Channel updated:', data)
      useChannelsStore.getState().updateChannel(data.channel)
    })
    socket.on('channel-deleted', (data: any) => {
      console.log('[WebSocket] Channel deleted:', data)
      useChannelsStore.getState().removeChannel(data.channelId)
    })

    // Voice sidebar snapshots
    socket.on('voice-channel-members', (data: { channelId: number; members: any[] }) => {
      console.log('[WebSocket] Voice channel members update:', data)
      useVoiceMembersStore.getState().setMembers(data.channelId, data.members)
    })

    // Initial sync on connection
    socket.on('initial-sync', (data: { onlineFriends: any[] }) => {
      console.log('[WebSocket] Initial sync received:', data)
      useFriendsStore.getState().setOnlineFriends(data.onlineFriends)
    })

    // Friend presence updates (online/offline/idle/dnd status changes)
    socket.on('friend-presence', (data: { userId: number; username: string; status: string }) => {
      console.log('[WebSocket] Friend presence update:', data)
      useFriendsStore.getState().updateFriendStatus(data.userId, data.status)
    })

    // DM thread created (first message between two users)
    socket.on('dm-thread-created', (data: any) => {
      console.log('[WebSocket] DM thread created:', data)
      // Refresh conversations to show the new thread
      useDirectMessagesStore.getState().fetchConversations()
    })

    // Friend request events
    socket.on('friend-request-received', (data: any) => {
      console.log('[WebSocket] Friend request received:', data)
      useFriendsStore.getState().fetchReceivedRequests()
    })
    socket.on('friend-request-responded', (_data: any) => {
      console.log('[WebSocket] Friend request responded:', _data)
      const user = useAuthStore.getState().user
      if (user) {
        useFriendsStore.getState().fetchSentRequests()
        useFriendsStore.getState().fetchReceivedRequests()
        useFriendsStore.getState().fetchFriends(user.id)
      }
    })
  }

  private initializeChannelListeners() {
    /* Deprecated: Handled via attachSocketListeners() */
  }

  private initializeDirectMessageListeners() {
    // Listen for incoming direct messages
    wsService.onDirectMessage((data) => {
      useDirectMessagesStore.getState().addMessage(data)
      // Refresh conversations to update last message and unread count
      useDirectMessagesStore.getState().fetchConversations()
    })
  }

  private initializeFriendRequestListeners() {
    /* Deprecated: Handled via attachSocketListeners() */
  }

  connect() {
    const token = apiService.getAuthToken()
    if (token) {
      wsService.connect(token)
      const socket = wsService.getSocket()
      if (socket) {
        // Attach listeners immediately if socket already connected/created
        this.attachSocketListeners(socket)

        // Set up connect handler for ready emission and listener reattachment
        socket.on('connect', () => {
          console.log('[WebSocket] Connected, emitting ready and reattaching listeners')
          this.attachSocketListeners(socket)
          // Emit ready on every connection/reconnection to join all rooms
          console.log('[WebSocket] Emitting ready event to server')
          socket.emit('ready')
        })

        // If already connected, emit ready immediately
        if (socket.connected) {
          console.log('[WebSocket] Already connected, emitting ready immediately')
          this.attachSocketListeners(socket)
          socket.emit('ready')
        }
      }
    }
  }

  disconnect() {
    wsService.disconnect()
  }

  checkAndConnect() {
    if (apiService.isAuthenticated()) {
      this.connect()
    }
  }

  joinServer(serverId: number) {
    wsService.joinServer(serverId)
  }

  leaveServer(serverId: number) {
    wsService.leaveServer(serverId)
  }

  joinChannel(channelId: number) {
    wsService.joinChannel(channelId)
  }

  leaveChannel(channelId: number) {
    wsService.leaveChannel(channelId)
  }

  getOnlineFriends() {
    wsService.getOnlineFriends()
  }

  notifyStatusChange(userId: number, status: string) {
    wsService.notifyStatusChange(userId, status)
  }

  onStatusUpdate(callback: (data: { userId: number; status: string }) => void) {
    wsService.onStatusUpdate(callback)
  }

  get isConnected(): boolean {
    return wsService.isConnected
  }
}

// Create and export a singleton instance
export const wsManager = new WebSocketManager()
export default wsManager
