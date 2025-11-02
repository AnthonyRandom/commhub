import { create } from 'zustand'
import { apiService, type Channel } from '../services/api'

interface ChannelsState {
  channels: Channel[]
  currentChannel: Channel | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchChannels: () => Promise<void>
  createChannel: (name: string, type: 'text' | 'voice', serverId: number) => Promise<Channel>
  selectChannel: (channel: Channel | null) => void
  getChannelsByServer: (serverId: number) => Channel[]
  clearError: () => void
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: [],
  currentChannel: null,
  isLoading: false,
  error: null,

  fetchChannels: async () => {
    set({ isLoading: true, error: null })
    try {
      const channels = await apiService.getChannels()
      set({
        channels,
        isLoading: false,
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch channels'
      set({
        isLoading: false,
        error: errorMessage,
      })
    }
  },

  createChannel: async (name: string, type: 'text' | 'voice', serverId: number) => {
    set({ isLoading: true, error: null })
    try {
      const newChannel = await apiService.createChannel({ name, type, serverId })
      const currentChannels = get().channels
      set({
        channels: [...currentChannels, newChannel],
        isLoading: false,
      })
      return newChannel
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to create channel'
      set({
        isLoading: false,
        error: errorMessage,
      })
      throw error
    }
  },

  selectChannel: (channel: Channel | null) => {
    set({ currentChannel: channel })
  },

  getChannelsByServer: (serverId: number) => {
    const channels = get().channels
    return channels.filter((channel) => channel.serverId === serverId)
  },

  clearError: () => {
    set({ error: null })
  },
}))
