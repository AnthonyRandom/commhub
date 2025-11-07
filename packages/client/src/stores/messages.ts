import { create } from 'zustand'
import { apiService, type Message } from '../services/api'
import { wsService, type WSMessage } from '../services/websocket'
import { useAuthStore } from './auth'

interface MessagesState {
  messages: { [channelId: number]: Message[] }
  isLoading: boolean
  isLoadingOlder: { [channelId: number]: boolean }
  hasMoreMessages: { [channelId: number]: boolean }
  error: string | null

  // Actions
  fetchMessages: (channelId: number) => Promise<void>
  loadOlderMessages: (channelId: number) => Promise<void>
  sendMessage: (channelId: number, content: string, replyToId?: number) => Promise<void>
  editMessage: (messageId: number, content: string) => Promise<void>
  deleteMessage: (channelId: number, messageId: number) => Promise<void>
  addMessage: (message: WSMessage) => void
  updateMessage: (message: WSMessage) => void
  removeMessage: (channelId: number, messageId: number) => void
  clearError: () => void
  initializeWebSocketListeners: () => void
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: {},
  isLoading: false,
  isLoadingOlder: {},
  hasMoreMessages: {},
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
        hasMoreMessages: {
          ...state.hasMoreMessages,
          [channelId]: messages.length >= 50, // If we got 50 or more messages, there might be more
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

  loadOlderMessages: async (channelId: number) => {
    const state = get()
    if (state.isLoadingOlder[channelId] || !state.hasMoreMessages[channelId]) {
      return
    }

    const currentMessages = state.messages[channelId] || []
    if (currentMessages.length === 0) return

    // Get the oldest message ID to load messages before it
    const oldestMessageId = currentMessages[0].id

    set((state) => ({
      isLoadingOlder: {
        ...state.isLoadingOlder,
        [channelId]: true,
      },
      error: null,
    }))

    try {
      const olderMessages = await apiService.getChannelMessages(channelId, oldestMessageId, 50)
      set((state) => {
        const existingMessages = state.messages[channelId] || []
        const existingMessageIds = new Set(existingMessages.map((m) => m.id))

        // Filter out any messages that already exist to prevent duplicates
        const newOlderMessages = olderMessages.filter((msg) => !existingMessageIds.has(msg.id))
        const hasMore = olderMessages.length >= 50 // If we got the full amount requested, there might be more

        return {
          messages: {
            ...state.messages,
            [channelId]: [...newOlderMessages, ...existingMessages], // Prepend only new older messages
          },
          hasMoreMessages: {
            ...state.hasMoreMessages,
            [channelId]: hasMore,
          },
          isLoadingOlder: {
            ...state.isLoadingOlder,
            [channelId]: false,
          },
        }
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to load older messages'
      set((state) => ({
        isLoadingOlder: {
          ...state.isLoadingOlder,
          [channelId]: false,
        },
        error: errorMessage,
      }))
    }
  },

  sendMessage: async (channelId: number, content: string, replyToId?: number) => {
    try {
      // Optimistically add message to UI
      const tempMessage: Message = {
        id: Date.now(), // Temporary ID
        content,
        userId: 0, // Will be set by server
        channelId,
        createdAt: new Date().toISOString(),
        replyToId,
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
      wsService.sendMessage(channelId, content, replyToId)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to send message'
      set({ error: errorMessage })
      throw error
    }
  },

  editMessage: async (messageId: number, content: string) => {
    try {
      const updatedMessage = await apiService.editMessage(messageId, content)

      set((state) => {
        const channelId = updatedMessage.channelId
        const channelMessages = state.messages[channelId] || []
        const updatedMessages = channelMessages.map((m) =>
          m.id === messageId ? updatedMessage : m
        )

        return {
          messages: {
            ...state.messages,
            [channelId]: updatedMessages,
          },
        }
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to edit message'
      set({ error: errorMessage })
      throw error
    }
  },

  deleteMessage: async (channelId: number, messageId: number) => {
    try {
      await apiService.deleteMessage(messageId)

      set((state) => {
        const channelMessages = state.messages[channelId] || []
        const updatedMessages = channelMessages.filter((m) => m.id !== messageId)

        return {
          messages: {
            ...state.messages,
            [channelId]: updatedMessages,
          },
        }
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to delete message'
      set({ error: errorMessage })
      throw error
    }
  },

  addMessage: (message: WSMessage) => {
    const currentUser = useAuthStore.getState().user

    set((state) => {
      const channelMessages = state.messages[message.channelId] || []

      // Check if message already exists (to avoid duplicates)
      const messageExists = channelMessages.some((m) => m.id === message.id)
      if (messageExists) {
        return state
      }

      // Check if this message is from the current user (replace optimistic message)
      if (currentUser && message.userId === currentUser.id) {
        const optimisticMessageIndex = channelMessages.findIndex(
          (m) => m.userId === 0 && m.content === message.content
        )

        if (optimisticMessageIndex !== -1) {
          // Replace optimistic message with real message
          const updatedMessages = [...channelMessages]
          updatedMessages[optimisticMessageIndex] = {
            id: message.id,
            content: message.content,
            userId: message.userId,
            channelId: message.channelId,
            createdAt: message.createdAt,
            isEdited: message.isEdited,
            editedAt: message.editedAt,
            replyTo: message.replyTo,
            user: {
              id: message.userId,
              username: message.username,
            },
            channel: {
              id: message.channelId,
              name: 'Current Channel',
            },
          }

          return {
            messages: {
              ...state.messages,
              [message.channelId]: updatedMessages,
            },
          }
        }
      }

      // Add new message normally
      const channelMessage: Message = {
        id: message.id,
        content: message.content,
        userId: message.userId,
        channelId: message.channelId,
        createdAt: message.createdAt,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
        replyTo: message.replyTo,
        user: {
          id: message.userId,
          username: message.username,
        },
        channel: {
          id: message.channelId,
          name: 'Current Channel',
        },
      }

      return {
        messages: {
          ...state.messages,
          [message.channelId]: [...channelMessages, channelMessage],
        },
      }
    })
  },

  updateMessage: (message: WSMessage) => {
    set((state) => {
      const channelMessages = state.messages[message.channelId] || []
      const updatedMessages = channelMessages.map((m) =>
        m.id === message.id
          ? {
              ...m,
              content: message.content,
              isEdited: message.isEdited,
              editedAt: message.editedAt,
            }
          : m
      )

      return {
        messages: {
          ...state.messages,
          [message.channelId]: updatedMessages,
        },
      }
    })
  },

  removeMessage: (channelId: number, messageId: number) => {
    set((state) => {
      const channelMessages = state.messages[channelId] || []
      const updatedMessages = channelMessages.filter((m) => m.id !== messageId)

      return {
        messages: {
          ...state.messages,
          [channelId]: updatedMessages,
        },
      }
    })
  },

  initializeWebSocketListeners: () => {
    // Set up WebSocket listeners for real-time messages
    wsService.onMessage((message) => {
      get().addMessage(message)
    })

    // Listen for message edits
    wsService.getSocket()?.on('message-edited', (data) => {
      get().updateMessage(data)
    })

    // Listen for message deletions
    wsService.getSocket()?.on('message-deleted', (data) => {
      get().removeMessage(data.channelId, data.messageId)
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
