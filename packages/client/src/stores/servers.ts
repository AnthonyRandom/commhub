import { create } from 'zustand'
import { apiService, type Server, type User } from '../services/api'

interface ServersState {
  servers: Server[]
  currentServer: Server | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchServers: () => Promise<void>
  createServer: (name: string, description?: string) => Promise<Server>
  joinServer: (inviteCode: string) => Promise<Server>
  leaveServer: (serverId: number) => Promise<void>
  selectServer: (server: Server | null) => void
  getServerInviteCode: (serverId: number) => Promise<string>
  addMemberToServer: (serverId: number, user: Pick<User, 'id' | 'username'>) => void
  removeMemberFromServer: (serverId: number, userId: number) => void
  clearError: () => void
}

export const useServersStore = create<ServersState>((set, get) => ({
  servers: [],
  currentServer: null,
  isLoading: false,
  error: null,

  fetchServers: async () => {
    set({ isLoading: true, error: null })
    try {
      const servers = await apiService.getServers()
      set({
        servers,
        isLoading: false,
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch servers'
      set({
        isLoading: false,
        error: errorMessage,
      })
    }
  },

  createServer: async (name: string, description?: string) => {
    set({ isLoading: true, error: null })
    try {
      const newServer = await apiService.createServer({ name, description })
      const currentServers = get().servers
      set({
        servers: [...currentServers, newServer],
        currentServer: newServer,
        isLoading: false,
      })
      return newServer
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to create server'
      set({
        isLoading: false,
        error: errorMessage,
      })
      throw error
    }
  },

  joinServer: async (inviteCode: string) => {
    set({ isLoading: true, error: null })
    try {
      const joinedServer = await apiService.joinServer(inviteCode)
      const currentServers = get().servers
      const isAlreadyJoined = currentServers.some((s) => s.id === joinedServer.id)

      if (!isAlreadyJoined) {
        set({
          servers: [...currentServers, joinedServer],
          currentServer: joinedServer,
          isLoading: false,
        })
      } else {
        set({
          currentServer: joinedServer,
          isLoading: false,
        })
      }
      return joinedServer
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to join server'
      set({
        isLoading: false,
        error: errorMessage,
      })
      throw error
    }
  },

  leaveServer: async (serverId: number) => {
    set({ isLoading: true, error: null })
    try {
      await apiService.leaveServer(serverId)
      const currentServers = get().servers
      const updatedServers = currentServers.filter((s) => s.id !== serverId)
      const currentServer = get().currentServer

      set({
        servers: updatedServers,
        currentServer: currentServer?.id === serverId ? null : currentServer,
        isLoading: false,
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to leave server'
      set({
        isLoading: false,
        error: errorMessage,
      })
      throw error
    }
  },

  selectServer: (server: Server | null) => {
    set({ currentServer: server })
  },

  getServerInviteCode: async (serverId: number) => {
    try {
      const response = await apiService.getServerInviteCode(serverId)
      return response.inviteCode
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to get invite code'
      set({ error: errorMessage })
      throw error
    }
  },

  addMemberToServer: (serverId: number, user: Pick<User, 'id' | 'username'>) => {
    set((state) => {
      const servers = state.servers.map((server) => {
        if (server.id === serverId) {
          const memberExists = server.members?.some((m) => m.id === user.id)
          if (!memberExists) {
            return {
              ...server,
              members: [...(server.members || []), { ...user, email: '' }],
            }
          }
        }
        return server
      })

      const currentServer =
        state.currentServer?.id === serverId
          ? servers.find((s) => s.id === serverId) || state.currentServer
          : state.currentServer

      return { servers, currentServer }
    })
  },

  removeMemberFromServer: (serverId: number, userId: number) => {
    set((state) => {
      const servers = state.servers.map((server) => {
        if (server.id === serverId) {
          return {
            ...server,
            members: server.members?.filter((m) => m.id !== userId) || [],
          }
        }
        return server
      })

      const currentServer =
        state.currentServer?.id === serverId
          ? servers.find((s) => s.id === serverId) || state.currentServer
          : state.currentServer

      return { servers, currentServer }
    })
  },

  clearError: () => {
    set({ error: null })
  },
}))
