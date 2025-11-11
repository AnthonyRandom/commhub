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
  lastFetchTime: number | null
  fetchingUserId: number | null

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
  lastFetchTime: null,
  fetchingUserId: null,

  fetchFriends: async (userId: number) => {
    const state = get()
    const now = Date.now()
    const CACHE_DURATION = 5000 // 5 seconds cache
    const isSameUser = state.fetchingUserId === userId
    const isRecentFetch = state.lastFetchTime && now - state.lastFetchTime < CACHE_DURATION

    // Prevent duplicate calls: skip if already loading for same user or if data is fresh
    if (state.isLoading && isSameUser) {
      console.log(`[FriendsStore] fetchFriends skipped - already loading for userId: ${userId}`)
      return
    }

    if (isRecentFetch && isSameUser && state.friends.length > 0) {
      console.log(
        `[FriendsStore] fetchFriends skipped - data is fresh (${now - state.lastFetchTime!}ms ago)`
      )
      return
    }

    console.log(`[FriendsStore] fetchFriends called for userId: ${userId}`)
    set({ isLoading: true, error: null, fetchingUserId: userId })
    try {
      const friends = await apiService.getFriends(userId)
      console.log(`[FriendsStore] API returned ${friends.length} friends`)

      // Preserve any existing status updates from WebSocket that came before fetch
      const currentFriends = get().friends
      console.log(`[FriendsStore] Current friends before fetch: ${currentFriends.length}`)

      const friendsWithPreservedStatus = friends.map((friend) => {
        const existingFriend = currentFriends.find((f) => f.id === friend.id)
        // If friend already has a status from WebSocket, keep it
        if (existingFriend?.status) {
          console.log(
            `[FriendsStore] Preserving status ${existingFriend.status} for friend ${friend.username} (${friend.id})`
          )
          return { ...friend, status: existingFriend.status }
        }
        return friend
      })

      console.log(
        `[FriendsStore] Final friends with statuses:`,
        friendsWithPreservedStatus.map((f) => ({
          id: f.id,
          username: f.username,
          status: f.status,
        }))
      )
      set({
        friends: friendsWithPreservedStatus,
        isLoading: false,
        lastFetchTime: now,
        fetchingUserId: null,
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch friends'
      console.error(`[FriendsStore] fetchFriends error:`, errorMessage)
      set({ isLoading: false, error: errorMessage, fetchingUserId: null })
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
    console.log(
      `[FriendsStore] updateFriendStatus called for user ${userId} with status: ${status}`
    )
    console.log(`[FriendsStore] Current friends array length:`, get().friends.length)

    const friendExists = get().friends.some((f) => f.id === userId)
    if (!friendExists) {
      console.warn(`[FriendsStore] Friend with userId ${userId} not found in friends array!`)
    }

    set((state) => {
      const allowedStatuses = ['online', 'idle', 'dnd', 'invisible'] as const

      const updated = state.friends.map((f) => {
        if (f.id === userId) {
          console.log(
            `[FriendsStore] Updating friend ${f.username} (${userId}) status to: ${status}`
          )
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

      console.log(
        `[FriendsStore] Friends after status update:`,
        updated.map((f) => ({ id: f.id, username: f.username, status: f.status }))
      )
      return { friends: updated }
    })
  },
}))
