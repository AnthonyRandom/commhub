import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import Auth from './components/auth/Auth'
import ServerModal from './components/ServerModal'
import ChannelModal from './components/ChannelModal'
import { useAuthStore } from './stores/auth'
import { useServersStore } from './stores/servers'
import { wsManager } from './services/websocket-manager'
import type { Server, Channel } from './services/api'
import './app.css'

function App() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [showServerModal, setShowServerModal] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [showServerSettings, setShowServerSettings] = useState(false)

  const { isAuthenticated, isLoading } = useAuthStore()
  const selectServer = useServersStore((state) => state.selectServer)

  // Initialize WebSocket manager and check auth on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize WebSocket manager
        wsManager.initialize()

        // Check authentication status
        await useAuthStore.getState().checkAuth()
      } catch (error) {
        console.error('App initialization error:', error)
      }
    }

    initializeApp()
  }, [])

  // Join server websocket room when server is selected
  useEffect(() => {
    if (selectedServer) {
      wsManager.joinServer(selectedServer.id)
      selectServer(selectedServer)

      return () => {
        wsManager.leaveServer(selectedServer.id)
      }
    }
  }, [selectedServer, selectServer])

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel)
  }

  const handleServerSelect = (server: Server | null) => {
    setSelectedServer(server)
    setSelectedChannel(null) // Clear channel selection when switching servers
  }

  const handleCreateServer = () => {
    setShowServerModal(true)
  }

  const handleCreateChannel = () => {
    setShowChannelModal(true)
  }

  const handleServerSettings = () => {
    setShowServerSettings(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-grey-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg font-bold">Loading CommHub...</p>
          <p className="text-grey-400 text-sm mt-2">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <>
        <main className="flex h-screen bg-grey-950 text-white overflow-hidden">
          <Sidebar
            selectedServer={selectedServer}
            selectedChannel={selectedChannel}
            onChannelSelect={handleChannelSelect}
            onServerSelect={handleServerSelect}
            onCreateServer={handleCreateServer}
            onCreateChannel={handleCreateChannel}
            onServerSettings={handleServerSettings}
          />
          <ChatArea selectedChannel={selectedChannel} server={selectedServer} />
        </main>

        {/* Modals */}
        <ServerModal isOpen={showServerModal} onClose={() => setShowServerModal(false)} />
        <ChannelModal
          isOpen={showChannelModal}
          serverId={selectedServer?.id || null}
          onClose={() => setShowChannelModal(false)}
        />

        {/* Server Settings Modal - Placeholder */}
        {showServerSettings && selectedServer && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-grey-900 border-2 border-white w-96 animate-slide-up">
              <div className="border-b-2 border-grey-800 p-4">
                <h3 className="font-bold text-white text-lg">Server Settings</h3>
              </div>
              <div className="p-4">
                <p className="text-grey-300 text-sm mb-4">
                  Server settings for {selectedServer.name}
                </p>
                <p className="text-grey-500 text-xs">Coming soon...</p>
              </div>
              <div className="border-t-2 border-grey-800 p-4 flex justify-end">
                <button
                  onClick={() => setShowServerSettings(false)}
                  className="px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-grey-950">
      <Auth />
    </div>
  )
}

export default App
