import React, { useEffect, useRef, useState } from 'react'
import { MicOff, VolumeX } from 'lucide-react'
import { useVoiceStore } from '../../stores/voice'
import { useAuthStore } from '../../stores/auth'
import { voiceManager } from '../../services/voice-manager'
import { RemoteParticipantVideo } from './RemoteParticipantVideo'

// CSS for speaking animation (subtle jump up and down)
const speakingAnimationStyle = `
  @keyframes speakingJump {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }
  .speaking-animation {
    animation: speakingJump 1.5s ease-in-out infinite;
  }
`

// Twitter Spaces-style voice participant grid with video support
export const VoiceChannelParticipants: React.FC = () => {
  const {
    connectedUsers,
    isMuted,
    isDeafened,
    isConnecting,
    localVideoEnabled,
    localVideoStream,
    localScreenShareEnabled,
    localScreenShareStream,
    focusedStreamUserId,
  } = useVoiceStore()
  const { user } = useAuthStore()
  const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  // Inject speaking animation CSS
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = speakingAnimationStyle
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Set local video/screen share stream
  useEffect(() => {
    if (localVideoRef.current) {
      // Screen share takes priority over camera
      if (localScreenShareStream && localScreenShareEnabled) {
        localVideoRef.current.srcObject = localScreenShareStream
      } else if (localVideoStream && localVideoEnabled) {
        localVideoRef.current.srcObject = localVideoStream
      } else {
        // Clear video source when both are disabled
        localVideoRef.current.srcObject = null
      }
    }
  }, [localVideoStream, localVideoEnabled, localScreenShareStream, localScreenShareEnabled])

  if (isConnecting) {
    return (
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 border-4 border-white border-t-transparent animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg font-bold">Connecting to voice...</p>
        <p className="text-grey-400 text-sm mt-2">Requesting microphone access...</p>
      </div>
    )
  }

  const connectedUsersArray = Array.from(connectedUsers.values()).filter(
    (voiceUser) => voiceUser.userId !== user?.id
  )
  const currentUserVoiceState = user ? connectedUsers.get(user.id) : null
  const currentUser = {
    userId: user?.id || 0,
    username: user?.username || 'You',
    isSpeaking: currentUserVoiceState?.isSpeaking || false,
    isMuted,
    isDeafened,
  }

  const handleUserLocalMute = (userId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const targetUser = connectedUsers.get(userId)
    if (targetUser) {
      voiceManager.setUserLocalMuted(userId, !targetUser.localMuted)
    }
  }

  const handleUserVolumeChange = (userId: number, volume: number) => {
    voiceManager.setUserVolume(userId, volume)
  }

  const handleStreamClick = (userId: number) => {
    // Toggle focused stream
    if (focusedStreamUserId === userId) {
      useVoiceStore.getState().setFocusedStreamUserId(null)
    } else {
      useVoiceStore.getState().setFocusedStreamUserId(userId)
    }
    setShowVolumeSlider(null)
  }

  const toggleVolumeSlider = (userId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setShowVolumeSlider(showVolumeSlider === userId ? null : userId)
  }

  // Dynamic grid size based on number of users
  const totalUsers = connectedUsersArray.length + 1
  const gridCols = Math.min(Math.ceil(Math.sqrt(totalUsers)), 5)

  return (
    <div className="w-full max-w-6xl">
      {/* Grid of participants - centered layout */}
      <div
        className="grid gap-5 justify-items-center items-start"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, max-content))`,
          justifyContent: 'center',
        }}
      >
        {/* Current User - always first/centered */}
        <div
          key={currentUser.userId}
          className="flex flex-col items-center gap-3 animate-slide-up"
          style={{
            gridColumn: connectedUsersArray.length === 0 ? '1 / -1' : 'auto',
            justifySelf: connectedUsersArray.length === 0 ? 'center' : 'auto',
          }}
        >
          {/* Avatar or Video/Screen Share */}
          <div
            className="relative cursor-pointer"
            onClick={() => {
              if (user && (localVideoEnabled || localScreenShareEnabled)) {
                handleStreamClick(user.id)
              }
            }}
          >
            {(localVideoEnabled || localScreenShareEnabled) &&
            (localVideoStream || localScreenShareStream) ? (
              <div
                className={`transition-all duration-300 border-4 overflow-hidden ${
                  currentUser.isSpeaking ? 'border-white' : 'border-grey-800'
                }`}
                style={{ width: '256px', aspectRatio: '16/9' }}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={localScreenShareEnabled ? {} : { transform: 'scaleX(-1)' }}
                />
              </div>
            ) : (
              <div
                className={`w-32 h-32 flex items-center justify-center transition-all duration-300 border-4 ${
                  currentUser.isSpeaking ? 'bg-white border-white' : 'bg-white border-grey-800'
                }`}
              >
                <span className="font-bold text-3xl text-black">
                  {currentUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Status badges */}
            {(currentUser.isMuted || currentUser.isDeafened) && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 animate-slide-up">
                {currentUser.isMuted && (
                  <div className="bg-red-900 border-2 border-grey-900 p-1.5">
                    <MicOff className="w-4 h-4 text-white" />
                  </div>
                )}
                {currentUser.isDeafened && (
                  <div className="bg-red-900 border-2 border-grey-900 p-1.5">
                    <VolumeX className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Username */}
          <div className="text-center">
            <p className="text-white font-bold text-base">{currentUser.username}</p>
          </div>
        </div>

        {/* Other Users */}
        {connectedUsersArray.map((participant, index) => {
          const voiceUser = connectedUsers.get(participant.userId)
          const hasVideo = voiceUser?.hasVideo || false
          const hasScreenShare = voiceUser?.hasScreenShare || false

          // Determine which stream to display
          let displayStream: MediaStream | undefined
          if (hasScreenShare) {
            // Show screen share stream
            displayStream = voiceUser?.screenShareStream || voiceUser?.stream
          } else if (hasVideo) {
            // Show camera stream
            displayStream = voiceUser?.videoStream || voiceUser?.stream
          } else {
            // No video or screen share - don't pass a stream
            displayStream = undefined
          }

          return (
            <RemoteParticipantVideo
              key={participant.userId}
              participant={participant}
              voiceUser={voiceUser}
              hasVideo={hasVideo}
              hasScreenShare={hasScreenShare}
              videoStream={displayStream}
              index={index}
              onUserClick={() => handleStreamClick(participant.userId)}
              onUserLocalMute={(e) => handleUserLocalMute(participant.userId, e)}
              onToggleVolumeSlider={(e) => toggleVolumeSlider(participant.userId, e)}
              showVolumeSlider={showVolumeSlider === participant.userId}
              onUserVolumeChange={(vol) => handleUserVolumeChange(participant.userId, vol)}
            />
          )
        })}
      </div>
    </div>
  )
}
