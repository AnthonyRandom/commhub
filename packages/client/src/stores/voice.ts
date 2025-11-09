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
  hasVideo: boolean
  connectionStatus: ConnectionStatus
  connectionQuality: ConnectionQuality
  stream?: MediaStream
  videoStream?: MediaStream
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
  localVideoEnabled: boolean
  localVideoStream: MediaStream | null

  // Voice channel participants
  connectedUsers: Map<number, VoiceUser>

  // Actions
  setConnectedChannel: (channelId: number | null) => void
  setIsConnecting: (isConnecting: boolean) => void
  setConnectionError: (error: string | null) => void
  setIsMuted: (isMuted: boolean) => void
  setIsDeafened: (isDeafened: boolean) => void
  setLocalStream: (stream: MediaStream | null) => void
  setLocalVideoEnabled: (enabled: boolean) => void
  setLocalVideoStream: (stream: MediaStream | null) => void
  addConnectedUser: (user: VoiceUser) => void
  removeConnectedUser: (userId: number) => void
  updateUserSpeaking: (userId: number, isSpeaking: boolean) => void
  updateUserMuted: (userId: number, isMuted: boolean) => void
  updateUserVideo: (userId: number, hasVideo: boolean) => void
  updateUserStream: (userId: number, stream: MediaStream) => void
  updateUserVideoStream: (userId: number, stream: MediaStream) => void
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
  localVideoEnabled: false,
  localVideoStream: null,
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
      if (state.localStream) {
        if (isDeafened) {
          // When deafening, disable audio tracks
          state.localStream.getAudioTracks().forEach((track) => {
            track.enabled = false
          })
        } else {
          // When undeafening, restore audio based on mute state
          // User stays muted after undeafening (Discord behavior)
          state.localStream.getAudioTracks().forEach((track) => {
            track.enabled = !state.isMuted
          })
        }
      }
      return { isDeafened, isMuted: isDeafened ? true : state.isMuted }
    }),

  setLocalStream: (stream) => set({ localStream: stream }),

  setLocalVideoEnabled: (enabled) => set({ localVideoEnabled: enabled }),

  setLocalVideoStream: (stream) => set({ localVideoStream: stream }),

  addConnectedUser: (user) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      // Ensure connectionQuality and hasVideo are set
      const userWithDefaults = {
        ...user,
        connectionQuality: user.connectionQuality || 'unknown',
        hasVideo: user.hasVideo || false,
      }
      newUsers.set(user.userId, userWithDefaults)
      return { connectedUsers: newUsers }
    }),

  removeConnectedUser: (userId) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user?.stream) {
        user.stream.getTracks().forEach((track) => track.stop())
      }
      if (user?.videoStream) {
        user.videoStream.getTracks().forEach((track) => track.stop())
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

  updateUserVideo: (userId, hasVideo) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user) {
        newUsers.set(userId, { ...user, hasVideo })
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

  updateUserVideoStream: (userId, stream) =>
    set((state) => {
      const newUsers = new Map(state.connectedUsers)
      const user = newUsers.get(userId)
      if (user) {
        newUsers.set(userId, { ...user, videoStream: stream })
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

      // Stop local video stream
      if (state.localVideoStream) {
        state.localVideoStream.getTracks().forEach((track) => track.stop())
      }

      // Stop all remote streams
      state.connectedUsers.forEach((user) => {
        if (user.stream) {
          user.stream.getTracks().forEach((track) => track.stop())
        }
        if (user.videoStream) {
          user.videoStream.getTracks().forEach((track) => track.stop())
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
        localVideoEnabled: false,
        localVideoStream: null,
        connectedUsers: new Map(),
      }
    }),
}))
