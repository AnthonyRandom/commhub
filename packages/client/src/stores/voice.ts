import { create } from 'zustand'

export type ConnectionStatus = 'connecting' | 'connected' | 'failed' | 'disconnected'
export type ConnectionQuality =
  | 'excellent'
  | 'good'
  | 'poor'
  | 'critical'
  | 'connecting'
  | 'unknown'

export interface VoiceUser {
  userId: number
  username: string
  isSpeaking: boolean
  isMuted: boolean
  connectionStatus: ConnectionStatus
  connectionQuality: ConnectionQuality
  stream?: MediaStream
  localMuted: boolean
  localVolume: number
}

interface VoiceState {
  // Connection state
  connectedChannelId: number | null
  isConnecting: boolean
  connectionError: string | null

  // Quality monitoring
  overallQuality: ConnectionQuality
  qualityWarnings: string[]

  // User state
  isMuted: boolean
  isDeafened: boolean
  localStream: MediaStream | null

  // Voice channel participants
  connectedUsers: Map<number, VoiceUser>

  // Actions
  setConnectedChannel: (channelId: number | null) => void
  setIsConnecting: (isConnecting: boolean) => void
  setConnectionError: (error: string | null) => void
  setIsMuted: (isMuted: boolean) => void
  setIsDeafened: (isDeafened: boolean) => void
  setLocalStream: (stream: MediaStream | null) => void
  addConnectedUser: (user: VoiceUser) => void
  removeConnectedUser: (userId: number) => void
  updateUserSpeaking: (userId: number, isSpeaking: boolean) => void
  updateUserMuted: (userId: number, isMuted: boolean) => void
  updateUserStream: (userId: number, stream: MediaStream) => void
  updateUserConnectionStatus: (userId: number, status: ConnectionStatus) => void
  updateUserConnectionQuality: (userId: number, quality: ConnectionQuality) => void
  setUserLocalMuted: (userId: number, muted: boolean) => void
  setUserLocalVolume: (userId: number, volume: number) => void
  setOverallQuality: (quality: ConnectionQuality) => void
  addQualityWarning: (warning: string) => void
  removeQualityWarning: (warning: string) => void
  clearQualityWarnings: () => void
  clearConnectedUsers: () => void
  reset: () => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  // Initial state
  connectedChannelId: null,
  isConnecting: false,
  connectionError: null,
  overallQuality: 'unknown',
  qualityWarnings: [],
  isMuted: false,
  isDeafened: false,
  localStream: null,
  connectedUsers: new Map(),

  // Actions
  setConnectedChannel: (channelId) => set({ connectedChannelId: channelId }),

  setIsConnecting: (isConnecting) => set({ isConnecting }),

  setConnectionError: (error) => set({ connectionError: error }),

  setIsMuted: (isMuted) =>
    set((state) => {
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted
        })
      }
      return { isMuted }
    }),

  setIsDeafened: (isDeafened) =>
    set((state) => {
      // When deafened, also mute the user
      if (isDeafened && state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => {
          track.enabled = false
        })
      }
      return { isDeafened, isMuted: isDeafened ? true : state.isMuted }
    }),

  setLocalStream: (stream) => set({ localStream: stream }),

  addConnectedUser: (user) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      // Ensure connectionQuality is set
      const userWithQuality = {
        ...user,
        connectionQuality: user.connectionQuality || 'unknown',
      }
      newUsers.set(user.userId, userWithQuality)
      return { connectedUsers: newUsers }
    }),

  removeConnectedUser: (userId) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user?.stream) {
        user.stream.getTracks().forEach((track) => track.stop())
      }
      newUsers.delete(userId)
      return { connectedUsers: newUsers }
    }),

  updateUserSpeaking: (userId, isSpeaking) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user) {
        newUsers.set(userId, { ...user, isSpeaking })
      }
      return { connectedUsers: newUsers }
    }),

  updateUserMuted: (userId, isMuted) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user) {
        newUsers.set(userId, { ...user, isMuted })
      }
      return { connectedUsers: newUsers }
    }),

  updateUserStream: (userId, stream) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user) {
        newUsers.set(userId, { ...user, stream })
      }
      return { connectedUsers: newUsers }
    }),

  updateUserConnectionStatus: (userId, status) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user) {
        newUsers.set(userId, { ...user, connectionStatus: status })
      }
      return { connectedUsers: newUsers }
    }),

  setUserLocalMuted: (userId, muted) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user) {
        newUsers.set(userId, { ...user, localMuted: muted })
      }
      return { connectedUsers: newUsers }
    }),

  setUserLocalVolume: (userId, volume) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user) {
        newUsers.set(userId, { ...user, localVolume: volume })
      }
      return { connectedUsers: newUsers }
    }),

  updateUserConnectionQuality: (userId, quality) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user) {
        newUsers.set(userId, { ...user, connectionQuality: quality })
      }
      return { connectedUsers: newUsers }
    }),

  setOverallQuality: (quality) => set({ overallQuality: quality }),

  addQualityWarning: (warning) =>
    set((state) => ({
      qualityWarnings: [...state.qualityWarnings.filter((w) => w !== warning), warning],
    })),

  removeQualityWarning: (warning) =>
    set((state) => ({
      qualityWarnings: state.qualityWarnings.filter((w) => w !== warning),
    })),

  clearQualityWarnings: () => set({ qualityWarnings: [] }),

  clearConnectedUsers: () =>
    set((state) => {
      // Stop all streams
      state.connectedUsers.forEach((user) => {
        if (user.stream) {
          user.stream.getTracks().forEach((track) => track.stop())
        }
      })
      return { connectedUsers: new Map() }
    }),

  reset: () =>
    set((state) => {
      // Stop local stream
      if (state.localStream) {
        state.localStream.getTracks().forEach((track) => track.stop())
      }

      // Stop all remote streams
      state.connectedUsers.forEach((user) => {
        if (user.stream) {
          user.stream.getTracks().forEach((track) => track.stop())
        }
      })

      return {
        connectedChannelId: null,
        isConnecting: false,
        connectionError: null,
        overallQuality: 'unknown',
        qualityWarnings: [],
        isMuted: false,
        isDeafened: false,
        localStream: null,
        connectedUsers: new Map(),
      }
    }),
}))
