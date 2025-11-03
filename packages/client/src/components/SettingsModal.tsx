import React, { useState, useEffect } from 'react'
import {
  X,
  Download,
  CheckCircle,
  AlertCircle,
  Bell,
  Volume2,
  Type,
  Clock,
  ExternalLink,
} from 'lucide-react'
import { checkUpdate } from '@tauri-apps/api/updater'
import { open } from '@tauri-apps/api/shell'
import type { UpdateManifest } from '@tauri-apps/api/updater'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface UserSettings {
  notifications: boolean
  sounds: boolean
  fontSize: 'small' | 'medium' | 'large'
  timestampFormat: '12h' | '24h'
  audioInputDeviceId?: string
  audioOutputDeviceId?: string
}

interface AudioDevice {
  deviceId: string
  label: string
  kind: string
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{
    type: 'idle' | 'checking' | 'available' | 'current' | 'error' | 'downloading' | 'installing'
    message: string
    version?: string
    progress?: number
  }>({ type: 'idle', message: '' })
  const [updateManifest, setUpdateManifest] = useState<UpdateManifest | null>(null)

  // Audio devices state
  const [audioInputDevices, setAudioInputDevices] = useState<AudioDevice[]>([])
  const [audioOutputDevices, setAudioOutputDevices] = useState<AudioDevice[]>([])
  const [isTesting, setIsTesting] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [testStream, setTestStream] = useState<MediaStream | null>(null)

