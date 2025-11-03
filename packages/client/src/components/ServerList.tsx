import React, { useEffect } from 'react'
import { Plus, Users } from 'lucide-react'
import { useServersStore } from '../stores/servers'
import type { Server } from '../services/api'

interface ServerListProps {
  selectedServer: Server | null
  onServerSelect: (server: Server | null) => void
  onCreateServer: () => void
  onShowFriends: () => void
  showFriendsPanel: boolean
}

const ServerList: React.FC<ServerListProps> = ({
  selectedServer,
  onServerSelect,
  onCreateServer,
  onShowFriends,
  showFriendsPanel,
}) => {
  const servers = useServersStore((state) => state.servers)
  const fetchServers = useServersStore((state) => state.fetchServers)
  const isLoading = useServersStore((state) => state.isLoading)

  useEffect(() => {
    fetchServers()
  }, [fetchServers])

  const getServerInitials = (name: string): string => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="w-20 bg-grey-950 border-r-2 border-grey-800 flex flex-col items-center py-4 gap-3">
      {/* Friends Button */}
      <button
        onClick={onShowFriends}
        className={`
          w-14 h-14 flex items-center justify-center
          border-2 transition-all duration-100
          ${
            showFriendsPanel
              ? 'bg-white text-black border-white'
              : 'bg-grey-900 text-white border-grey-700 hover:border-white'
          }
        `}
        title="Friends"
      >
        <Users className="w-6 h-6" />
      </button>

      {/* Divider */}
      <div className="w-full border-t-2 border-grey-800" />

      {/* Server List */}
      <div className="w-full flex flex-col items-center gap-3 overflow-y-auto flex-1">
        {isLoading && servers.length === 0 ? (
          <div className="w-14 h-14 flex items-center justify-center border-2 border-grey-700 bg-grey-900">
            <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin" />
          </div>
        ) : (
          servers.map((server) => (
            <button
              key={server.id}
              onClick={() => onServerSelect(server)}
              className={`
                w-14 h-14 flex items-center justify-center
                border-2 font-bold text-sm transition-all duration-100
                ${
                  selectedServer?.id === server.id
                    ? 'bg-white text-black border-white'
                    : 'bg-grey-900 text-white border-grey-700 hover:border-white hover:bg-grey-800'
                }
              `}
              title={server.name}
            >
              {getServerInitials(server.name)}
            </button>
          ))
        )}
      </div>

      {/* Add Server Button */}
      <div className="w-full border-t-2 border-grey-800 pt-3 flex justify-center">
        <button
          onClick={onCreateServer}
          className="
            w-14 h-14 flex items-center justify-center
            bg-grey-900 text-white border-2 border-grey-700
            hover:border-white hover:bg-grey-800
            transition-all duration-100
          "
          title="Add Server"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}

export default ServerList
