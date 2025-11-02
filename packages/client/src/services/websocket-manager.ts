import { wsService } from './websocket'
import { apiService } from './api'
import { useMessagesStore } from '../stores/messages'
import { useServersStore } from '../stores/servers'

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
