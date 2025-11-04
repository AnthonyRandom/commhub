import React, { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { apiService, type Server } from '../services/api'
import { useServersStore } from '../stores/servers'
import { useAuthStore } from '../stores/auth'

interface ServerSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  server: Server | null
}

const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({ isOpen, onClose, server }) => {
  const [serverName, setServerName] = useState(server?.name || '')
  const [serverDescription, setServerDescription] = useState(server?.description || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { user } = useAuthStore()
  const { fetchServers } = useServersStore()

  const isOwner = server && user && server.ownerId === user.id

  if (!isOpen || !server) return null

  const handleUpdateServer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!server || !isOwner) return

    setIsLoading(true)
    setError('')

    try {
      await apiService.updateServer(server.id, {
        name: serverName,
        description: serverDescription,
      })
      await fetchServers()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update server')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteServer = async () => {
    if (!server || !isOwner) return

    setIsLoading(true)
    setError('')

    try {
      await apiService.deleteServer(server.id)
      await fetchServers()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete server')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeaveServer = async () => {
    if (!server) return

    setIsLoading(true)
    setError('')

    try {
      await apiService.leaveServer(server.id)
      await fetchServers()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to leave server')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-grey-900 border-2 border-white w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="border-b-2 border-grey-800 p-4 flex items-center justify-between sticky top-0 bg-grey-900 z-10">
          <h2 className="font-bold text-white text-xl">Server Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-grey-850 text-white transition-colors border-2 border-transparent hover:border-grey-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {error && (
            <div className="bg-red-900/20 border-2 border-red-500 p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Server Info Section */}
          <div>
            <h3 className="font-bold text-white text-lg mb-3 border-b border-grey-800 pb-2">
              Server Information
            </h3>
            {isOwner ? (
              <form onSubmit={handleUpdateServer} className="space-y-4">
                <div>
                  <label className="block text-grey-300 text-sm font-bold mb-2">Server Name</label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className="w-full bg-grey-850 border-2 border-grey-700 px-4 py-2 text-white focus:border-white"
                    required
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-grey-300 text-sm font-bold mb-2">Description</label>
                  <textarea
                    value={serverDescription}
                    onChange={(e) => setServerDescription(e.target.value)}
                    className="w-full bg-grey-850 border-2 border-grey-700 px-4 py-2 text-white focus:border-white resize-none"
                    rows={3}
                    maxLength={200}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-white text-black font-bold hover:bg-grey-100 disabled:bg-grey-700 disabled:text-grey-500 disabled:cursor-not-allowed transition-colors border-2 border-transparent"
                >
                  {isLoading ? 'Updating...' : 'Save Changes'}
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                <div>
                  <span className="text-grey-500 text-sm">Name:</span>
                  <p className="text-white font-bold">{server.name}</p>
                </div>
                {server.description && (
                  <div>
                    <span className="text-grey-500 text-sm">Description:</span>
                    <p className="text-grey-300">{server.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Members Section */}
          <div>
            <h3 className="font-bold text-white text-lg mb-3 border-b border-grey-800 pb-2">
              Members
            </h3>
            <div className="space-y-2">
              {server.members?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-2 bg-grey-850 border border-grey-800"
                >
                  <div className="w-8 h-8 bg-white flex items-center justify-center">
                    <span className="text-black font-bold text-sm">
                      {member.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{member.username}</p>
                    {member.id === server.ownerId && <p className="text-grey-500 text-xs">Owner</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div>
            <h3 className="font-bold text-red-400 text-lg mb-3 border-b border-red-900 pb-2">
              Danger Zone
            </h3>
            {isOwner ? (
              <div className="space-y-3">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-900 text-white border-2 border-red-700 hover:border-red-500 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Server
                  </button>
                ) : (
                  <div className="bg-red-900/20 border-2 border-red-500 p-4 space-y-3">
                    <p className="text-red-200 font-bold">
                      Are you sure you want to delete this server?
                    </p>
                    <p className="text-red-300 text-sm">
                      This action cannot be undone. All channels, messages, and data will be
                      permanently deleted.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteServer}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-700 text-white font-bold hover:bg-red-600 disabled:bg-grey-700 disabled:cursor-not-allowed transition-colors"
                      >
                        {isLoading ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleLeaveServer}
                disabled={isLoading}
                className="px-4 py-2 bg-red-900 text-white border-2 border-red-700 hover:border-red-500 disabled:bg-grey-700 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Leaving...' : 'Leave Server'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-grey-800 p-4 flex justify-end sticky bottom-0 bg-grey-900">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ServerSettingsModal
