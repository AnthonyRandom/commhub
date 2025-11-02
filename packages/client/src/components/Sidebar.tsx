import React from 'react'
import { useAuthStore } from '../stores/auth'

interface SidebarProps {
  selectedServer: string
  selectedChannel: string
  onChannelSelect: (channel: string) => void
  onServerSelect: (server: string) => void
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedServer,
  selectedChannel,
  onChannelSelect: _onChannelSelect,
  onServerSelect: _onServerSelect,
}) => {
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <div className="w-64 bg-gray-700 p-4 flex flex-col h-full">
      {/* User info section */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-white font-medium">{user?.username}</p>
            <p className="text-gray-400 text-xs">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200"
        >
          Logout
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1">
        <h2 className="text-white text-lg font-bold mb-4">Servers & Channels</h2>
        <p className="text-gray-300">Selected Server: {selectedServer || 'None'}</p>
        <p className="text-gray-300">Selected Channel: {selectedChannel || 'None'}</p>
        <p className="text-gray-400 text-sm mt-4">Sidebar component - to be implemented</p>
      </div>
    </div>
  )
}

export default Sidebar
