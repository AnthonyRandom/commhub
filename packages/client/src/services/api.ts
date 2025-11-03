import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'

// API Base URL - adjust for production
const API_BASE_URL = 'https://commhub-production.up.railway.app'

// Types
export interface User {
  id: number
  username: string
  email: string
}

export interface AuthResponse {
  access_token: string
  user: User
}

export interface Server {
  id: number
  name: string
  description?: string
  ownerId: number
  inviteCode: string
  createdAt: string
  updatedAt: string
  members?: User[]
}

export interface Channel {
  id: number
  name: string
  type: 'text' | 'voice'
  serverId: number
  createdAt: string
}

export interface Message {
  id: number
  content: string
  userId: number
  channelId: number
  createdAt: string
  isEdited?: boolean
  editedAt?: string
  replyToId?: number
  replyTo?: {
    id: number
    content: string
    user: {
      id: number
      username: string
    }
  }
  user: {
    id: number
    username: string
  }
  channel: {
    id: number
    name: string
  }
}

export interface Friend {
  id: number
  username: string
  email: string
}

export interface FriendRequest {
  id: number
  senderId: number
  receiverId: number
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  sender?: {
    id: number
    username: string
    email: string
  }
  receiver?: {
    id: number
    username: string
    email: string
  }
}

export interface DirectMessage {
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

export interface Conversation {
  user: {
    id: number
    username: string
    email: string
  }
  lastMessage: DirectMessage | null
  unreadCount: number
}

class ApiService {
  private axiosInstance: AxiosInstance

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add request interceptor to include auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Add response interceptor to handle auth errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, clear local storage
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user')
          window.location.reload() // Force re-authentication
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth methods
  async register(data: {
    username: string
    email: string
    password: string
  }): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.axiosInstance.post(
      '/auth/register',
      data
    )
    return response.data
  }

