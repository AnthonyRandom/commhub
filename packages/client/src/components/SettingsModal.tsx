import React, { useState, useEffect } from 'react'
import { X, Download, CheckCircle, AlertCircle, Bell, Volume2, Type, Clock } from 'lucide-react'
import { checkUpdate, installUpdate, onUpdaterEvent } from '@tauri-apps/api/updater'
import { relaunch } from '@tauri-apps/api/process'
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
  }, [])

  // Set up updater event listeners
  useEffect(() => {
    const unlisten = onUpdaterEvent(({ error, status }) => {
      console.log('Updater event:', status, error)

      if (error) {
        console.error('Updater error:', error)
        setUpdateStatus({
          type: 'error',
          message: `Update failed: ${error}`,
        })
        return
      }

      // Handle status updates
      if (status === 'UPTODATE') {
        setUpdateStatus({ type: 'current', message: 'You are on the latest version' })
      } else if (status === 'ERROR') {
        setUpdateStatus({ type: 'error', message: error || 'Update failed' })
      } else if (status === 'DONE') {
        setUpdateStatus({ type: 'installing', message: 'Update complete! Restarting...' })
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // Save settings to localStorage when they change
  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    localStorage.setItem('commhub-settings', JSON.stringify(newSettings))
  }

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true)
    setUpdateStatus({ type: 'checking', message: 'Checking for updates...' })

    try {
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

  const handleInstallUpdate = async () => {
    if (!updateManifest) {
      console.error('No update manifest available')
      setUpdateStatus({
        type: 'error',
        message: 'No update information available. Please check for updates first.',
      })
      return
    }

    setUpdateStatus({
      type: 'downloading',
      message: 'Downloading update... This may take a moment.',
    })

    try {
      console.log('Starting update installation...', updateManifest)

      // Install the update - this downloads and prepares it
      await installUpdate()

      console.log('Update download complete, preparing to restart...')

      setUpdateStatus({
        type: 'installing',
        message: 'Update ready! Restarting in 3 seconds...',
      })

      // Give user time to see the message, then restart
      setTimeout(async () => {
        try {
          console.log('Relaunching application...')
          await relaunch()
        } catch (relaunchError: any) {
          console.error('Relaunch error:', relaunchError)
          setUpdateStatus({
            type: 'error',
            message:
              'Update ready but failed to restart. Please close and reopen the app manually.',
          })
        }
      }, 3000)
    } catch (error: any) {
      console.error('Installation error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))

      let errorMessage = 'Failed to install update'

      // Provide more helpful error messages
      if (error.message) {
        errorMessage = error.message
      }

      if (error.toString().includes('permission') || error.toString().includes('access')) {
        errorMessage = 'Permission denied. Try closing the app and running the installer manually.'
      } else if (error.toString().includes('download') || error.toString().includes('network')) {
        errorMessage = 'Download failed. Check your internet connection and try again.'
      } else if (error.toString().includes('signature') || error.toString().includes('verify')) {
        errorMessage = 'Update signature verification failed. The update may be corrupted.'
      } else if (error.toString().includes('already running')) {
        errorMessage = 'Update already in progress. Please wait or restart the app.'
      }

      setUpdateStatus({
        type: 'error',
        message: errorMessage,
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

          {/* App Info Section */}
          <div>
            <h4 className="text-xs font-bold text-grey-400 uppercase tracking-wider mb-3">
              Application
            </h4>
            <div className="bg-grey-850 border-2 border-grey-700 p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-grey-400 text-sm">Version</span>
                  <span className="text-white text-sm font-mono">1.0.4</span>
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
                    onClick={handleInstallUpdate}
                    className="flex-1 bg-blue-500 text-white border-2 border-blue-500 hover:bg-blue-600 font-bold py-3 px-4 transition-colors uppercase tracking-wide"
                  >
                    Install Update
                  </button>
                )}

                {updateStatus.type === 'downloading' && (
                  <button
                    disabled
                    className="flex-1 bg-grey-700 text-grey-500 border-2 border-grey-700 font-bold py-3 px-4 uppercase tracking-wide cursor-not-allowed"
                  >
                    Downloading...
                  </button>
                )}

                {updateStatus.type === 'installing' && (
                  <button
                    disabled
                    className="flex-1 bg-grey-700 text-grey-500 border-2 border-grey-700 font-bold py-3 px-4 uppercase tracking-wide cursor-not-allowed"
                  >
                    Installing...
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
