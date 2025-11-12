import { create } from 'zustand'
import { apiService, type DirectMessage, type Conversation } from '../services/api'
import { useAuthStore } from './auth'
import { useSettingsStore } from './settings'
import { useStatusStore } from './status'
import { notificationService } from '../services/notifications'

interface DirectMessagesState {
  conversations: Conversation[]
  messages: { [userId: number]: DirectMessage[] }
  hiddenConversations: Set<number> // Track which conversations are hidden/closed by user
  activeConversation: number | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchConversations: () => Promise<void>
  fetchConversation: (userId: number) => Promise<void>
  sendDirectMessage: (
    receiverId: number,
    content: string,
    attachments?: Array<{ url: string; filename: string; mimeType: string; size: number }>
  ) => Promise<void>
  editDirectMessage: (messageId: number, content: string) => Promise<void>
  deleteDirectMessage: (messageId: number, senderId: number, receiverId: number) => Promise<void>
  markConversationAsRead: (userId: number) => Promise<void>
  deleteConversation: (userId: number) => Promise<void>
  setActiveConversation: (userId: number | null) => void
  addMessage: (message: DirectMessage) => void
  updateDirectMessage: (message: DirectMessage) => void
  removeDirectMessage: (userId: number, messageId: number) => void
  clearError: () => void

  // Computed getters
  visibleConversations: Conversation[]
}

export const useDirectMessagesStore = create<DirectMessagesState>((set, get) => ({
  conversations: [],
  messages: {},
  hiddenConversations: new Set(),
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

  sendDirectMessage: async (
    receiverId: number,
    content: string,
    attachments?: Array<{ url: string; filename: string; mimeType: string; size: number }>
  ) => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return

    set({ error: null })
    try {
      // Optimistically add message to UI
      const tempMessage: DirectMessage = {
        id: Date.now(), // Temporary ID
        content,
        senderId: currentUser.id, // Use actual sender ID
        receiverId,
        createdAt: new Date().toISOString(),
        isEdited: false,
        editedAt: undefined,
        isRead: false,
        sender: {
          id: currentUser.id,
          username: currentUser.username,
        },
        receiver: {
          id: receiverId,
          username: 'Friend', // Will be replaced by real data
        },
        attachments: attachments as any,
      }

      set((state) => {
        // Un-hide conversation if it was previously hidden
        const newHiddenConversations = new Set(state.hiddenConversations)
        newHiddenConversations.delete(receiverId)

        return {
          messages: {
            ...state.messages,
            [receiverId]: [...(state.messages[receiverId] || []), tempMessage],
          },
          hiddenConversations: newHiddenConversations,
        }
      })

      // Send empty string if no content but attachments exist
      const messageContent = content || (attachments && attachments.length > 0 ? '' : content)
      await apiService.sendDirectMessage(receiverId, messageContent, attachments)
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

  deleteConversation: async (userId: number) => {
    set((state) => ({
      hiddenConversations: new Set([...state.hiddenConversations, userId]),
      messages: {
        ...state.messages,
        [userId]: [], // Clear messages for this conversation
      },
    }))
  },

  setActiveConversation: (userId: number | null) => {
    set({ activeConversation: userId })
  },

  addMessage: (message: DirectMessage) => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return

    // For DMs, otherUserId is the person we're chatting with
    // If we're the sender, otherUserId is the receiver
    // If we're the receiver, otherUserId is the sender
    const otherUserId = message.senderId === currentUser.id ? message.receiverId : message.senderId

    set((state) => {
      const conversationMessages = state.messages[otherUserId] || []

      // Check if message already exists (to avoid duplicates)
      const messageExists = conversationMessages.some((m) => m.id === message.id)
      if (messageExists) {
        return state
      }

      // Check if this message is from the current user (replace optimistic message)
      if (message.senderId === currentUser.id) {
        const optimisticMessageIndex = conversationMessages.findIndex(
          (m) =>
            m.senderId === currentUser.id &&
            m.content === message.content &&
            m.id > Date.now() - 10000 // Within last 10 seconds
        )

        if (optimisticMessageIndex !== -1) {
          // Replace optimistic message with real message
          const updatedMessages = [...conversationMessages]
          updatedMessages[optimisticMessageIndex] = message

          return {
            messages: {
              ...state.messages,
              [otherUserId]: updatedMessages,
            },
          }
        }
      }

      // Add new message normally
      const newState = {
        messages: {
          ...state.messages,
          [otherUserId]: [...conversationMessages, message],
        },
      }

      // Trigger notification for incoming messages (not from current user)
      if (message.senderId !== currentUser.id) {
        const settings = useSettingsStore.getState()
        const userStatus = useStatusStore.getState().getUserStatus(currentUser.id)
        notificationService.showDMNotification(
          message.sender.username,
          message.content,
          settings,
          userStatus
        )
      }

      return newState
    })
  },

  updateDirectMessage: (message: DirectMessage) => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return

    const otherUserId = message.senderId === currentUser.id ? message.receiverId : message.senderId

    set((state) => {
      const conversationMessages = state.messages[otherUserId] || []
      const updatedMessages = conversationMessages.map((m) => (m.id === message.id ? message : m))

      return {
        messages: {
          ...state.messages,
          [otherUserId]: updatedMessages,
        },
      }
    })
  },

  removeDirectMessage: (userId: number, messageId: number) => {
    set((state) => {
      const conversationMessages = state.messages[userId] || []
      const updatedMessages = conversationMessages.filter((m) => m.id !== messageId)

      return {
        messages: {
          ...state.messages,
          [userId]: updatedMessages,
        },
      }
    })
  },

  clearError: () => {
    set({ error: null })
  },

  // Computed getter for visible conversations (filters out hidden ones)
  get visibleConversations() {
    const state = get()
    return state.conversations.filter((conv) => !state.hiddenConversations.has(conv.user.id))
  },
}))
