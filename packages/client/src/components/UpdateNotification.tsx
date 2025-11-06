import React, { useState, useEffect } from 'react'
import { Download, X, AlertCircle, CheckCircle } from 'lucide-react'
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'
import { relaunch } from '@tauri-apps/api/process'
import type { UpdateManifest } from '@tauri-apps/api/updater'

interface UpdateNotificationProps {
  onDismiss: () => void
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onDismiss }) => {
  const [manifest, setManifest] = useState<UpdateManifest | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<
    'checking' | 'available' | 'downloading' | 'ready' | 'error'
  >('checking')

  useEffect(() => {
    // Check for updates when component mounts
    checkForUpdates()
  }, [])

  // Note: Detailed progress tracking via onUpdaterEvent is complex in Tauri
  // The basic checkUpdate/installUpdate flow works reliably

  const checkForUpdates = async () => {
    try {
      setUpdateStatus('checking')
      setError(null)
      const { shouldUpdate, manifest: updateManifest } = await checkUpdate()
      if (shouldUpdate && updateManifest) {
        setManifest(updateManifest)
        setUpdateStatus('available')
      } else {
        setUpdateStatus('available') // No update available, component will hide
      }
    } catch (err) {
      console.error('Failed to check for updates:', err)
      setError('Failed to check for updates')
      setUpdateStatus('error')
    }
  }

  const handleInstallUpdate = async () => {
    if (!manifest) return

    setUpdateStatus('downloading')
    setError(null)

    try {
      // Simulate download progress for better UX
      const progressInterval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 15
        })
      }, 300)

      await installUpdate()

      clearInterval(progressInterval)
      setDownloadProgress(100)
      setUpdateStatus('ready')
    } catch (err: any) {
      setError(err.message || 'Failed to download update')
      setUpdateStatus('error')
    }
  }

  const handleRestart = async () => {
    try {
      await relaunch()
    } catch (err) {
      console.error('Failed to restart app:', err)
    }
  }

  // Don't show if no update available and not checking
  if (!manifest && !error && updateStatus !== 'checking') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-grey-900 border-2 border-grey-700 w-96 animate-fade-in shadow-xl">
        <div className="border-b-2 border-grey-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {error ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : updateStatus === 'ready' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <Download className="w-5 h-5 text-green-400" />
              )}
              <h3 className="font-bold text-white text-lg">
                {error
                  ? 'Update Error'
                  : updateStatus === 'ready'
                    ? 'Update Ready'
                    : updateStatus === 'downloading'
                      ? 'Downloading Update'
                      : 'Update Available'}
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
          ) : updateStatus === 'ready' ? (
            <div className="text-center space-y-4">
              <p className="text-grey-300 text-sm">
                Update downloaded successfully! Restart CommHub to apply the changes.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRestart}
                  className="flex-1 px-4 py-2 bg-green-900 text-white border-2 border-green-700 hover:bg-green-800 hover:border-green-500 transition-colors font-bold text-sm"
                >
                  Restart Now
                </button>
                <button
                  onClick={onDismiss}
                  className="px-4 py-2 bg-grey-800 text-white border-2 border-grey-700 hover:border-white transition-colors text-sm"
                >
                  Later
                </button>
              </div>
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

              {updateStatus === 'downloading' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin"></div>
                    <span className="text-white text-sm">Downloading and installing update...</span>
                  </div>
                  <div className="w-full bg-grey-800 border border-grey-700 h-2">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-grey-500 text-xs">
                    {Math.round(downloadProgress)}% complete - The app will restart automatically
                    when done.
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleInstallUpdate}
                    className="flex-1 px-4 py-2 bg-green-900 text-white border-2 border-green-700 hover:bg-green-800 hover:border-green-500 transition-colors font-bold text-sm"
                  >
                    Download & Install
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
          ) : updateStatus === 'checking' ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin"></div>
                <span className="text-white text-sm">Checking for updates...</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default UpdateNotification
