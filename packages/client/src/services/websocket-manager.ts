import { wsService } from './websocket'
import { apiService } from './api'
import { useMessagesStore } from '../stores/messages'
import { useServersStore } from '../stores/servers'
import { useDirectMessagesStore } from '../stores/directMessages'
import { useFriendsStore } from '../stores/friends'
import { useChannelsStore } from '../stores/channels'
import { useAuthStore } from '../stores/auth'
import { useVoiceMembersStore } from '../stores/voiceMembers'
import { useStatusStore, type UserStatus } from '../stores/status'
import { useMentionsStore } from '../stores/mentions'

class WebSocketManager {
  private isInitialized = false

  initialize() {
    if (this.isInitialized) {
      return
    }

    this.isInitialized = true

    // Initialize WebSocket listeners
    useMessagesStore.getState().initializeWebSocketListeners()
    useMentionsStore.getState().initializeWebSocketListeners()
    this.initializeServerListeners()
    this.initializeDirectMessageListeners()

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

    // Note: voice-channel-members is handled by voiceSignalingHandler.setupWebSocketListeners()
    // to avoid duplicate listeners and ensure proper camera/screen share state syncing

    // Initial sync on connection
    socket.on(
      'initial-sync',
      (data: {
        onlineFriends: any[]
        voiceChannels?: Record<number, Array<{ userId: number; username: string }>>
      }) => {
        console.log('[WebSocket] Initial sync received:', data)
        useFriendsStore.getState().setOnlineFriends(data.onlineFriends)

        // Also populate status store with online friends
        const statusStore = useStatusStore.getState()
        data.onlineFriends.forEach((friend) => {
          const status = friend.status || 'online'
          if (['online', 'idle', 'dnd', 'invisible'].includes(status)) {
            statusStore.setUserStatus(friend.id, status as UserStatus)
          }
        })

        // Populate voice channel members for all accessible channels
        if (data.voiceChannels) {
          const voiceMembersStore = useVoiceMembersStore.getState()
          Object.entries(data.voiceChannels).forEach(([channelId, members]) => {
            // Ensure all members have hasCamera property
            const membersWithCamera = members.map((m: any) => ({
              ...m,
              hasCamera: m.hasCamera ?? false,
            }))
            voiceMembersStore.setMembers(parseInt(channelId), membersWithCamera)
          })
          console.log(
            '[WebSocket] Loaded voice channel snapshots for',
            Object.keys(data.voiceChannels).length,
            'channels'
          )
        }
      }
    )

    // Friend presence updates (online/offline/idle/dnd status changes)
    socket.on('friend-presence', (data: { userId: number; username: string; status: string }) => {
      console.log('[WebSocket] Friend presence update:', data)

      // Update friends store (for friends list)
      useFriendsStore.getState().updateFriendStatus(data.userId, data.status)

      // Also update status store (for StatusIndicator component)
      const statusStore = useStatusStore.getState()
      if (data.status === 'offline') {
        // Remove from status store when offline
        console.log('[WebSocket] Removing user', data.userId, 'from status store (offline)')
        statusStore.removeUserStatus(data.userId)
      } else if (['online', 'idle', 'dnd', 'invisible'].includes(data.status)) {
        console.log('[WebSocket] Setting user', data.userId, 'status to', data.status)
        statusStore.setUserStatus(data.userId, data.status as UserStatus)
      }
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

  private initializeDirectMessageListeners() {
    // Listen for incoming direct messages
    wsService.onDirectMessage((data) => {
      console.log('[WebSocket] Direct message received:', data)
      useDirectMessagesStore.getState().addMessage(data)
      // Refresh conversations to update last message and unread count
      useDirectMessagesStore.getState().fetchConversations()
    })
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
