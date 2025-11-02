import { createStore } from 'zustand/vanilla'
import { apiService, type Message } from '../services/api'
import { wsService, type WSMessage } from '../services/websocket'

interface MessagesState {
  messages: { [channelId: number]: Message[] }
  isLoading: boolean
  error: string | null

  // Actions
  fetchMessages: (channelId: number) => Promise<void>
  sendMessage: (channelId: number, content: string) => Promise<void>
  addMessage: (message: WSMessage) => void
  clearError: () => void
  initializeWebSocketListeners: () => void
}

export const useMessagesStore = createStore<MessagesState>((set, get) => ({
  messages: {},
  isLoading: false,
  error: null,

  fetchMessages: async (channelId: number) => {
    set({ isLoading: true, error: null })
    try {
      const messages = await apiService.getChannelMessages(channelId)
      set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: messages,
        },
        isLoading: false,
      }))
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch messages'
      set({
        isLoading: false,
        error: errorMessage,
      })
    }
  },

  sendMessage: async (channelId: number, content: string) => {
    try {
      // Optimistically add message to UI
      const tempMessage: Message = {
        id: Date.now(), // Temporary ID
        content,
        userId: 0, // Will be set by server
        channelId,
        createdAt: new Date().toISOString(),
        user: {
          id: 0,
          username: 'You',
        },
        channel: {
          id: channelId,
          name: 'Current Channel',
        },
      }

      set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: [...(state.messages[channelId] || []), tempMessage],
        },
      }))

      // Send via WebSocket (this will also add the real message via addMessage)
      wsService.sendMessage(channelId, content)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to send message'
      set({ error: errorMessage })
      throw error
    }
  },

  addMessage: (message: WSMessage) => {
    const channelMessage: Message = {
      id: message.id,
      content: message.content,
      userId: message.userId,
      channelId: message.channelId,
      createdAt: message.createdAt,
      user: {
        id: message.userId,
        username: message.username,
      },
      channel: {
        id: message.channelId,
        name: 'Current Channel',
      },
    }

    set((state) => {
      const channelMessages = state.messages[message.channelId] || []
      // Check if message already exists (to avoid duplicates)
      const messageExists = channelMessages.some((m) => m.id === message.id)

      if (messageExists) {
        return state
      }

      return {
        messages: {
          ...state.messages,
          [message.channelId]: [...channelMessages, channelMessage],
        },
      }
    })
  },

  initializeWebSocketListeners: () => {
    // Set up WebSocket listeners for real-time messages
    wsService.onMessage((message) => {
      get().addMessage(message)
    })

    wsService.onError((error) => {
      console.error('WebSocket error:', error)
      set({ error: 'Connection error' })
    })
  },

  clearError: () => {
    set({ error: null })
  },
}))
