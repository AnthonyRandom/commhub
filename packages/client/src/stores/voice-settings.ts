import { create } from 'zustand'
import { audioDeviceManager, AudioDevice } from '../services/audio-device-manager'

// Voice Settings Types
export interface VoiceSettings {
  // Input settings
  input: {
    deviceId?: string
    sensitivity: number // 0-100
    noiseSuppression: boolean
    echoCancellation: boolean
    autoGainControl: boolean
    noiseGate: number // 0-100
    noiseSuppressionMethod: 'none' | 'webrtc' | 'noise-gate' | 'rnnoise' | 'krisp'
    noiseSuppressionIntensity: number // 0-100
  }

  // Detection settings
  detection: {
    mode: 'voice_activity' | 'push_to_talk'
    pttKey?: string // key combination for PTT
    holdTime: number // ms
    cooldownTime: number // ms
  }

  // Output settings
  output: {
    deviceId?: string
    attenuation: number // 0-100 (how much to reduce others' volume)
    masterVolume: number // 0-100
  }

  // Quality settings
  quality: {
    bitrate: number // audio quality setting
    stereo: boolean
  }
}

export interface AvailableDevices {
  input: AudioDevice[]
  output: AudioDevice[]
}

interface VoiceSettingsState {
  settings: VoiceSettings
  availableDevices: AvailableDevices
  isLoadingDevices: boolean

  // Actions
  updateSettings: (updates: Partial<VoiceSettings>) => void
  updateInputSettings: (updates: Partial<VoiceSettings['input']>) => void
  updateDetectionSettings: (updates: Partial<VoiceSettings['detection']>) => void
  updateOutputSettings: (updates: Partial<VoiceSettings['output']>) => void
  updateQualitySettings: (updates: Partial<VoiceSettings['quality']>) => void

  loadDevices: () => Promise<void>
  saveSettings: () => void
  loadSettings: () => void
  resetToDefaults: () => void
}

// Default settings
const defaultSettings: VoiceSettings = {
  input: {
    deviceId: undefined,
    sensitivity: 50,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    noiseGate: 30,
    noiseSuppressionMethod: 'webrtc',
    noiseSuppressionIntensity: 50,
  },
  detection: {
    mode: 'voice_activity',
    pttKey: 'v',
    holdTime: 200,
    cooldownTime: 100,
  },
  output: {
    deviceId: undefined,
    attenuation: 0,
    masterVolume: 75,
  },
  quality: {
    bitrate: 64000, // 64kbps default
    stereo: false, // mono for voice is usually better
  },
}

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  settings: { ...defaultSettings },
  availableDevices: {
    input: [],
    output: [],
  },
  isLoadingDevices: false,

  updateSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }))
    get().saveSettings()
  },

  updateInputSettings: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        input: { ...state.settings.input, ...updates },
      },
    }))
    get().saveSettings()
  },

  updateDetectionSettings: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        detection: { ...state.settings.detection, ...updates },
      },
    }))
    get().saveSettings()
  },

  updateOutputSettings: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        output: { ...state.settings.output, ...updates },
      },
    }))
    get().saveSettings()
  },

  updateQualitySettings: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        quality: { ...state.settings.quality, ...updates },
      },
    }))
    get().saveSettings()
  },

  loadDevices: async () => {
    try {
      // Prevent multiple simultaneous calls
      const currentState = get()
      if (currentState.isLoadingDevices) {
        return
      }

      set({ isLoadingDevices: true })

      // Use the audio device manager to get properly formatted devices
      await audioDeviceManager.initialize()

      // Setup device change listener on first load
      setupDeviceChangeListener()

      const inputDevices = audioDeviceManager.getDevicesByType('audioinput')
      const outputDevices = audioDeviceManager.getDevicesByType('audiooutput')

      set({
        availableDevices: {
          input: inputDevices,
          output: outputDevices,
        },
        isLoadingDevices: false,
      })

      console.log('[VoiceSettings] Loaded devices:', {
        input: inputDevices.length,
        output: outputDevices.length,
      })
    } catch (error) {
      console.error('[VoiceSettings] Failed to load devices:', error)
      set({ isLoadingDevices: false })
    }
  },

  saveSettings: () => {
    try {
      const settings = get().settings
      localStorage.setItem('commhub-voice-settings', JSON.stringify(settings))
      console.log('[VoiceSettings] Settings saved')
    } catch (error) {
      console.error('[VoiceSettings] Failed to save settings:', error)
    }
  },

  loadSettings: () => {
    try {
      const saved = localStorage.getItem('commhub-voice-settings')
      if (saved) {
        const parsedSettings = JSON.parse(saved)
        // Merge with defaults to handle new settings
        const mergedSettings: VoiceSettings = {
          input: { ...defaultSettings.input, ...parsedSettings.input },
          detection: { ...defaultSettings.detection, ...parsedSettings.detection },
          output: { ...defaultSettings.output, ...parsedSettings.output },
          quality: { ...defaultSettings.quality, ...parsedSettings.quality },
        }
        set({ settings: mergedSettings })
        console.log('[VoiceSettings] Settings loaded')
      }
    } catch (error) {
      console.error('[VoiceSettings] Failed to load settings:', error)
      // Reset to defaults on error
      set({ settings: { ...defaultSettings } })
    }
  },

  resetToDefaults: () => {
    set({ settings: { ...defaultSettings } })
    get().saveSettings()
    console.log('[VoiceSettings] Reset to defaults')
  },
}))

// Initialize settings on store creation
useVoiceSettingsStore.getState().loadSettings()

// Device change listener setup flag
let deviceChangeListenerSetup = false

// Function to setup device change listener (called only once)
const setupDeviceChangeListener = () => {
  if (!deviceChangeListenerSetup) {
    audioDeviceManager.addDeviceChangeListener(() => {
      // Only log if not already loading devices
      if (!useVoiceSettingsStore.getState().isLoadingDevices) {
        console.log('[VoiceSettings] Audio devices changed, reloading...')
      }
      useVoiceSettingsStore.getState().loadDevices()
    })
    deviceChangeListenerSetup = true
  }
}

// Export helper functions
export const getVoiceSettings = () => useVoiceSettingsStore.getState().settings
export const updateVoiceSettings = (updates: Partial<VoiceSettings>) =>
  useVoiceSettingsStore.getState().updateSettings(updates)