  async login(data: { username: string; password: string }): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.axiosInstance.post('/auth/login', data)
    return response.data
  }

  async logout(): Promise<void> {
    await this.axiosInstance.post('/auth/logout')
  }

  async getProfile(): Promise<User> {
    const response: AxiosResponse<User> = await this.axiosInstance.get('/auth/profile')
    return response.data
  }

  // Server methods
  async getServers(): Promise<Server[]> {
    const response: AxiosResponse<Server[]> = await this.axiosInstance.get('/servers')
    return response.data
  }

  async createServer(data: { name: string; description?: string }): Promise<Server> {
    const response: AxiosResponse<Server> = await this.axiosInstance.post('/servers', data)
    return response.data
  }

  async joinServer(inviteCode: string): Promise<Server> {
    const response: AxiosResponse<Server> = await this.axiosInstance.post('/servers/join', {
      inviteCode,
    })
    return response.data
  }

  async getServerInviteCode(serverId: number): Promise<{ inviteCode: string }> {
    const response: AxiosResponse<{ inviteCode: string }> = await this.axiosInstance.get(
      `/servers/${serverId}/invite`
    )
    return response.data
  }

  async leaveServer(serverId: number): Promise<void> {
    await this.axiosInstance.post(`/servers/${serverId}/leave`)
  }

  // Channel methods
  async getChannels(): Promise<Channel[]> {
    const response: AxiosResponse<Channel[]> = await this.axiosInstance.get('/channels')
    return response.data
  }

  async createChannel(data: {
    name: string
    type: 'text' | 'voice'
    serverId: number
  }): Promise<Channel> {
    const response: AxiosResponse<Channel> = await this.axiosInstance.post('/channels', data)
    return response.data
  }

  async getChannelMessages(channelId: number): Promise<Message[]> {
    const response: AxiosResponse<Message[]> = await this.axiosInstance.get(
      `/channels/${channelId}/messages`
    )
    return response.data
  }

  // Message methods
  async sendMessage(data: {
    content: string
    channelId: number
    replyToId?: number
  }): Promise<Message> {
    const response: AxiosResponse<Message> = await this.axiosInstance.post('/messages', data)
    return response.data
  }

  async editMessage(messageId: number, content: string): Promise<Message> {
    const response: AxiosResponse<Message> = await this.axiosInstance.patch(
      `/messages/${messageId}`,
      { content }
    )
    return response.data
  }

  async deleteMessage(messageId: number): Promise<void> {
    await this.axiosInstance.delete(`/messages/${messageId}`)
  }

  // Server management methods
  async updateServer(
    serverId: number,
    data: { name?: string; description?: string }
  ): Promise<Server> {
    const response: AxiosResponse<Server> = await this.axiosInstance.patch(
      `/servers/${serverId}`,
      data
    )
    return response.data
  }

  async deleteServer(serverId: number): Promise<void> {
    await this.axiosInstance.delete(`/servers/${serverId}`)
  }

  // Channel management methods
  async updateChannel(
    channelId: number,
    data: { name?: string; type?: 'text' | 'voice' }
  ): Promise<Channel> {
    const response: AxiosResponse<Channel> = await this.axiosInstance.patch(
      `/channels/${channelId}`,
      data
    )
    return response.data
  }

  async deleteChannel(channelId: number): Promise<void> {
    await this.axiosInstance.delete(`/channels/${channelId}`)
  }

  // User search methods
  async findAll(): Promise<User[]> {
    const response: AxiosResponse<User[]> = await this.axiosInstance.get('/users')
    return response.data
  }

  // Friend methods
  async getFriends(userId: number): Promise<Friend[]> {
    const response: AxiosResponse<Friend[]> = await this.axiosInstance.get(
      `/users/${userId}/friends`
    )
    return response.data
  }

  async addFriend(userId: number, friendId: number): Promise<void> {
    await this.axiosInstance.post(`/users/${userId}/friends/${friendId}`)
  }

  async removeFriend(userId: number, friendId: number): Promise<void> {
    await this.axiosInstance.delete(`/users/${userId}/friends/${friendId}`)
  }

  // Friend requests methods
  async sendFriendRequest(receiverId: number): Promise<FriendRequest> {
    const response: AxiosResponse<FriendRequest> = await this.axiosInstance.post(
      '/friend-requests',
      { receiverId }
    )
    return response.data
  }

  async getSentFriendRequests(): Promise<FriendRequest[]> {
    const response: AxiosResponse<FriendRequest[]> =
      await this.axiosInstance.get('/friend-requests/sent')
    return response.data
  }

  async getReceivedFriendRequests(): Promise<FriendRequest[]> {
    const response: AxiosResponse<FriendRequest[]> = await this.axiosInstance.get(
      '/friend-requests/received'
    )
    return response.data
  }

  async respondToFriendRequest(
    requestId: number,
    status: 'accepted' | 'rejected'
  ): Promise<FriendRequest> {
    const response: AxiosResponse<FriendRequest> = await this.axiosInstance.patch(
      `/friend-requests/${requestId}/respond`,
      { status }
    )
    return response.data
  }

  async cancelFriendRequest(requestId: number): Promise<void> {
    await this.axiosInstance.delete(`/friend-requests/${requestId}`)
  }

  // Blocking methods
  async blockUser(userId: number, blockedUserId: number): Promise<void> {
    await this.axiosInstance.post(`/users/${userId}/block/${blockedUserId}`)
  }

  async unblockUser(userId: number, blockedUserId: number): Promise<void> {
    await this.axiosInstance.delete(`/users/${userId}/block/${blockedUserId}`)
  }

  async getBlockedUsers(userId: number): Promise<Friend[]> {
    const response: AxiosResponse<Friend[]> = await this.axiosInstance.get(
      `/users/${userId}/blocked`
    )
    return response.data
  }

  // Direct messages methods
  async sendDirectMessage(receiverId: number, content: string): Promise<DirectMessage> {
    const response: AxiosResponse<DirectMessage> = await this.axiosInstance.post(
      '/direct-messages',
      { receiverId, content }
    )
    return response.data
  }

  async getConversation(userId: number, limit = 50, offset = 0): Promise<DirectMessage[]> {
    const response: AxiosResponse<DirectMessage[]> = await this.axiosInstance.get(
      `/direct-messages/conversation/${userId}`,
      {
        params: { limit, offset },
      }
    )
    return response.data
  }

  async getAllConversations(): Promise<Conversation[]> {
    const response: AxiosResponse<Conversation[]> = await this.axiosInstance.get(
      '/direct-messages/conversations'
    )
    return response.data
  }

  async editDirectMessage(messageId: number, content: string): Promise<DirectMessage> {
    const response: AxiosResponse<DirectMessage> = await this.axiosInstance.patch(
      `/direct-messages/${messageId}`,
      { content }
    )
    return response.data
  }

  async deleteDirectMessage(messageId: number): Promise<void> {
    await this.axiosInstance.delete(`/direct-messages/${messageId}`)
  }

  async markConversationAsRead(userId: number): Promise<void> {
    await this.axiosInstance.post(`/direct-messages/conversation/${userId}/read`)
  }

  // Utility methods
  setAuthToken(token: string): void {
    localStorage.setItem('auth_token', token)
  }

  getAuthToken(): string | null {
    return localStorage.getItem('auth_token')
  }

  removeAuthToken(): void {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
  }

  setUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user))
  }

  getUser(): User | null {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken()
  }
}

// Create and export a singleton instance
export const apiService = new ApiService()
export default apiService
