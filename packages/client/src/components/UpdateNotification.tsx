import React, { useState, useEffect } from 'react'
import { Download, X, AlertCircle } from 'lucide-react'

// Define our own UpdateManifest interface since we're not using Tauri's
interface UpdateManifest {
  version: string
  date: string
  body: string
}

interface UpdateNotificationProps {
  onDismiss: () => void
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onDismiss }) => {
  const [manifest, setManifest] = useState<UpdateManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkComplete, setCheckComplete] = useState(false)

  useEffect(() => {
    // Check for updates when component mounts
    checkForUpdates()
  }, [])

  const checkForUpdates = async () => {
    try {
      // Fetch the latest.json file from the repository
      const response = await fetch(
        'https://raw.githubusercontent.com/AnthonyRandom/commhub/main/latest.json'
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch latest.json: ${response.status} ${response.statusText}`)
      }

      const latestData = await response.json()

      const latestVersion = latestData.version
      const currentVersion = '1.1.6' // This should match the version in package.json

      // Simple version comparison (assuming semantic versioning)
      const isLatest = compareVersions(currentVersion, latestVersion) >= 0

      if (isLatest) {
        // No update available - will show "no updates" message
      } else {
        // Create a mock manifest for display
        setManifest({
          version: latestVersion,
          date: latestData.pub_date,
          body: latestData.notes,
        })
      }

      setCheckComplete(true)
    } catch (err) {
      console.error('Failed to check for updates:', err)
      setError(
        `Failed to check for updates: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
      setCheckComplete(true)
    }
  }

  // Simple version comparison function
  const compareVersions = (version1: string, version2: string): number => {
    const parts1 = version1.split('.').map(Number)
    const parts2 = version2.split('.').map(Number)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0
      const part2 = parts2[i] || 0

      if (part1 > part2) return 1
      if (part1 < part2) return -1
    }

    return 0
  }

  const handleInstallUpdate = () => {
    if (!manifest) return

    // Open GitHub releases page for manual download
    window.open('https://github.com/AnthonyRandom/commhub/releases', '_blank')
    onDismiss() // Close the notification
  }

  // Show a loading state while checking for updates
  if (!checkComplete && !error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
        <div className="bg-grey-900 border-2 border-grey-700 w-96 animate-fade-in shadow-xl">
          <div className="border-b-2 border-grey-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin"></div>
                <h3 className="font-bold text-white text-lg">Checking for Updates...</h3>
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
            <p className="text-grey-300 text-sm">
              Please wait while we check for available updates.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show "no updates available" message when check is complete but no update found
  if (checkComplete && !manifest && !error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
        <div className="bg-grey-900 border-2 border-grey-700 w-96 animate-fade-in shadow-xl">
          <div className="border-b-2 border-grey-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-green-400" />
                <h3 className="font-bold text-white text-lg">No Updates Available</h3>
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
            <p className="text-grey-300 text-sm mb-4">
              You are running the latest version of CommHub (v1.1.6).
            </p>
            <p className="text-grey-400 text-xs mb-4">Check for new releases manually:</p>
            <a
              href="https://github.com/AnthonyRandom/commhub/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-blue-900 text-white border-2 border-blue-700 hover:bg-blue-800 hover:border-blue-500 transition-colors text-sm font-bold"
            >
              View Releases on GitHub
            </a>
            <button
              onClick={onDismiss}
              className="ml-2 px-4 py-2 bg-grey-800 text-white border-2 border-grey-700 hover:border-white transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
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

              <div className="flex gap-2">
                <button
                  onClick={handleInstallUpdate}
                  className="flex-1 px-4 py-2 bg-green-900 text-white border-2 border-green-700 hover:bg-green-800 hover:border-green-500 transition-colors font-bold text-sm"
                >
                  Download Update
                </button>
                <button
                  onClick={onDismiss}
                  className="px-4 py-2 bg-grey-800 text-white border-2 border-grey-700 hover:border-white transition-colors text-sm"
                >
                  Later
                </button>
              </div>
              <p className="text-grey-500 text-xs mt-2">
                Download the latest version from GitHub releases.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default UpdateNotification
