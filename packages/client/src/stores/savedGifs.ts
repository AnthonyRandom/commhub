import { create } from 'zustand'
import { apiService } from '../services/api'

interface SavedGif {
  id: number
  gifUrl: string
  tenorId?: string
  contentDescription?: string
  thumbnailUrl?: string
  createdAt: string
}

interface SavedGifsState {
  savedGifs: SavedGif[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchSavedGifs: () => Promise<void>
  saveGif: (data: {
    gifUrl: string
    tenorId?: string
    contentDescription?: string
    thumbnailUrl?: string
  }) => Promise<void>
  removeSavedGif: (gifId: number) => Promise<void>
  isGifSaved: (gifUrl: string) => boolean
  clearError: () => void
}

export const useSavedGifsStore = create<SavedGifsState>((set, get) => ({
  savedGifs: [],
  isLoading: false,
  error: null,

  fetchSavedGifs: async () => {
    set({ isLoading: true, error: null })
    try {
      const gifs = await apiService.getSavedGifs()
      set({ savedGifs: gifs, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch saved GIFs'
      set({ isLoading: false, error: errorMessage })
    }
  },

  saveGif: async (data) => {
    set({ error: null })
    try {
      const newGif = await apiService.saveGif(data)
      set((state) => ({
        savedGifs: [newGif, ...state.savedGifs],
      }))
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save GIF'
      set({ error: errorMessage })
      throw error
    }
  },

  removeSavedGif: async (gifId) => {
    set({ error: null })
    try {
      await apiService.removeSavedGif(gifId)
      set((state) => ({
        savedGifs: state.savedGifs.filter((gif) => gif.id !== gifId),
      }))
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to remove saved GIF'
      set({ error: errorMessage })
      throw error
    }
  },

  isGifSaved: (gifUrl) => {
    const state = get()
    return state.savedGifs.some((gif) => gif.gifUrl === gifUrl)
  },

  clearError: () => {
    set({ error: null })
  },
}))

