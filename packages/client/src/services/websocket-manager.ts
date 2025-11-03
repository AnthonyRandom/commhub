import { wsService } from './websocket'
import { apiService } from './api'
import { useMessagesStore } from '../stores/messages'
import { useServersStore } from '../stores/servers'
import { useDirectMessagesStore } from '../stores/directMessages'

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

  private initializeChannelListeners() {
    // Listen for new channels being created
    wsService.getSocket()?.on('channel-created', (data) => {
      console.log('[WebSocket] Channel created:', data)
      const { useChannelsStore } = require('../stores/channels')
      useChannelsStore.getState().addChannel(data.channel)
    })

    // Listen for channels being updated
    wsService.getSocket()?.on('channel-updated', (data) => {
      console.log('[WebSocket] Channel updated:', data)
      const { useChannelsStore } = require('../stores/channels')
      useChannelsStore.getState().updateChannel(data.channel)
    })

    // Listen for channels being deleted
    wsService.getSocket()?.on('channel-deleted', (data) => {
      console.log('[WebSocket] Channel deleted:', data)
      const { useChannelsStore } = require('../stores/channels')
      useChannelsStore.getState().removeChannel(data.channelId)
    })
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
    // Listen for incoming friend requests
    wsService.getSocket()?.on('friend-request-received', (data) => {
      console.log('[WebSocket] Friend request received:', data)
      // Refresh received requests
      const { useFriendsStore } = require('../stores/friends')
      useFriendsStore.getState().fetchReceivedRequests()
    })

    // Listen for friend request responses
    wsService.getSocket()?.on('friend-request-responded', (data) => {
      console.log('[WebSocket] Friend request responded:', data)
      // Refresh friend requests and friends list
      const { useFriendsStore } = require('../stores/friends')
      const { useAuthStore } = require('../stores/auth')
      const user = useAuthStore.getState().user

      if (user) {
        useFriendsStore.getState().fetchSentRequests()
        useFriendsStore.getState().fetchReceivedRequests()
        useFriendsStore.getState().fetchFriends(user.id)
      }
    })
  }

  connect() {
    const token = apiService.getAuthToken()
    if (token) {
      wsService.connect(token)
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

  get isConnected(): boolean {
    return wsService.isConnected
  }
}

// Create and export a singleton instance
export const wsManager = new WebSocketManager()
export default wsManager
