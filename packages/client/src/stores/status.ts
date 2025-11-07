import { create } from 'zustand'
import { apiService } from '../services/api'
import { wsManager } from '../services/websocket-manager'
import { useVoiceStore } from './voice'

export type UserStatus = 'online' | 'idle' | 'dnd' | 'invisible'

interface StatusState {
  userStatuses: Map<number, UserStatus>
  lastActivity: number
  wasAutoIdled: boolean

  // Actions
  setUserStatus: (userId: number, status: UserStatus) => void
  removeUserStatus: (userId: number) => void
  updateStatus: (status: UserStatus) => Promise<void>
  updateLastActivity: () => void
  getUserStatus: (userId: number) => UserStatus | undefined
  initializeStatusTracking: () => void
  cleanup: () => void
}

export const useStatusStore = create<StatusState>((set, get) => ({
  userStatuses: new Map(),
  lastActivity: Date.now(),
  wasAutoIdled: false,

  setUserStatus: (userId: number, status: UserStatus) => {
    set((state) => {
      const newStatuses = new Map(state.userStatuses)
      newStatuses.set(userId, status)
      return { userStatuses: newStatuses }
    })
  },

  removeUserStatus: (userId: number) => {
    set((state) => {
      const newStatuses = new Map(state.userStatuses)
      newStatuses.delete(userId)
      return { userStatuses: newStatuses }
    })
  },

  updateStatus: async (status: UserStatus) => {
    const user = apiService.getUser()
    if (!user) return

    try {
      await apiService.updateStatus(user.id, status)
      get().setUserStatus(user.id, status)

      // Notify WebSocket about status change
      wsManager.notifyStatusChange(user.id, status)
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  },

  updateLastActivity: () => {
    const user = apiService.getUser()
    if (!user) return

    set({ lastActivity: Date.now() })

    // If user was auto-idled and now has activity, restore to online
    const { wasAutoIdled } = get()
    const currentStatus = get().getUserStatus(user.id)

    if (wasAutoIdled && currentStatus === 'idle') {
      set({ wasAutoIdled: false })
      get().updateStatus('online')
    }
  },

  getUserStatus: (userId: number): UserStatus | undefined => {
    // For invisible users, return 'online' if they're actually online but invisible
    // This is handled server-side - invisible users appear offline to others
    return get().userStatuses.get(userId)
  },

  initializeStatusTracking: () => {
    const user = apiService.getUser()
    if (!user) return

    // Set initial status to online
    get().setUserStatus(user.id, 'online')
    get().updateStatus('online')

    // Track user activity
    const handleActivity = () => {
      get().updateLastActivity()
    }

    // Listen for various user activity events
    window.addEventListener('mousedown', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('scroll', handleActivity)
    window.addEventListener('touchstart', handleActivity)

    // Listen for WebSocket status updates
    wsManager.onStatusUpdate((data: { userId: number; status: string }) => {
      get().setUserStatus(data.userId, data.status as UserStatus)
    })

    // Auto-set idle status after 15 minutes of inactivity
    const checkIdleStatus = () => {
      const { lastActivity } = get()
      const now = Date.now()
      const idleTime = now - lastActivity

      // 15 minutes = 900000ms
      if (idleTime > 900000) {
        const currentStatus = get().getUserStatus(user.id)

        // Only auto-idle if user is online and not in a voice channel
        if (currentStatus === 'online') {
          const voiceState = useVoiceStore.getState()
          const isInVoiceChannel = voiceState.connectedChannelId !== null

          // Don't go idle if in voice channel
          if (!isInVoiceChannel) {
            set({ wasAutoIdled: true })
            get().updateStatus('idle')
          }
        }
      }
    }

    // Check for idle status every minute
    const idleCheckInterval = setInterval(checkIdleStatus, 60000)

    // Track window focus/blur for activity
    const handleWindowFocus = () => {
      get().updateLastActivity()
    }

    window.addEventListener('focus', handleWindowFocus)

    // Store cleanup function
    ;(get() as any).storedCleanup = () => {
      window.removeEventListener('mousedown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      window.removeEventListener('focus', handleWindowFocus)
      clearInterval(idleCheckInterval)
    }
  },

  cleanup: () => {
    const cleanupFunc = (get() as any).storedCleanup
    if (cleanupFunc) {
      cleanupFunc()
    }
  },
}))
