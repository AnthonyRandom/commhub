import React, { useEffect, useRef } from 'react'
import { MicOff, VolumeX, Volume2, Volume1 } from 'lucide-react'

interface RemoteParticipantVideoProps {
  participant: any
  voiceUser: any
  hasVideo: boolean
  hasScreenShare: boolean
  videoStream: MediaStream | undefined
  index: number
  onUserClick: () => void
  onUserLocalMute: (e: React.MouseEvent) => void
  onToggleVolumeSlider: (e: React.MouseEvent) => void
  showVolumeSlider: boolean
  onUserVolumeChange: (volume: number) => void
}

// Remote participant component with video support
export const RemoteParticipantVideo: React.FC<RemoteParticipantVideoProps> = ({
  participant,
  voiceUser,
  hasVideo,
  hasScreenShare,
  videoStream,
  index,
  onUserClick,
  onUserLocalMute,
  onToggleVolumeSlider,
  showVolumeSlider,
  onUserVolumeChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showContextMenu, setShowContextMenu] = React.useState(false)

  // Set video stream on remote video element
  useEffect(() => {
    if (videoRef.current) {
      if (videoStream && (hasVideo || hasScreenShare)) {
        videoRef.current.srcObject = videoStream
      } else {
        // Clear video source when both are disabled
        videoRef.current.srcObject = null
      }
    }
  }, [videoStream, hasVideo, hasScreenShare])

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowContextMenu(!showContextMenu)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only call onUserClick if clicking on video/avatar, not on controls
    if (!(e.target as HTMLElement).closest('.controls-panel')) {
      onUserClick()
      setShowContextMenu(false)
    }
  }

  return (
    <div
      className="flex flex-col items-center gap-3 relative cursor-pointer animate-slide-up"
      style={{
        animationDelay: `${index * 50}ms`,
      }}
      onClick={handleClick}
      onContextMenu={handleRightClick}
    >
      {/* Avatar or Video/Screen Share */}
      <div className="relative">
        {(hasVideo || hasScreenShare) && videoStream ? (
          <div
            className={`transition-all duration-300 border-4 overflow-hidden ${
              participant.isSpeaking ? 'border-white' : 'border-grey-800'
            }`}
            style={{ width: '256px', aspectRatio: '16/9' }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={hasScreenShare ? {} : {}}
            />
          </div>
        ) : (
          <div
            className={`w-32 h-32 flex items-center justify-center transition-all duration-300 border-4 ${
              participant.isSpeaking
                ? 'bg-white border-white'
                : 'bg-grey-800 border-grey-800 hover:bg-grey-750'
            }`}
          >
            <span
              className={`font-bold text-3xl transition-colors ${
                participant.isSpeaking ? 'text-black' : 'text-grey-300'
              }`}
            >
              {participant.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Status badges */}
        {(participant.isMuted || voiceUser?.localMuted) && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 animate-slide-up">
            {participant.isMuted && (
              <div className="bg-red-900 border-2 border-grey-900 p-1.5">
                <MicOff className="w-4 h-4 text-white" />
              </div>
            )}
            {voiceUser?.localMuted && (
              <div className="bg-grey-700 border-2 border-grey-900 p-1.5">
                <VolumeX className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Username */}
      <div className="text-center">
        <p className="text-white font-bold text-sm">{participant.username}</p>
      </div>

      {/* Controls panel - shown on right-click */}
      {showContextMenu && voiceUser && (
        <div className="absolute top-full mt-4 z-50 animate-slide-up controls-panel">
          <div className="bg-grey-950 border-2 border-grey-700 p-4 min-w-[240px] shadow-xl">
            <div className="flex gap-2 mb-3">
              <button
                onClick={(e) => {
                  onUserLocalMute(e)
                  setShowContextMenu(false)
                }}
                className={`flex-1 p-3 border-2 transition-all duration-100 text-sm font-bold ${
                  voiceUser.localMuted
                    ? 'bg-red-900 border-red-700 text-white hover:bg-red-800'
                    : 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {voiceUser.localMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span>{voiceUser.localMuted ? 'Unmute' : 'Mute'}</span>
                </div>
              </button>
              <button
                onClick={onToggleVolumeSlider}
                className="p-3 border-2 bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white transition-all duration-100"
              >
                <Volume1 className="w-4 h-4" />
              </button>
            </div>
            {showVolumeSlider && (
              <div className="pt-3 border-t border-grey-800 animate-slide-down">
                <div className="flex items-center gap-3">
                  <Volume1 className="w-4 h-4 text-grey-400" />
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="5"
                    value={Math.min(200, Math.max(0, Math.round(voiceUser.localVolume * 100)))}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value)
                      onUserVolumeChange(Math.min(2.0, Math.max(0, newValue / 100)))
                    }}
                    className="flex-1 h-1 bg-grey-700 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm text-white font-mono w-12 text-right">
                    {Math.min(200, Math.max(0, Math.round(voiceUser.localVolume * 100)))}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
