import React from 'react'
import { Mic, MicOff, Headphones, VolumeX, PhoneOff } from 'lucide-react'
import { useVoiceStore } from '../stores/voice'
import { voiceManager } from '../services/voice-manager'
import { soundManager } from '../services/sound-manager'
import type { Channel } from '../services/api'

interface VoiceControlsProps {
  channel: Channel
}

const VoiceControls: React.FC<VoiceControlsProps> = ({ channel }) => {
  const { connectedChannelId, isMuted, isDeafened, isConnecting, connectionError } = useVoiceStore()

  const isConnected = connectedChannelId === channel.id

  const handleToggleMute = () => {
    voiceManager.toggleMute()
    soundManager.playMuteToggle()
  }

  const handleToggleDeafen = () => {
    voiceManager.toggleDeafen()
    soundManager.playDeafenToggle()
  }

  const handleDisconnect = () => {
    voiceManager.leaveVoiceChannel()
  }

  if (!isConnected && !isConnecting) {
    return null
  }

  return (
    <div className="border-t-2 border-grey-800 bg-grey-950 animate-slide-down">
      {/* Connection Status */}
      {isConnecting && (
        <div className="p-2 bg-grey-900 border-b-2 border-grey-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin"></div>
            <span className="text-grey-300 text-xs">Connecting...</span>
          </div>
        </div>
      )}

      {connectionError && (
        <div className="p-2 bg-red-900 border-b-2 border-red-700">
          <p className="text-white text-xs">{connectionError}</p>
        </div>
      )}

      <div className="p-3">
        {/* Voice Controls */}
        <div className="flex gap-2">
          <button
            onClick={handleToggleMute}
            className={`flex-1 p-2.5 border-2 font-bold text-xs transition-all duration-100 ${
              isMuted
                ? 'bg-red-900 border-red-700 text-white hover:bg-red-800'
                : 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <div className="flex items-center justify-center gap-1.5">
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'Muted' : 'Mute'}</span>
            </div>
          </button>

          <button
            onClick={handleToggleDeafen}
            className={`flex-1 p-2.5 border-2 font-bold text-xs transition-all duration-100 ${
              isDeafened
                ? 'bg-red-900 border-red-700 text-white hover:bg-red-800'
                : 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            <div className="flex items-center justify-center gap-1.5">
              {isDeafened ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Headphones className="w-3.5 h-3.5" />
              )}
              <span>{isDeafened ? 'Deafened' : 'Deafen'}</span>
            </div>
          </button>

          <button
            onClick={handleDisconnect}
            className="p-2.5 bg-red-900 border-2 border-red-700 text-white hover:bg-red-800 hover:border-red-500 transition-all duration-100"
            title="Disconnect"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default VoiceControls
