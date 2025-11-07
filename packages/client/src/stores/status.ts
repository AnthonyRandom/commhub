import { create } from 'zustand'
import { apiService } from '../services/api'
import { wsManager } from '../services/websocket-manager'

export type UserStatus = 'online' | 'idle' | 'dnd' | 'invisible'

interface StatusState {
  userStatuses: Map<number, UserStatus>
  lastActivity: number

  // Actions
  setUserStatus: (userId: number, status: UserStatus) => void
  updateStatus: (status: UserStatus) => Promise<void>
  updateLastActivity: () => void
  getUserStatus: (userId: number) => UserStatus | undefined
  initializeStatusTracking: () => void
  cleanup: () => void
}

export const useStatusStore = create<StatusState>((set, get) => ({
  userStatuses: new Map(),
  lastActivity: Date.now(),

  setUserStatus: (userId: number, status: UserStatus) => {
    set((state) => {
      const newStatuses = new Map(state.userStatuses)
      newStatuses.set(userId, status)
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
    set({ lastActivity: Date.now() })
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

    // Auto-set idle status after 5-10 minutes of inactivity
    const checkIdleStatus = () => {
      const { lastActivity } = get()
      const now = Date.now()
      const idleTime = now - lastActivity

      // 5 minutes = 300000ms, 10 minutes = 600000ms
      if (idleTime > 300000 && idleTime < 600000) {
        // Check if user is not already idle or dnd
        const currentStatus = get().getUserStatus(user.id)
        if (currentStatus === 'online') {
          get().updateStatus('idle')
        }
      }
    }

    // Check for idle status every minute
    const idleCheckInterval = setInterval(checkIdleStatus, 60000)

    // Store cleanup function
    ;(get() as any).storedCleanup = () => {
      window.removeEventListener('mousedown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
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
