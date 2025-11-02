import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'

// API Base URL - adjust for production
const API_BASE_URL = 'http://localhost:3000'

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
  async sendMessage(data: { content: string; channelId: number }): Promise<Message> {
    const response: AxiosResponse<Message> = await this.axiosInstance.post('/messages', data)
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
