import React, { useState } from 'react'
import { X, Hash, Volume2 } from 'lucide-react'
import { useChannelsStore } from '../stores/channels'

interface ChannelModalProps {
  isOpen: boolean
  serverId: number | null
  onClose: () => void
}

const ChannelModal: React.FC<ChannelModalProps> = ({ isOpen, serverId, onClose }) => {
  const [channelName, setChannelName] = useState('')
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const createChannel = useChannelsStore((state) => state.createChannel)

  const handleClose = () => {
    setChannelName('')
    setChannelType('text')
    setError(null)
    setIsLoading(false)
    onClose()
  }

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!serverId) {
      setError('No server selected')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      await createChannel(channelName, channelType, serverId)
      handleClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create channel')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-grey-900 border-2 border-white w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="border-b-2 border-grey-800 p-4 flex items-center justify-between">
          <h2 className="font-bold text-white text-xl">Create Channel</h2>
          <button
            onClick={handleClose}
            className="p-1 text-grey-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleCreateChannel} className="space-y-4">
            {error && (
              <div className="bg-red-900/30 border-2 border-red-500 p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-grey-300 text-sm font-bold mb-2">CHANNEL TYPE</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChannelType('text')}
                  className={`
                    p-3 border-2 flex items-center gap-2 transition-colors
                    ${
                      channelType === 'text'
                        ? 'bg-white text-black border-white'
                        : 'bg-grey-850 text-white border-grey-700 hover:border-white'
                    }
                  `}
                >
                  <Hash className="w-5 h-5" />
                  <span className="font-medium">Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChannelType('voice')}
                  className={`
                    p-3 border-2 flex items-center gap-2 transition-colors
                    ${
                      channelType === 'voice'
                        ? 'bg-white text-black border-white'
                        : 'bg-grey-850 text-white border-grey-700 hover:border-white'
                    }
                  `}
                >
                  <Volume2 className="w-5 h-5" />
                  <span className="font-medium">Voice</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-grey-300 text-sm font-bold mb-2">CHANNEL NAME *</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-500">
                  {channelType === 'text' ? (
                    <Hash className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </div>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) =>
                    setChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                  }
                  className="w-full bg-grey-850 border-2 border-grey-700 pl-10 pr-3 py-2 text-white focus:border-white"
                  placeholder={channelType === 'text' ? 'general' : 'voice-chat'}
                  required
                  maxLength={30}
                />
              </div>
              <p className="text-grey-500 text-xs mt-2">
                Channel names must be lowercase with no spaces
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors font-medium"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !channelName.trim()}
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ChannelModal
