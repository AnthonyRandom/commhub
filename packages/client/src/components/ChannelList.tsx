import React, { useEffect } from 'react'
import { Hash, Volume2, Plus, Settings, LogOut, Copy } from 'lucide-react'
import { useChannelsStore } from '../stores/channels'
import { useServersStore } from '../stores/servers'
import { useAuthStore } from '../stores/auth'
import type { Channel, Server } from '../services/api'

interface ChannelListProps {
  server: Server | null
  selectedChannel: Channel | null
  onChannelSelect: (channel: Channel) => void
  onCreateChannel: () => void
  onServerSettings: () => void
}

const ChannelList: React.FC<ChannelListProps> = ({
  server,
  selectedChannel,
  onChannelSelect,
  onCreateChannel,
  onServerSettings,
}) => {
  const getChannelsByServer = useChannelsStore((state) => state.getChannelsByServer)
  const fetchChannels = useChannelsStore((state) => state.fetchChannels)
  const leaveServer = useServersStore((state) => state.leaveServer)
  const getServerInviteCode = useServersStore((state) => state.getServerInviteCode)
  const { user, logout } = useAuthStore()

  const [showServerMenu, setShowServerMenu] = React.useState(false)
  const [inviteCode, setInviteCode] = React.useState<string | null>(null)
  const [copySuccess, setCopySuccess] = React.useState(false)

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const serverChannels = server ? getChannelsByServer(server.id) : []
  const textChannels = serverChannels.filter((ch) => ch.type === 'text')
  const voiceChannels = serverChannels.filter((ch) => ch.type === 'voice')

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleLeaveServer = async () => {
    if (!server) return
    try {
      await leaveServer(server.id)
      setShowServerMenu(false)
    } catch (error) {
      console.error('Failed to leave server:', error)
    }
  }

  const handleGetInviteCode = async () => {
    if (!server) return
    try {
      const code = await getServerInviteCode(server.id)
      setInviteCode(code)
    } catch (error) {
      console.error('Failed to get invite code:', error)
    }
  }

  const handleCopyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  return (
    <div className="w-60 bg-grey-900 border-r-2 border-grey-800 flex flex-col h-full">
      {/* Server Header */}
      <div className="relative">
        <div className="w-full h-14 px-4 flex items-center justify-between border-b-2 border-grey-800">
          <span className="font-bold text-white text-lg truncate">
            {server ? server.name : 'Direct Messages'}
          </span>
          {server && (
            <button
              onClick={() => setShowServerMenu(!showServerMenu)}
              className="p-2 text-grey-400 hover:text-white hover:bg-grey-850 transition-colors border-2 border-transparent hover:border-grey-700"
              title="Server Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Server Dropdown Menu */}
        {showServerMenu && (
          <div className="absolute top-full left-0 right-0 bg-grey-850 border-2 border-grey-700 z-50 animate-slide-down">
            {server && (
              <>
                {server.ownerId === user?.id && (
                  <>
                    <button
                      onClick={() => {
                        handleGetInviteCode()
                        setShowServerMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-white hover:bg-grey-800 flex items-center gap-2 border-b border-grey-700"
                    >
                      <Copy className="w-4 h-4" />
                      Invite People
                    </button>
                    <button
                      onClick={onServerSettings}
                      className="w-full px-4 py-3 text-left text-white hover:bg-grey-800 flex items-center gap-2 border-b border-grey-700"
                    >
                      <Settings className="w-4 h-4" />
                      Server Settings
                    </button>
                  </>
                )}
                <button
                  onClick={handleLeaveServer}
                  className="w-full px-4 py-3 text-left text-red-500 hover:bg-grey-800 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Leave Server
                </button>
              </>
            )}
          </div>
        )}

        {/* Invite Code Modal */}
        {inviteCode && server?.ownerId === user?.id && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-grey-900 border-2 border-white w-96 animate-slide-up">
              <div className="border-b-2 border-grey-800 p-4">
                <h3 className="font-bold text-white text-lg">Invite Friends</h3>
              </div>
              <div className="p-4">
                <p className="text-grey-300 text-sm mb-4">
                  Share this code with your friends to invite them to {server?.name}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteCode}
                    readOnly
                    className="flex-1 bg-grey-850 border-2 border-grey-700 px-3 py-2 text-white font-mono"
                  />
                  <button
                    onClick={handleCopyInviteCode}
                    className="px-4 py-2 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-medium"
                  >
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="border-t-2 border-grey-800 p-4 flex justify-end">
                <button
                  onClick={() => setInviteCode(null)}
                  className="px-4 py-2 bg-grey-800 text-white border-2 border-grey-700 hover:border-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Channels Section */}
      <div className="flex-1 overflow-y-auto p-2">
        {server ? (
          <>
            {/* Text Channels */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <h3 className="text-grey-400 text-xs font-bold uppercase tracking-wider">
                  Text Channels
                </h3>
                <button
                  onClick={() => onCreateChannel()}
                  className="text-grey-400 hover:text-white transition-colors"
                  title="Create Channel"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                {textChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => onChannelSelect(channel)}
                    className={`
                      w-full px-2 py-2 flex items-center gap-2
                      border-2 transition-all duration-100
                      ${
                        selectedChannel?.id === channel.id
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent text-grey-300 border-transparent hover:border-grey-700 hover:bg-grey-850'
                      }
                    `}
                  >
                    <Hash className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate text-sm font-medium">{channel.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Channels */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <h3 className="text-grey-400 text-xs font-bold uppercase tracking-wider">
                  Voice Channels
                </h3>
              </div>
              <div className="space-y-1">
                {voiceChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => onChannelSelect(channel)}
                    className={`
                      w-full px-2 py-2 flex items-center gap-2
                      border-2 transition-all duration-100
                      ${
                        selectedChannel?.id === channel.id
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent text-grey-300 border-transparent hover:border-grey-700 hover:bg-grey-850'
                      }
                    `}
                  >
                    <Volume2 className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate text-sm font-medium">{channel.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-grey-500 py-8 px-4">
            <p className="text-sm">Select a server or create one to get started</p>
          </div>
        )}
      </div>

      {/* User Info Footer */}
      <div className="border-t-2 border-grey-800 bg-grey-950 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-black font-bold text-xs">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-medium text-sm truncate">{user?.username}</p>
            <p className="text-grey-500 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-grey-400 hover:text-white hover:bg-grey-800 transition-colors border-2 border-transparent hover:border-grey-700 flex-shrink-0"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default ChannelList
