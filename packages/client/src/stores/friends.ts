import { create } from 'zustand'
import { apiService, type Friend, type FriendRequest } from '../services/api'
import { wsService } from '../services/websocket'

interface FriendsState {
  friends: Friend[]
  blockedUsers: Friend[]
  sentRequests: FriendRequest[]
  receivedRequests: FriendRequest[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchFriends: (userId: number) => Promise<void>
  fetchBlockedUsers: (userId: number) => Promise<void>
  fetchSentRequests: () => Promise<void>
  fetchReceivedRequests: () => Promise<void>
  sendFriendRequest: (receiverId: number) => Promise<void>
  respondToRequest: (requestId: number, status: 'accepted' | 'rejected') => Promise<void>
  cancelRequest: (requestId: number) => Promise<void>
  removeFriend: (userId: number, friendId: number) => Promise<void>
  blockUser: (userId: number, blockedUserId: number) => Promise<void>
  unblockUser: (userId: number, blockedUserId: number) => Promise<void>
  clearError: () => void
  setOnlineFriends: (online: { id: number; status?: string }[]) => void
  updateFriendStatus: (userId: number, status: string) => void
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  blockedUsers: [],
  sentRequests: [],
  receivedRequests: [],
  isLoading: false,
  error: null,

  fetchFriends: async (userId: number) => {
    set({ isLoading: true, error: null })
    try {
      const friends = await apiService.getFriends(userId)
      set({ friends, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch friends'
      set({ isLoading: false, error: errorMessage })
    }
  },

  fetchBlockedUsers: async (userId: number) => {
    set({ isLoading: true, error: null })
    try {
      const blockedUsers = await apiService.getBlockedUsers(userId)
      set({ blockedUsers, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch blocked users'
      set({ isLoading: false, error: errorMessage })
    }
  },

  fetchSentRequests: async () => {
    set({ isLoading: true, error: null })
    try {
      const sentRequests = await apiService.getSentFriendRequests()
      set({ sentRequests, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch sent requests'
      set({ isLoading: false, error: errorMessage })
    }
  },

  fetchReceivedRequests: async () => {
    set({ isLoading: true, error: null })
    try {
      const receivedRequests = await apiService.getReceivedFriendRequests()
      set({ receivedRequests, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch received requests'
      set({ isLoading: false, error: errorMessage })
    }
  },

  sendFriendRequest: async (receiverId: number) => {
    set({ isLoading: true, error: null })
    try {
      const request = await apiService.sendFriendRequest(receiverId)
      set((state) => ({
        sentRequests: [...state.sentRequests, request],
        isLoading: false,
      }))

      // Notify receiver via WebSocket
      const socket = wsService.getSocket()
      if (socket && request.sender) {
        socket.emit('friend-request-sent', {
          receiverId: receiverId,
          senderUsername: request.sender.username,
        })
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to send friend request'
      set({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  respondToRequest: async (requestId: number, status: 'accepted' | 'rejected') => {
    set({ isLoading: true, error: null })
    try {
      // Find the request before removing it
      const request = get().receivedRequests.find((r) => r.id === requestId)

      await apiService.respondToFriendRequest(requestId, status)
      set((state) => ({
        receivedRequests: state.receivedRequests.filter((r) => r.id !== requestId),
        isLoading: false,
      }))

      if (status === 'accepted') {
        if (request?.sender) {
          set((state) => ({
            friends: [...state.friends, request.sender!],
          }))
        }
      }

      // Notify sender via WebSocket
      const socket = wsService.getSocket()
      if (socket && request?.sender) {
        socket.emit('friend-request-response', {
          requestId: requestId,
          senderId: request.sender.id,
          status: status,
        })
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to respond to friend request'
      set({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  cancelRequest: async (requestId: number) => {
    set({ isLoading: true, error: null })
    try {
      await apiService.cancelFriendRequest(requestId)
      set((state) => ({
        sentRequests: state.sentRequests.filter((r) => r.id !== requestId),
        isLoading: false,
      }))
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to cancel friend request'
      set({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  removeFriend: async (userId: number, friendId: number) => {
    set({ isLoading: true, error: null })
    try {
      await apiService.removeFriend(userId, friendId)
      set((state) => ({
        friends: state.friends.filter((f) => f.id !== friendId),
        isLoading: false,
      }))
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to remove friend'
      set({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  blockUser: async (userId: number, blockedUserId: number) => {
    set({ isLoading: true, error: null })
    try {
      await apiService.blockUser(userId, blockedUserId)

      const blockedUser = get().friends.find((f) => f.id === blockedUserId)

      set((state) => ({
        friends: state.friends.filter((f) => f.id !== blockedUserId),
        blockedUsers: blockedUser ? [...state.blockedUsers, blockedUser] : state.blockedUsers,
        sentRequests: state.sentRequests.filter(
          (r) => r.receiverId !== blockedUserId && r.senderId !== blockedUserId
        ),
        receivedRequests: state.receivedRequests.filter(
          (r) => r.senderId !== blockedUserId && r.receiverId !== blockedUserId
        ),
        isLoading: false,
      }))
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to block user'
      set({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  unblockUser: async (userId: number, blockedUserId: number) => {
    set({ isLoading: true, error: null })
    try {
      await apiService.unblockUser(userId, blockedUserId)
      set((state) => ({
        blockedUsers: state.blockedUsers.filter((u) => u.id !== blockedUserId),
        isLoading: false,
      }))
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to unblock user'
      set({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  },

  setOnlineFriends: (onlineFriends: { id: number; status?: string }[]) => {
    set((state) => {
      const allowedStatuses = ['online', 'idle', 'dnd', 'invisible'] as const
      const updated = state.friends.map((f) => {
        const online = onlineFriends.find((o) => o.id === f.id)
        if (online) {
          const status = allowedStatuses.includes(online.status as any)
            ? (online.status as (typeof allowedStatuses)[number])
            : 'online'
          return { ...f, status }
        }
        return f
      })
      return { friends: updated }
    })
  },

  updateFriendStatus: (userId: number, status: string) => {
    set((state) => {
      const allowedStatuses = ['online', 'idle', 'dnd', 'invisible'] as const

      const updated = state.friends.map((f) => {
        if (f.id === userId) {
          // If status is 'offline', set to undefined (not online)
          if (status === 'offline') {
            return { ...f, status: undefined }
          }
          // Otherwise, validate and set the status
          const validStatus = allowedStatuses.includes(status as any)
            ? (status as (typeof allowedStatuses)[number])
            : undefined
          return { ...f, status: validStatus }
        }
        return f
      })
      return { friends: updated }
    })
  },
}))
