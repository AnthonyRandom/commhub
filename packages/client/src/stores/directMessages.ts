import { create } from 'zustand'
import { apiService, type DirectMessage, type Conversation } from '../services/api'

interface DirectMessagesState {
  conversations: Conversation[]
  messages: { [userId: number]: DirectMessage[] }
  activeConversation: number | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchConversations: () => Promise<void>
  fetchConversation: (userId: number) => Promise<void>
  sendDirectMessage: (receiverId: number, content: string) => Promise<void>
  editDirectMessage: (messageId: number, content: string) => Promise<void>
  deleteDirectMessage: (messageId: number, senderId: number, receiverId: number) => Promise<void>
  markConversationAsRead: (userId: number) => Promise<void>
  setActiveConversation: (userId: number | null) => void
  addMessage: (message: DirectMessage) => void
  clearError: () => void
}

export const useDirectMessagesStore = create<DirectMessagesState>((set, get) => ({
  conversations: [],
  messages: {},
  activeConversation: null,
  isLoading: false,
  error: null,

  fetchConversations: async () => {
    set({ isLoading: true, error: null })
    try {
      const conversations = await apiService.getAllConversations()
      set({ conversations, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch conversations'
      set({ isLoading: false, error: errorMessage })
    }
  },

  fetchConversation: async (userId: number) => {
    set({ isLoading: true, error: null })
    try {
      const messages = await apiService.getConversation(userId)
      set((state) => ({
        messages: {
          ...state.messages,
          [userId]: messages,
        },
        isLoading: false,
      }))
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch conversation'
      set({ isLoading: false, error: errorMessage })
    }
  },

  sendDirectMessage: async (receiverId: number, content: string) => {
    set({ error: null })
    try {
      await apiService.sendDirectMessage(receiverId, content)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to send message'
      set({ error: errorMessage })
      throw error
    }
  },

  editDirectMessage: async (messageId: number, content: string) => {
    set({ error: null })
    try {
      const updatedMessage = await apiService.editDirectMessage(messageId, content)

      const otherUserId =
        get().activeConversation === updatedMessage.senderId
          ? updatedMessage.receiverId
          : updatedMessage.senderId

      set((state) => {
        const conversationMessages = state.messages[otherUserId] || []
        const updatedMessages = conversationMessages.map((m) =>
          m.id === messageId ? updatedMessage : m
        )

        return {
          messages: {
            ...state.messages,
            [otherUserId]: updatedMessages,
          },
        }
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to edit message'
      set({ error: errorMessage })
      throw error
    }
  },

  deleteDirectMessage: async (messageId: number, senderId: number, receiverId: number) => {
    set({ error: null })
    try {
      await apiService.deleteDirectMessage(messageId)

      const otherUserId = get().activeConversation === senderId ? receiverId : senderId

      set((state) => {
        const conversationMessages = state.messages[otherUserId] || []
        const updatedMessages = conversationMessages.filter((m) => m.id !== messageId)

        return {
          messages: {
            ...state.messages,
            [otherUserId]: updatedMessages,
          },
        }
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to delete message'
      set({ error: errorMessage })
      throw error
    }
  },

  markConversationAsRead: async (userId: number) => {
    try {
      await apiService.markConversationAsRead(userId)

      set((state) => ({
        conversations: state.conversations.map((conv) =>
          conv.user.id === userId ? { ...conv, unreadCount: 0 } : conv
        ),
      }))
    } catch (error: any) {
      console.error('Failed to mark conversation as read:', error)
    }
  },

  setActiveConversation: (userId: number | null) => {
    set({ activeConversation: userId })
  },

  addMessage: (message: DirectMessage) => {
    const otherUserId =
      message.senderId === get().activeConversation ? message.receiverId : message.senderId

    set((state) => {
      const conversationMessages = state.messages[otherUserId] || []

      const messageExists = conversationMessages.some((m) => m.id === message.id)
      if (messageExists) {
        return state
      }

      return {
        messages: {
          ...state.messages,
          [otherUserId]: [...conversationMessages, message],
        },
      }
    })
  },

  clearError: () => {
    set({ error: null })
  },
}))
