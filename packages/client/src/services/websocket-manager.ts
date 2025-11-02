import { wsService } from './websocket'
import { apiService } from './api'
import { useMessagesStore } from '../stores/messages'

class WebSocketManager {
  private isInitialized = false

  initialize() {
    if (this.isInitialized) {
      return
    }

    this.isInitialized = true

    // Initialize WebSocket listeners
    const messagesStore = useMessagesStore.getState()
    messagesStore.initializeWebSocketListeners()

    // Set up auth-based connection management
    this.checkAndConnect()
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
