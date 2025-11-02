import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useServersStore } from '../stores/servers'

interface ServerModalProps {
  isOpen: boolean
  onClose: () => void
}

const ServerModal: React.FC<ServerModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [serverName, setServerName] = useState('')
  const [serverDescription, setServerDescription] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const createServer = useServersStore((state) => state.createServer)
  const joinServer = useServersStore((state) => state.joinServer)

  const handleClose = () => {
    setMode('choose')
    setServerName('')
    setServerDescription('')
    setInviteCode('')
    setError(null)
    setIsLoading(false)
    onClose()
  }

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await createServer(serverName, serverDescription)
      handleClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create server')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinServer = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await joinServer(inviteCode)
      handleClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join server')
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
          <h2 className="font-bold text-white text-xl">
            {mode === 'choose' && 'Add Server'}
            {mode === 'create' && 'Create Server'}
            {mode === 'join' && 'Join Server'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-grey-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {mode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('create')}
                className="w-full p-4 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors text-left"
              >
                <h3 className="font-bold text-lg mb-1">Create Server</h3>
                <p className="text-sm text-grey-700">Start a new server and invite your friends</p>
              </button>
              <button
                onClick={() => setMode('join')}
                className="w-full p-4 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors text-left"
              >
                <h3 className="font-bold text-lg mb-1">Join Server</h3>
                <p className="text-sm text-grey-400">
                  Enter an invite code to join an existing server
                </p>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreateServer} className="space-y-4">
              {error && (
                <div className="bg-red-900/30 border-2 border-red-500 p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-grey-300 text-sm font-bold mb-2">SERVER NAME *</label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  className="w-full bg-grey-850 border-2 border-grey-700 px-3 py-2 text-white focus:border-white"
                  placeholder="My Awesome Server"
                  required
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-grey-300 text-sm font-bold mb-2">
                  DESCRIPTION (OPTIONAL)
                </label>
                <textarea
                  value={serverDescription}
                  onChange={(e) => setServerDescription(e.target.value)}
                  className="w-full bg-grey-850 border-2 border-grey-700 px-3 py-2 text-white focus:border-white resize-none"
                  placeholder="What's your server about?"
                  rows={3}
                  maxLength={200}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="flex-1 px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors font-medium"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || !serverName.trim()}
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoinServer} className="space-y-4">
              {error && (
                <div className="bg-red-900/30 border-2 border-red-500 p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-grey-300 text-sm font-bold mb-2">INVITE CODE *</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full bg-grey-850 border-2 border-grey-700 px-3 py-2 text-white font-mono focus:border-white"
                  placeholder="abc123xyz"
                  required
                />
                <p className="text-grey-500 text-xs mt-2">Enter the invite code from your friend</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="flex-1 px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors font-medium"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || !inviteCode.trim()}
                >
                  {isLoading ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ServerModal
