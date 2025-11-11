import { create } from 'zustand'
import { apiService, type User } from '../services/api'
import { wsManager } from '../services/websocket-manager'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (
    username: string,
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (username: string, password: string, rememberMe: boolean = true) => {
    set({ isLoading: true, error: null })
    try {
      const response = await apiService.login({ username, password })

      // Save auth data - if rememberMe is false, only save to session (localStorage)
      // If rememberMe is true, save to persistent storage (Tauri filesystem)
      await apiService.setAuthToken(response.access_token)
      await apiService.setUser(response.user, rememberMe)

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      // Connect to WebSocket
      await wsManager.connect()
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed'
      set({
        isLoading: false,
        error: errorMessage,
      })
      throw error
    }
  },

  register: async (
    username: string,
    email: string,
    password: string,
    rememberMe: boolean = true
  ) => {
    set({ isLoading: true, error: null })
    try {
      const response = await apiService.register({ username, email, password })

      // Save auth data - if rememberMe is false, only save to session (localStorage)
      // If rememberMe is true, save to persistent storage (Tauri filesystem)
      await apiService.setAuthToken(response.access_token)
      await apiService.setUser(response.user, rememberMe)

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      // Connect to WebSocket
      await wsManager.connect()
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Registration failed'
      set({
        isLoading: false,
        error: errorMessage,
      })
      throw error
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await apiService.logout()
    } catch (error) {
      // Even if logout fails on server, clear local state
      console.warn('Logout failed on server:', error)
    } finally {
      // Disconnect from WebSocket
      wsManager.disconnect()

      await apiService.removeAuthToken()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
    }
  },

  checkAuth: async () => {
    console.log('AuthStore: checkAuth called')
    try {
      const token = await apiService.getAuthToken()
      const user = await apiService.getUser()

      console.log('AuthStore: token exists:', !!token)
      console.log('AuthStore: user exists:', !!user)
      console.log('AuthStore: token value:', token ? token.substring(0, 20) + '...' : 'null')
      console.log('AuthStore: user value:', user)

      if (token && user) {
        console.log('AuthStore: Setting authenticated state')
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        })
      } else {
        console.log('AuthStore: Setting unauthenticated state')
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
      console.log('AuthStore: checkAuth completed successfully')
    } catch (error) {
      console.error('AuthStore: checkAuth error:', error)
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Authentication check failed',
      })
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))
