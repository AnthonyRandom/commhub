import React, { useState, useEffect } from 'react'
import { Download, X, AlertCircle } from 'lucide-react'
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'
import type { UpdateManifest } from '@tauri-apps/api/updater'
import { appWindow } from '@tauri-apps/api/window'

interface UpdateNotificationProps {
  onDismiss: () => void
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onDismiss }) => {
  const [manifest, setManifest] = useState<UpdateManifest | null>(null)
  const [isInstalling, setIsInstalling] = useState(false)
  const [installProgress, setInstallProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check for updates when component mounts
    checkForUpdates()
  }, [])

  const checkForUpdates = async () => {
    try {
      // Prevent any default Tauri update dialogs by ensuring we handle updates ourselves
      // This is a safeguard in case the updater config isn't fully disabling the default dialog

      // Listen for any update-related events that might trigger dialogs
      const unlistenUpdate = await appWindow.listen('tauri://update-available', (_event: any) => {
        console.log('Intercepted update-available event, preventing default dialog')
        // Don't show the default dialog - our custom component handles this
      })

      const unlistenInstall = await appWindow.listen('tauri://update-install', (_event: any) => {
        console.log('Intercepted update-install event')
        // Don't show default install dialogs
      })

      const { shouldUpdate, manifest: updateManifest } = await checkUpdate()

      // Clean up listeners
      unlistenUpdate()
      unlistenInstall()

      if (shouldUpdate && updateManifest) {
        setManifest(updateManifest)
      }
    } catch (err) {
      console.error('Failed to check for updates:', err)
      setError('Failed to check for updates')
    }
  }

  const handleInstallUpdate = async () => {
    if (!manifest) return

    setIsInstalling(true)
    setError(null)

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setInstallProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 10
        })
      }, 500)

      await installUpdate()

      setInstallProgress(100)
      clearInterval(progressInterval)

      // App will restart automatically after install
    } catch (err: any) {
      setError(err.message || 'Failed to install update')
      setIsInstalling(false)
    }
  }

  if (!manifest && !error) {
    return null // Don't show anything if no update available
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-grey-900 border-2 border-grey-700 w-96 animate-fade-in shadow-xl">
        <div className="border-b-2 border-grey-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {error ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : (
                <Download className="w-5 h-5 text-green-400" />
              )}
              <h3 className="font-bold text-white text-lg">
                {error ? 'Update Error' : 'Update Available'}
              </h3>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 text-grey-400 hover:text-white transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {error ? (
            <div className="text-center">
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={checkForUpdates}
                className="px-4 py-2 bg-grey-800 text-white border-2 border-grey-700 hover:border-white transition-colors text-sm"
              >
                Try Again
              </button>
            </div>
          ) : manifest ? (
            <>
              <p className="text-grey-300 text-sm mb-3">
                A new version of CommHub is available:{' '}
                <strong className="text-white">v{manifest.version}</strong>
              </p>

              {manifest.body && (
                <div className="bg-grey-850 border border-grey-700 p-3 mb-4 max-h-32 overflow-y-auto">
                  <p className="text-grey-400 text-xs whitespace-pre-wrap">{manifest.body}</p>
                </div>
              )}

              {isInstalling ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin"></div>
                    <span className="text-white text-sm">Installing update...</span>
                  </div>
                  <div className="w-full bg-grey-800 border border-grey-700 h-2">
                    <div
                      className="bg-green-500 h-full transition-all duration-300"
                      style={{ width: `${installProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-grey-500 text-xs">
                    The app will restart automatically when complete.
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleInstallUpdate}
                    className="flex-1 px-4 py-2 bg-green-900 text-white border-2 border-green-700 hover:bg-green-800 hover:border-green-500 transition-colors font-bold text-sm"
                  >
                    Install Update
                  </button>
                  <button
                    onClick={onDismiss}
                    className="px-4 py-2 bg-grey-800 text-white border-2 border-grey-700 hover:border-white transition-colors text-sm"
                  >
                    Later
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default UpdateNotification
