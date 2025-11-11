import { create } from 'zustand'
import { apiService } from '../services/api'
import { wsService } from '../services/websocket'

interface Mention {
  id: number
  messageId: number
  userId: number
  channelId: number
  isRead: boolean
  createdAt: string
  message: {
    id: number
    content: string
    user: {
      id: number
      username: string
    }
    channel: {
      id: number
      name: string
      serverId: number
    }
  }
}

interface MentionNotification {
  messageId: number
  channelId: number
  channelName: string
  fromUserId: number
  fromUsername: string
  content: string
  createdAt: string
}

interface MentionsState {
  mentions: Mention[]
  channelMentionCounts: { [channelId: number]: number }
  isLoading: boolean
  error: string | null

  // Actions
  fetchMentions: () => Promise<void>
  fetchChannelMentionCount: (channelId: number) => Promise<void>
  markMentionAsRead: (mentionId: number) => Promise<void>
  markChannelMentionsAsRead: (channelId: number) => Promise<void>
  addMentionNotification: (notification: MentionNotification) => void
  clearError: () => void
  initializeWebSocketListeners: () => void
}

export const useMentionsStore = create<MentionsState>((set, get) => ({
  mentions: [],
  channelMentionCounts: {},
  isLoading: false,
  error: null,

  fetchMentions: async () => {
    set({ isLoading: true, error: null })
    try {
      const mentions = await apiService.getMentions()
      set({ mentions, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch mentions'
      set({ isLoading: false, error: errorMessage })
    }
  },

  fetchChannelMentionCount: async (channelId: number) => {
    try {
      const count = await apiService.getChannelMentionCount(channelId)
      set((state) => ({
        channelMentionCounts: {
          ...state.channelMentionCounts,
          [channelId]: count,
        },
      }))
    } catch (error: any) {
      console.error('Failed to fetch channel mention count:', error)
    }
  },

  markMentionAsRead: async (mentionId: number) => {
    try {
      await apiService.markMentionAsRead(mentionId)
      set((state) => ({
        mentions: state.mentions.filter((m) => m.id !== mentionId),
      }))
    } catch (error: any) {
      console.error('Failed to mark mention as read:', error)
    }
  },

  markChannelMentionsAsRead: async (channelId: number) => {
    try {
      await apiService.markChannelMentionsAsRead(channelId)
      set((state) => ({
        mentions: state.mentions.filter((m) => m.channelId !== channelId),
        channelMentionCounts: {
          ...state.channelMentionCounts,
          [channelId]: 0,
        },
      }))
    } catch (error: any) {
      console.error('Failed to mark channel mentions as read:', error)
    }
  },

  addMentionNotification: (notification: MentionNotification) => {
    const { channelId } = notification
    set((state) => ({
      channelMentionCounts: {
        ...state.channelMentionCounts,
        [channelId]: (state.channelMentionCounts[channelId] || 0) + 1,
      },
    }))
  },

  clearError: () => {
    set({ error: null })
  },

  initializeWebSocketListeners: () => {
    // Listen for mention events
    wsService.onMention((notification: MentionNotification) => {
      get().addMentionNotification(notification)
    })
  },
}))
