import React, { useEffect, useRef, useState } from 'react'
import { MicOff, VolumeX, Volume2, Volume1, X } from 'lucide-react'
import { voiceManager } from '../../services/voice-manager'
import type { VoiceUser } from '../../stores/voice'

interface FocusedStreamViewProps {
  user: VoiceUser
  stream: MediaStream | undefined
  isScreenShare: boolean
  onClose: () => void
}

export const FocusedStreamView: React.FC<FocusedStreamViewProps> = ({
  user,
  stream,
  isScreenShare,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)

  // Set video stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
    setShowVolumeSlider(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Close context menu on left click
    if (showContextMenu) {
      setShowContextMenu(false)
      return
    }

    // Check if click is on the video itself (not on UI elements)
    if (e.target === videoRef.current || (e.target as HTMLElement).closest('.video-container')) {
      onClose()
    }
  }

  const handleUserLocalMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    voiceManager.setUserLocalMuted(user.userId, !user.localMuted)
    setShowContextMenu(false)
  }

  const handleToggleVolumeSlider = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowVolumeSlider(!showVolumeSlider)
  }

  const handleVolumeChange = (volume: number) => {
    voiceManager.setUserVolume(user.userId, volume)
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showContextMenu) {
        setShowContextMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showContextMenu])

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center z-40 animate-fade-in"
      onClick={handleClick}
      onContextMenu={handleRightClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 bg-grey-900 border-2 border-grey-700 text-white hover:border-white transition-all"
        title="Close focused view"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Video stream */}
      <div className="w-full h-full flex items-center justify-center video-container">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-32 h-32 bg-grey-800 border-4 border-grey-700 flex items-center justify-center mb-4">
              <span className="font-bold text-4xl text-grey-300">
                {user.username?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <p className="text-grey-400">No stream available</p>
          </div>
        )}
      </div>

      {/* User info overlay */}
      <div className="absolute bottom-4 left-4 bg-grey-900/90 border-2 border-grey-700 px-4 py-2 flex items-center gap-3">
        <span className="text-white font-bold">{user.username || 'Unknown User'}</span>
        {isScreenShare && (
          <span className="text-xs bg-grey-800 border border-grey-700 px-2 py-1 text-grey-300">
            SCREEN SHARING
          </span>
        )}
        {user.isMuted && (
          <div className="bg-red-900 border border-red-700 p-1">
            <MicOff className="w-3 h-3 text-white" />
          </div>
        )}
        {user.localMuted && (
          <div className="bg-grey-700 border border-grey-600 p-1">
            <VolumeX className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Connection quality indicator */}
      {user.connectionQuality && (
        <div className="absolute top-4 left-4 bg-grey-900/90 border-2 border-grey-700 px-3 py-1">
          <span
            className={`text-xs font-bold ${
              user.connectionQuality === 'excellent'
                ? 'text-green-400'
                : user.connectionQuality === 'good'
                  ? 'text-yellow-400'
                  : user.connectionQuality === 'poor'
                    ? 'text-orange-400'
                    : 'text-red-400'
            }`}
          >
            {user.connectionQuality.toUpperCase()}
          </span>
        </div>
      )}

      {/* Right-click context menu */}
      {showContextMenu && (
        <div
          className="fixed bg-grey-900 border-2 border-grey-700 z-50 min-w-[200px] animate-fade-in"
          style={{ top: contextMenuPosition.y, left: contextMenuPosition.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleUserLocalMute}
            className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors border-b border-grey-800"
          >
            {user.localMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{user.localMuted ? 'Unmute' : 'Mute'}</span>
          </button>
          <button
            onClick={handleToggleVolumeSlider}
            className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors"
          >
            <Volume1 className="w-4 h-4" />
            <span>Volume</span>
          </button>
          {showVolumeSlider && (
            <div className="px-4 py-3 border-t border-grey-800">
              <div className="flex items-center gap-3">
                <Volume1 className="w-4 h-4 text-grey-400" />
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="5"
                  value={Math.min(200, Math.max(0, Math.round(user.localVolume * 100)))}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value)
                    handleVolumeChange(Math.min(2.0, Math.max(0, newValue / 100)))
                  }}
                  className="flex-1 h-1 bg-grey-700 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm text-white font-mono w-12 text-right">
                  {Math.min(200, Math.max(0, Math.round(user.localVolume * 100)))}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 text-grey-500 text-sm">
        Click to exit • Right-click for controls
      </div>
    </div>
  )
}
