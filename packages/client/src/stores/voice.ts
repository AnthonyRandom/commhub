import { create } from 'zustand'

export type ConnectionStatus = 'connecting' | 'connected' | 'failed' | 'disconnected'

export interface VoiceUser {
  userId: number
  username: string
  isSpeaking: boolean
  isMuted: boolean
  connectionStatus: ConnectionStatus
  stream?: MediaStream
}

interface VoiceState {
  // Connection state
  connectedChannelId: number | null
  isConnecting: boolean
  connectionError: string | null

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
  clearConnectedUsers: () => void
  reset: () => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  // Initial state
  connectedChannelId: null,
  isConnecting: false,
  connectionError: null,
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
      newUsers.set(user.userId, user)
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
        isMuted: false,
        isDeafened: false,
        localStream: null,
        connectedUsers: new Map(),
      }
    }),
}))
