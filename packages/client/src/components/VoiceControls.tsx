import React from 'react'
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  PhoneOff,
  Volume2,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useVoiceStore } from '../stores/voice'
import { voiceManager } from '../services/voice-manager'
import type { Channel } from '../services/api'
import type { ConnectionStatus } from '../stores/voice'

const ConnectionStatusIndicator: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  switch (status) {
    case 'connecting':
      return (
        <span title="Connecting...">
          <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
        </span>
      )
    case 'connected':
      return (
        <span title="Connected">
          <CheckCircle2 className="w-3 h-3 text-green-400" />
        </span>
      )
    case 'failed':
      return (
        <span title="Connection Failed">
          <XCircle className="w-3 h-3 text-red-400" />
        </span>
      )
    case 'disconnected':
      return (
        <span title="Disconnected">
          <XCircle className="w-3 h-3 text-grey-400" />
        </span>
      )
    default:
      return null
  }
}

interface VoiceControlsProps {
  channel: Channel
}

const VoiceControls: React.FC<VoiceControlsProps> = ({ channel }) => {
  const { connectedChannelId, isMuted, isDeafened, connectedUsers, isConnecting, connectionError } =
    useVoiceStore()

  const isConnected = connectedChannelId === channel.id

  const handleToggleMute = () => {
    voiceManager.toggleMute()
  }

  const handleToggleDeafen = () => {
    voiceManager.toggleDeafen()
  }

  const handleDisconnect = () => {
    voiceManager.leaveVoiceChannel()
  }

  if (!isConnected && !isConnecting) {
    return null
  }

  const connectedUsersArray = Array.from(connectedUsers.values())

  return (
    <div className="border-t-2 border-grey-800 bg-grey-950 p-4 animate-slide-down">
      {/* Channel Info */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 bg-white flex items-center justify-center">
          <Volume2 className="w-5 h-5 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-sm">Voice Connected</h3>
          <p className="text-grey-400 text-xs truncate">{channel.name}</p>
        </div>
      </div>

      {/* Connection Status */}
      {isConnecting && (
        <div className="mb-3 p-2 bg-grey-900 border-2 border-grey-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin"></div>
            <span className="text-grey-300 text-sm">Connecting...</span>
          </div>
        </div>
      )}

      {connectionError && (
        <div className="mb-3 p-2 bg-red-900 border-2 border-red-700">
          <p className="text-white text-sm">{connectionError}</p>
        </div>
      )}

      {/* Connected Users */}
      {connectedUsersArray.length > 0 && (
        <div className="mb-3">
          <h4 className="text-grey-400 text-xs font-bold uppercase tracking-wider mb-2">
            In Channel ({connectedUsersArray.length + 1})
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {/* Current User */}
            <div className="flex items-center gap-2 px-2 py-1 bg-grey-900">
              <div className="w-6 h-6 bg-white flex items-center justify-center flex-shrink-0">
                <span className="text-black font-bold text-xs">You</span>
              </div>
              <span className="text-white text-sm font-medium flex-1 truncate">You</span>
              {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
              {isDeafened && <VolumeX className="w-3 h-3 text-red-400" />}
            </div>

            {/* Other Users */}
            {connectedUsersArray.map((user) => (
              <div
                key={user.userId}
                className={`flex items-center gap-2 px-2 py-1 transition-colors ${
                  user.isSpeaking ? 'bg-grey-800' : 'bg-grey-900'
                }`}
              >
                <div
                  className={`w-6 h-6 flex items-center justify-center flex-shrink-0 transition-colors ${
                    user.isSpeaking ? 'bg-white' : 'bg-grey-700'
                  }`}
                >
                  <span
                    className={`font-bold text-xs ${
                      user.isSpeaking ? 'text-black' : 'text-grey-300'
                    }`}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-grey-200 text-sm flex-1 truncate">{user.username}</span>
                <div className="flex items-center gap-1">
                  <ConnectionStatusIndicator status={user.connectionStatus} />
                  {user.isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleToggleMute}
          className={`flex-1 p-3 border-2 font-bold text-sm transition-all duration-100 ${
            isMuted
              ? 'bg-red-900 border-red-700 text-white hover:bg-red-800'
              : 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <div className="flex items-center justify-center gap-2">
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isMuted ? 'Muted' : 'Mute'}</span>
          </div>
        </button>

        <button
          onClick={handleToggleDeafen}
          className={`flex-1 p-3 border-2 font-bold text-sm transition-all duration-100 ${
            isDeafened
              ? 'bg-red-900 border-red-700 text-white hover:bg-red-800'
              : 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
          }`}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
        >
          <div className="flex items-center justify-center gap-2">
            {isDeafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
            <span>{isDeafened ? 'Deafened' : 'Deafen'}</span>
          </div>
        </button>

        <button
          onClick={handleDisconnect}
          className="p-3 bg-red-900 border-2 border-red-700 text-white hover:bg-red-800 hover:border-red-500 transition-all duration-100"
          title="Disconnect"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>

      {/* Info Text */}
      <p className="text-grey-600 text-xs mt-3 text-center">
        Press buttons to control audio • Click phone to disconnect
      </p>
    </div>
  )
}

export default VoiceControls
