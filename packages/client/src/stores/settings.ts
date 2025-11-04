import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserSettings {
  notifications: boolean
  sounds: boolean
  fontSize: 'small' | 'medium' | 'large'
  timestampFormat: '12h' | '24h'
  audioInputDeviceId?: string
  audioOutputDeviceId?: string
}

interface SettingsState extends UserSettings {
  // Actions
  updateSettings: (settings: Partial<UserSettings>) => void
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void
  applyFontSize: (size: 'small' | 'medium' | 'large') => void
  getTimeFormat: () => (date: Date) => string
}

const defaultSettings: UserSettings = {
  notifications: true,
  sounds: true,
  fontSize: 'medium',
  timestampFormat: '12h',
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      updateSettings: (newSettings) => {
        set(newSettings)

        // Apply font size changes immediately
        if (newSettings.fontSize) {
          get().applyFontSize(newSettings.fontSize)
        }
      },

      updateSetting: (key, value) => {
        const newSettings = { [key]: value }
        set(newSettings)

        // Apply changes immediately based on the setting type
        if (key === 'fontSize') {
          get().applyFontSize(value as 'small' | 'medium' | 'large')
        }
      },

      applyFontSize: (size) => {
        const root = document.documentElement

        switch (size) {
          case 'small':
            root.style.setProperty('--font-size-base', '14px')
            root.style.setProperty('--font-size-lg', '16px')
            root.style.setProperty('--font-size-xl', '18px')
            break
          case 'medium':
            root.style.setProperty('--font-size-base', '16px')
            root.style.setProperty('--font-size-lg', '18px')
            root.style.setProperty('--font-size-xl', '20px')
            break
          case 'large':
            root.style.setProperty('--font-size-base', '18px')
            root.style.setProperty('--font-size-lg', '20px')
            root.style.setProperty('--font-size-xl', '24px')
            break
        }
      },

      getTimeFormat: () => {
        const format = get().timestampFormat
        return (date: Date) => {
          if (format === '24h') {
            return date.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            })
          } else {
            return date.toLocaleTimeString('en-US', {
              hour12: true,
              hour: 'numeric',
              minute: '2-digit',
            })
          }
        }
      },
    }),
    {
      name: 'commhub-settings',
      onRehydrateStorage: () => (state) => {
        // Apply settings on rehydration
        if (state) {
          state.applyFontSize(state.fontSize)
        }
      },
    }
  )
)
