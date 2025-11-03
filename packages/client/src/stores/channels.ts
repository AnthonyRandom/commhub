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
  addChannel: (channel: Channel) => void
  updateChannel: (channel: Channel) => void
  removeChannel: (channelId: number) => void
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

  addChannel: (channel: Channel) => {
    const currentChannels = get().channels
    // Check if channel already exists to avoid duplicates
    if (!currentChannels.some((c) => c.id === channel.id)) {
      set({
        channels: [...currentChannels, channel],
      })
    }
  },

  updateChannel: (updatedChannel: Channel) => {
    const currentChannels = get().channels
    const updatedChannels = currentChannels.map((c) =>
      c.id === updatedChannel.id ? updatedChannel : c
    )
    set({ channels: updatedChannels })

    // If the updated channel is the current channel, update it too
    const currentChannel = get().currentChannel
    if (currentChannel?.id === updatedChannel.id) {
      set({ currentChannel: updatedChannel })
    }
  },

  removeChannel: (channelId: number) => {
    const currentChannels = get().channels
    const filteredChannels = currentChannels.filter((c) => c.id !== channelId)
    set({ channels: filteredChannels })

    // If the removed channel is the current channel, clear it
    const currentChannel = get().currentChannel
    if (currentChannel?.id === channelId) {
      set({ currentChannel: null })
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
