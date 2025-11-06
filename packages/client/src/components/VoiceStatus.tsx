import React from 'react'
import { PhoneOff, AlertTriangle } from 'lucide-react'
import { useVoiceStore } from '../stores/voice'
import { voiceManager } from '../services/voice-manager'
import type { Channel } from '../services/api'

interface VoiceStatusProps {
  currentVoiceChannel: Channel | null
}

// Custom Wifi Quality Icon Component
const WifiQualityIcon: React.FC<{ quality: string }> = ({ quality }) => {
  const getWifiBars = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return (
          <svg
            className="w-4 h-4 text-green-400"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label="Excellent connection"
          >
            <path d="M12 2C7.58 2 4 5.58 4 10c0 5.06 3.94 9.14 9 9.9V19c-3.87-.4-7-3.7-7-7.9 0-4.42 3.58-8 8-8s8 3.58 8 8c0 4.2-3.13 7.5-7 7.9v2.9c5.06-.76 9-4.84 9-9.9C20 5.58 16.42 2 12 2z" />
            <path d="M12 6c-2.76 0-5 2.24-5 5 0 2.22 1.42 4.1 3.5 4.8V15c-1.38-.49-2.5-1.9-2.5-3.5 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.6-1.12 3.01-2.5 3.5v1.3c2.08-.7 3.5-2.58 3.5-4.8 0-2.76-2.24-5-5-5z" />
            <circle cx="12" cy="14" r="1.5" />
          </svg>
        )
      case 'good':
        return (
          <svg
            className="w-4 h-4 text-blue-400"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label="Good connection"
          >
            <path d="M12 2C7.58 2 4 5.58 4 10c0 5.06 3.94 9.14 9 9.9V19c-3.87-.4-7-3.7-7-7.9 0-4.42 3.58-8 8-8s8 3.58 8 8c0 4.2-3.13 7.5-7 7.9v2.9c5.06-.76 9-4.84 9-9.9C20 5.58 16.42 2 12 2z" />
            <circle cx="12" cy="14" r="1.5" />
          </svg>
        )
      case 'poor':
        return (
          <svg
            className="w-4 h-4 text-yellow-400"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label="Poor connection"
          >
            <path d="M12 2C7.58 2 4 5.58 4 10c0 5.06 3.94 9.14 9 9.9V19c-3.87-.4-7-3.7-7-7.9 0-4.42 3.58-8 8-8s8 3.58 8 8c0 4.2-3.13 7.5-7 7.9v2.9c5.06-.76 9-4.84 9-9.9C20 5.58 16.42 2 12 2z" />
          </svg>
        )
      case 'critical':
        return (
          <svg
            className="w-4 h-4 text-red-400"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label="Critical connection"
          >
            <path d="M12 2C7.58 2 4 5.58 4 10c0 5.06 3.94 9.14 9 9.9V19c-3.87-.4-7-3.7-7-7.9 0-4.42 3.58-8 8-8s8 3.58 8 8c0 4.2-3.13 7.5-7 7.9v2.9c5.06-.76 9-4.84 9-9.9C20 5.58 16.42 2 12 2z" />
          </svg>
        )
      case 'connecting':
        return (
          <svg
            className="w-4 h-4 text-grey-500 animate-pulse"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label="Connecting"
          >
            <path d="M12 2C7.58 2 4 5.58 4 10c0 5.06 3.94 9.14 9 9.9V19c-3.87-.4-7-3.7-7-7.9 0-4.42 3.58-8 8-8s8 3.58 8 8c0 4.2-3.13 7.5-7 7.9v2.9c5.06-.76 9-4.84 9-9.9C20 5.58 16.42 2 12 2z" />
          </svg>
        )
      default:
        return (
          <svg
            className="w-4 h-4 text-grey-400 opacity-50"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label="Unknown connection"
          >
            <path d="M12 2C7.58 2 4 5.58 4 10c0 5.06 3.94 9.14 9 9.9V19c-3.87-.4-7-3.7-7-7.9 0-4.42 3.58-8 8-8s8 3.58 8 8c0 4.2-3.13 7.5-7 7.9v2.9c5.06-.76 9-4.84 9-9.9C20 5.58 16.42 2 12 2z" />
          </svg>
        )
    }
  }

  return getWifiBars(quality)
}

const VoiceStatus: React.FC<VoiceStatusProps> = ({ currentVoiceChannel }) => {
  const { overallQuality, qualityWarnings } = useVoiceStore()

  if (!currentVoiceChannel || !currentVoiceChannel.name) {
    return null
  }

  const handleDisconnect = async () => {
    try {
      await voiceManager.leaveVoiceChannel()
    } catch (error) {
      console.error('Failed to disconnect from voice channel:', error)
      // Could show a toast notification here if desired
    }
  }

  return (
    <div className="border-t-2 border-grey-800 bg-grey-950">
      {/* Compact Voice Status */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left side - Quality Icon and Channel */}
          <div className="flex items-center gap-3 min-w-0 flex-1 max-w-[calc(100%-3rem)]">
            <WifiQualityIcon quality={overallQuality} />

            <div className="min-w-0 flex-1">
              <p
                className="text-white font-medium text-sm truncate max-w-full"
                title={currentVoiceChannel.name}
              >
                {currentVoiceChannel.name}
              </p>
            </div>
          </div>

          {/* Right side - Disconnect button */}
          <button
            onClick={handleDisconnect}
            className="p-1.5 text-grey-400 hover:text-red-400 hover:bg-grey-800 transition-colors border border-transparent hover:border-red-700 rounded flex-shrink-0"
            title="Disconnect from voice"
            aria-label="Disconnect from voice channel"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quality Warnings - Only show if critical issues */}
        {qualityWarnings.length > 0 && overallQuality === 'critical' && (
          <div className="mt-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
            <span className="text-yellow-300 text-xs truncate" title={qualityWarnings[0]}>
              {qualityWarnings[0]}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default VoiceStatus
