import React, { useState } from 'react'
import { X, Download, CheckCircle, AlertCircle } from 'lucide-react'
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'
import { relaunch } from '@tauri-apps/api/process'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{
    type: 'idle' | 'checking' | 'available' | 'current' | 'error' | 'downloading'
    message: string
    version?: string
  }>({ type: 'idle', message: '' })

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true)
    setUpdateStatus({ type: 'checking', message: 'Checking for updates...' })

    try {
      const { shouldUpdate, manifest } = await checkUpdate()

      if (shouldUpdate && manifest) {
        setUpdateStatus({
          type: 'available',
          message: `Update available: v${manifest.version}`,
          version: manifest.version,
        })
      } else {
        setUpdateStatus({
          type: 'current',
          message: 'You are on the latest version',
        })
      }
    } catch (error: any) {
      setUpdateStatus({
        type: 'error',
        message: error.message || 'Failed to check for updates',
      })
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const handleInstallUpdate = async () => {
    setUpdateStatus({ type: 'downloading', message: 'Downloading update...' })

    try {
      await installUpdate()
      setUpdateStatus({
        type: 'current',
        message: 'Update installed! Restarting...',
      })
      // Relaunch the app to apply the update
      setTimeout(() => relaunch(), 2000)
    } catch (error: any) {
      setUpdateStatus({
        type: 'error',
        message: error.message || 'Failed to install update',
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
          {/* App Info Section */}
          <div>
            <h4 className="text-xs font-bold text-grey-400 uppercase tracking-wider mb-3">
              Application
            </h4>
            <div className="bg-grey-850 border-2 border-grey-700 p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-grey-400 text-sm">Version</span>
                  <span className="text-white text-sm font-mono">1.0.1</span>
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