  // User preferences state
  const [settings, setSettings] = useState<UserSettings>({
    notifications: true,
    sounds: true,
    fontSize: 'medium',
    timestampFormat: '12h',
  })

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('commhub-settings')
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }

    // Load audio devices
    loadAudioDevices()
  }, [])

  // Cleanup test stream when modal closes
  useEffect(() => {
    if (!isOpen && testStream) {
      stopMicTest()
    }

    // Debug: Log current settings when modal opens
    if (isOpen) {
      console.log('[Settings] Modal opened with settings:', settings)
      console.log('[Settings] Available input devices:', audioInputDevices)
      console.log('[Settings] Available output devices:', audioOutputDevices)
    }
  }, [isOpen, testStream])

  // Load available audio devices
  const loadAudioDevices = async () => {
    try {
      // Request permission first (and keep the stream to get proper labels)
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const devices = await navigator.mediaDevices.enumerateDevices()

      const inputs = devices
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
          kind: device.kind,
        }))

      const outputs = devices
        .filter((device) => device.kind === 'audiooutput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`,
          kind: device.kind,
        }))

      console.log('[Settings] Loaded audio devices:', { inputs, outputs })

      setAudioInputDevices(inputs)
      setAudioOutputDevices(outputs)

      // Stop the permission stream
      permissionStream.getTracks().forEach((track) => track.stop())
    } catch (error) {
      console.error('Failed to load audio devices:', error)
      alert('Failed to access audio devices. Please allow microphone permissions.')
    }
  }

  // Test microphone
  const startMicTest = async () => {
    try {
      const deviceId = settings.audioInputDeviceId
      const constraints: MediaStreamConstraints = {
        audio: deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true,
      }

      console.log('[Settings] Starting mic test with constraints:', constraints)

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      console.log(
        '[Settings] Got mic stream:',
        stream.getAudioTracks().map((t) => ({
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
        }))
      )

      setTestStream(stream)
      setIsTesting(true)

      // Set up audio analysis
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.3

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let animationId: number

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        const scaledLevel = Math.min(100, (average / 128) * 100) // Better scaling

        console.log('[Settings] Mic level:', average, 'scaled:', scaledLevel)
        setMicLevel(scaledLevel)

        animationId = requestAnimationFrame(updateLevel)
      }

      animationId = requestAnimationFrame(updateLevel)

      // Store animation ID for cleanup
      ;(stream as any)._animationId = animationId
      ;(stream as any)._audioContext = audioContext
    } catch (error) {
      console.error('Failed to start mic test:', error)
      setIsTesting(false)

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('Microphone access denied. Please allow microphone permissions in your browser.')
        } else if (error.name === 'NotFoundError') {
          alert('No microphone found. Please connect a microphone.')
        } else if (error.name === 'OverconstrainedError') {
          alert(
            'Selected microphone not available. Try selecting a different device or using default.'
          )
        } else {
          alert(`Failed to access microphone: ${error.message}`)
        }
      }
    }
  }

  // Stop microphone test
  const stopMicTest = () => {
    if (testStream) {
      // Cancel animation frame
      const animationId = (testStream as any)._animationId
      if (animationId) {
        cancelAnimationFrame(animationId)
      }

      // Close audio context
      const audioContext = (testStream as any)._audioContext
      if (audioContext) {
        audioContext.close()
      }

      // Stop all tracks
      testStream.getTracks().forEach((track) => track.stop())
      setTestStream(null)
    }
    setIsTesting(false)
    setMicLevel(0)
    console.log('[Settings] Mic test stopped')
  }

  // Save settings to localStorage when they change
  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    console.log('[Settings] Updating setting:', key, '=', value)
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    localStorage.setItem('commhub-settings', JSON.stringify(newSettings))
    console.log('[Settings] Settings saved:', newSettings)
  }

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true)
    setUpdateStatus({ type: 'checking', message: 'Checking for updates...' })

    try {
      // Check if running in Tauri environment
      if (!(window as any).__TAURI__) {
        console.log('Not running in Tauri - updates not available')
        setUpdateStatus({
          type: 'error',
          message:
            'Updates are only available in the desktop app. You are running the web version.',
        })
        setIsCheckingUpdate(false)
        return
      }

      console.log('Checking for updates...')
      const { shouldUpdate, manifest } = await checkUpdate()
      console.log('Update check result:', { shouldUpdate, manifest })

      if (shouldUpdate && manifest) {
        setUpdateManifest(manifest)
        setUpdateStatus({
          type: 'available',
          message: `Update available: v${manifest.version}`,
          version: manifest.version,
        })
        console.log('Update available:', manifest.version)
      } else {
        setUpdateStatus({
          type: 'current',
          message: 'You are on the latest version',
        })
        console.log('Already on latest version')
      }
    } catch (error: any) {
      console.error('Update check error:', error)

      let errorMessage = 'Failed to check for updates'

      // Provide more helpful error messages
      if (error.message) {
        errorMessage = error.message
      }

      // Check if it's a network/GitHub issue
      if (error.toString().includes('404') || error.toString().includes('Not Found')) {
        errorMessage = 'No releases found. Please create a GitHub release first.'
      } else if (error.toString().includes('Network') || error.toString().includes('fetch')) {
        errorMessage = 'Network error. Check your internet connection.'
      }

      setUpdateStatus({
        type: 'error',
        message: errorMessage,
      })
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const handleDownloadUpdate = async () => {
    if (!updateManifest) {
      console.error('No update manifest available')
      return
    }

    try {
      // Check if running in Tauri environment
      if (!(window as any).__TAURI__) {
        // For web version, just open the releases page in a new tab
        const downloadUrl = `https://github.com/AnthonyRandom/commhub/releases/tag/v${updateManifest.version}`
        window.open(downloadUrl, '_blank')
        setUpdateStatus({
          type: 'downloading',
          message: 'Download page opened in a new tab.',
        })
        return
      }

      // Open the GitHub releases page for this version
      const downloadUrl = `https://github.com/AnthonyRandom/commhub/releases/tag/v${updateManifest.version}`
      console.log('Opening download page:', downloadUrl)
      await open(downloadUrl)

      setUpdateStatus({
        type: 'downloading',
        message: 'Download page opened. Get the installer, close CommHub, then run it.',
      })
    } catch (error: any) {
      console.error('Failed to open download page:', error)
      setUpdateStatus({
        type: 'error',
        message: 'Failed to open download page. Visit: github.com/AnthonyRandom/commhub/releases',
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-grey-900 border-2 border-white w-[500px] max-h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="border-b-2 border-grey-800 p-4 flex items-center justify-between">
          <h3 className="font-bold text-white text-lg uppercase tracking-wider">Settings</h3>
          <button
            onClick={onClose}
            className="p-1 text-grey-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preferences Section */}
          <div>
            <h4 className="text-xs font-bold text-grey-400 uppercase tracking-wider mb-3">
              Preferences
            </h4>
            <div className="bg-grey-850 border-2 border-grey-700 p-4 space-y-4">
              {/* Notifications Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-grey-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Desktop Notifications</p>
                    <p className="text-grey-500 text-xs">Show notifications for new messages</p>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('notifications', !settings.notifications)}
                  className={`relative w-12 h-6 border-2 transition-colors ${
                    settings.notifications ? 'bg-white border-white' : 'bg-grey-700 border-grey-600'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-black transition-transform ${
                      settings.notifications ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Sound Toggle */}
              <div className="flex items-center justify-between pt-4 border-t border-grey-700">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-grey-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Sound Effects</p>
                    <p className="text-grey-500 text-xs">Play sounds for events</p>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('sounds', !settings.sounds)}
                  className={`relative w-12 h-6 border-2 transition-colors ${
                    settings.sounds ? 'bg-white border-white' : 'bg-grey-700 border-grey-600'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-black transition-transform ${
                      settings.sounds ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Font Size Selector */}
              <div className="pt-4 border-t border-grey-700">
                <div className="flex items-center gap-3 mb-3">
                  <Type className="w-5 h-5 text-grey-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Font Size</p>
                    <p className="text-grey-500 text-xs">Adjust message text size</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSetting('fontSize', size)}
                      className={`flex-1 py-2 border-2 transition-colors uppercase text-xs font-bold tracking-wider ${
                        settings.fontSize === size
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent text-grey-400 border-grey-700 hover:border-grey-600'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timestamp Format */}
              <div className="pt-4 border-t border-grey-700">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-5 h-5 text-grey-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Time Format</p>
                    <p className="text-grey-500 text-xs">Message timestamp display</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateSetting('timestampFormat', '12h')}
                    className={`flex-1 py-2 border-2 transition-colors uppercase text-xs font-bold tracking-wider ${
                      settings.timestampFormat === '12h'
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-grey-400 border-grey-700 hover:border-grey-600'
                    }`}
                  >
                    12 Hour
                  </button>
                  <button
                    onClick={() => updateSetting('timestampFormat', '24h')}
                    className={`flex-1 py-2 border-2 transition-colors uppercase text-xs font-bold tracking-wider ${
                      settings.timestampFormat === '24h'
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-grey-400 border-grey-700 hover:border-grey-600'
                    }`}
                  >
                    24 Hour
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Audio Settings Section */}
          <div>
            <h4 className="text-xs font-bold text-grey-400 uppercase tracking-wider mb-3">
              Audio Settings
            </h4>
            <div className="bg-grey-850 border-2 border-grey-700 p-4 space-y-4">
              {/* Microphone Selection */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Volume2 className="w-5 h-5 text-grey-400" />
                  <label className="text-white text-sm font-medium">
                    Input Device (Microphone)
                  </label>
                </div>
                <select
                  value={settings.audioInputDeviceId || 'default'}
                  onChange={(e) => {
                    console.log('[Settings] Input device dropdown changed:', e.target.value)
                    console.log(
                      '[Settings] Available options:',
                      Array.from(e.target.options).map((o) => ({
                        value: o.value,
                        text: o.text,
                        selected: o.selected,
                      }))
                    )
                    updateSetting('audioInputDeviceId', e.target.value)
                  }}
                  className="w-full bg-grey-800 border-2 border-grey-700 px-3 py-2 text-white focus:border-white"
                >
                  {audioInputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                  {audioInputDevices.length === 0 && (
                    <option value="default">No devices found - check permissions</option>
                  )}
                </select>
              </div>

              {/* Speaker Selection */}
              <div className="pt-4 border-t border-grey-700">
                <div className="flex items-center gap-3 mb-2">
                  <Volume2 className="w-5 h-5 text-grey-400" />
                  <label className="text-white text-sm font-medium">
                    Output Device (Speakers/Headphones)
                  </label>
                </div>
                <select
                  value={settings.audioOutputDeviceId || 'default'}
                  onChange={(e) => {
                    console.log('[Settings] Output device dropdown changed:', e.target.value)
                    updateSetting('audioOutputDeviceId', e.target.value)
                  }}
                  className="w-full bg-grey-800 border-2 border-grey-700 px-3 py-2 text-white focus:border-white"
                >
                  {audioOutputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                  {audioOutputDevices.length === 0 && (
                    <option value="default">No devices found - check permissions</option>
                  )}
                </select>
                <p className="text-grey-500 text-xs mt-2">
                  Note: Output device selection may not be supported in all browsers
                </p>
              </div>

              {/* Microphone Test */}
              <div className="pt-4 border-t border-grey-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white text-sm font-medium">Test Microphone</p>
                    <p className="text-grey-500 text-xs">Speak to see the level indicator</p>
                  </div>
                  <button
                    onClick={isTesting ? stopMicTest : startMicTest}
                    className={`px-4 py-2 border-2 font-bold text-sm transition-colors ${
                      isTesting
                        ? 'bg-red-900 border-red-700 text-white hover:bg-red-800'
                        : 'bg-white text-black border-white hover:bg-grey-100'
                    }`}
                  >
                    {isTesting ? 'Stop Test' : 'Test Mic'}
                  </button>
                </div>

                {/* Microphone Level Indicator */}
                {isTesting && (
                  <div className="space-y-2">
                    <div className="w-full h-6 bg-grey-800 border-2 border-grey-700 overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-100"
                        style={{ width: `${micLevel}%` }}
                      />
                    </div>
                    <p className="text-grey-400 text-xs text-center">
                      {micLevel > 10
                        ? '🎤 Microphone is working!'
                        : 'Speak into your microphone...'}
                    </p>
                  </div>
                )}
              </div>

              {/* Refresh Devices Button */}
              <div className="pt-4 border-t border-grey-700">
                <button
                  onClick={loadAudioDevices}
                  className="w-full px-4 py-2 bg-grey-800 text-white border-2 border-grey-700 hover:border-white transition-colors text-sm font-bold uppercase tracking-wide"
                >
                  Refresh Devices
                </button>
                <p className="text-grey-500 text-xs mt-2 text-center">
                  Click if you connected a new audio device
                </p>
              </div>
            </div>
          </div>

          {/* App Info Section */}
          <div>
            <h4 className="text-xs font-bold text-grey-400 uppercase tracking-wider mb-3">
              Application
            </h4>
            <div className="bg-grey-850 border-2 border-grey-700 p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-grey-400 text-sm">Version</span>
                  <span className="text-white text-sm font-mono">1.1.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-grey-400 text-sm">Product</span>
                  <span className="text-white text-sm">CommHub</span>
                </div>
              </div>
            </div>
          </div>

          {/* Updates Section */}
          <div>
            <h4 className="text-xs font-bold text-grey-400 uppercase tracking-wider mb-3">
              Updates
            </h4>
            <div className="bg-grey-850 border-2 border-grey-700 p-4 space-y-4">
              <p className="text-grey-300 text-sm">
                Keep CommHub up to date with the latest features and bug fixes.
              </p>

              {/* Update Status */}
              {updateStatus.type !== 'idle' && (
                <div
                  className={`p-3 border-2 ${
                    updateStatus.type === 'error'
                      ? 'bg-red-900/20 border-red-500'
                      : updateStatus.type === 'available'
                        ? 'bg-blue-900/20 border-blue-500'
                        : updateStatus.type === 'current'
                          ? 'bg-green-900/20 border-green-500'
                          : 'bg-grey-800 border-grey-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {updateStatus.type === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    {updateStatus.type === 'current' && (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    )}
                    {updateStatus.type === 'available' && (
                      <Download className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    )}
                    {(updateStatus.type === 'checking' || updateStatus.type === 'downloading') && (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin flex-shrink-0 mt-0.5"></div>
                    )}
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          updateStatus.type === 'error'
                            ? 'text-red-300'
                            : updateStatus.type === 'available'
                              ? 'text-blue-300'
                              : updateStatus.type === 'current'
                                ? 'text-green-300'
                                : 'text-grey-300'
                        }`}
                      >
                        {updateStatus.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Update Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCheckUpdate}
                  disabled={
                    isCheckingUpdate ||
                    updateStatus.type === 'downloading' ||
                    updateStatus.type === 'checking'
                  }
                  className="flex-1 bg-white text-black border-2 border-white hover:bg-grey-100 disabled:bg-grey-700 disabled:text-grey-500 disabled:border-grey-700 font-bold py-3 px-4 transition-colors uppercase tracking-wide disabled:cursor-not-allowed"
                >
                  {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                </button>

                {updateStatus.type === 'available' && (
                  <button
                    onClick={handleDownloadUpdate}
                    className="flex-1 bg-blue-500 text-white border-2 border-blue-500 hover:bg-blue-600 font-bold py-3 px-4 transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Update
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* About Section */}
          <div>
            <h4 className="text-xs font-bold text-grey-400 uppercase tracking-wider mb-3">About</h4>
            <div className="bg-grey-850 border-2 border-grey-700 p-4">
              <p className="text-grey-300 text-sm leading-relaxed">
                A lightweight, cross-platform communication application for real-time text and voice
                chats.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-grey-800 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors font-bold uppercase tracking-wide"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
