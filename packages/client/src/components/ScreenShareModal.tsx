import React, { useState } from 'react'
import { Monitor, Check } from 'lucide-react'

interface ScreenShareModalProps {
  isOpen: boolean
  onClose: () => void
  onStartScreenShare: (captureAudio: boolean) => Promise<void>
}

const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  isOpen,
  onClose,
  onStartScreenShare,
}) => {
  const [captureAudio, setCaptureAudio] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartScreenShare = async () => {
    setIsStarting(true)
    setError(null)

    try {
      await onStartScreenShare(captureAudio)
      onClose()
    } catch (err) {
      console.error('Failed to start screen share:', err)
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Screen sharing access denied. Please allow screen sharing permissions.')
        } else if (err.name === 'NotFoundError') {
          setError('No screen found to share.')
        } else {
          setError('Failed to start screen sharing.')
        }
      } else {
        setError('Failed to start screen sharing.')
      }
    } finally {
      setIsStarting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-grey-900 border-2 border-white w-[500px] max-h-[80vh] flex flex-col animate-slide-up">
        <div className="border-b-2 border-grey-800 p-4 flex items-center justify-between">
          <h3 className="font-bold text-white text-lg uppercase tracking-wider">
            Screen Share Settings
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-grey-400 hover:text-white transition-colors"
            disabled={isStarting}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-grey-950 border-2 border-grey-700 p-6 flex flex-col items-center justify-center">
            <Monitor className="w-16 h-16 text-grey-600 mb-4" />
            <p className="text-grey-300 text-center">
              Your browser will prompt you to select a screen or window to share
            </p>
          </div>

          {error && (
            <div className="bg-red-900 border-2 border-red-700 p-4 animate-slide-down">
              <p className="text-white text-sm">{error}</p>
            </div>
          )}

          <div className="bg-grey-850 border-2 border-grey-700 p-4">
            <label className="flex items-center cursor-pointer">
              <div
                className={`w-5 h-5 border-2 flex items-center justify-center transition-all ${
                  captureAudio
                    ? 'bg-white border-white'
                    : 'bg-grey-900 border-grey-700 hover:border-grey-600'
                }`}
                onClick={() => setCaptureAudio(!captureAudio)}
              >
                {captureAudio && <Check className="w-3 h-3 text-black" />}
              </div>
              <span className="ml-3 text-white font-bold">Capture Desktop Audio</span>
            </label>
            <p className="text-grey-400 text-sm mt-2 ml-8">
              Share audio from your computer along with your screen
            </p>
          </div>

          <div className="bg-grey-850 border-2 border-grey-700 p-4">
            <p className="text-grey-300 text-sm">
              <span className="font-bold">Note:</span> Screen sharing will replace your webcam
              stream if it's currently active. You can toggle between camera and screen share.
            </p>
          </div>
        </div>

        <div className="border-t-2 border-grey-800 p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors font-bold"
            disabled={isStarting}
          >
            Cancel
          </button>
          <button
            onClick={handleStartScreenShare}
            className="px-4 py-2 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-bold flex items-center gap-2"
            disabled={isStarting}
          >
            {isStarting ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin"></div>
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Monitor className="w-4 h-4" />
                <span>Start Screen Share</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ScreenShareModal
