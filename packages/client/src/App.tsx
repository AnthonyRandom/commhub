import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import Auth from './components/auth/Auth'
import ServerModal from './components/ServerModal'
import ChannelModal from './components/ChannelModal'
import SettingsModal from './components/SettingsModal'
import ServerSettingsModal from './components/ServerSettingsModal'
import FriendsPanel from './components/FriendsPanel'
import { useAuthStore } from './stores/auth'
import { useServersStore } from './stores/servers'
import { useDirectMessagesStore } from './stores/directMessages'
import { wsManager } from './services/websocket-manager'
import type { Server, Channel } from './services/api'
import './app.css'

function App() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [selectedDMUserId, setSelectedDMUserId] = useState<number | null>(null)
  const [showServerModal, setShowServerModal] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [showAppSettings, setShowAppSettings] = useState(false)
  const [showFriendsPanel, setShowFriendsPanel] = useState(false)

  const { isAuthenticated, isLoading } = useAuthStore()
  const selectServer = useServersStore((state) => state.selectServer)
  const { conversations, fetchConversations, deleteConversation } = useDirectMessagesStore()

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
    setSelectedChannel(null)
    setShowFriendsPanel(false)
  }

  const handleShowFriends = () => {
    setShowFriendsPanel(true)
    setSelectedServer(null)
    setSelectedChannel(null)
    setSelectedDMUserId(null)
  }

  const handleDMSelect = (userId: number) => {
    setSelectedDMUserId(userId)
    setShowFriendsPanel(true)
    setSelectedServer(null)
    setSelectedChannel(null)
  }

  const handleDeleteDM = async (userId: number) => {
    try {
      await deleteConversation(userId)
      // If the deleted conversation was currently selected, deselect it
      if (selectedDMUserId === userId) {
        setSelectedDMUserId(null)
      }
      // Refresh conversations
      await fetchConversations()
    } catch (error) {
      console.error('Failed to delete DM conversation:', error)
    }
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

  const handleAppSettings = () => {
    setShowAppSettings(true)
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
            onAppSettings={handleAppSettings}
            onShowFriends={handleShowFriends}
            showFriendsPanel={showFriendsPanel}
            dmConversations={conversations}
            onDMSelect={handleDMSelect}
            onDeleteDM={handleDeleteDM}
          />
          {showFriendsPanel ? (
            <FriendsPanel selectedDMUserId={selectedDMUserId} />
          ) : (
            <ChatArea selectedChannel={selectedChannel} server={selectedServer} />
          )}
        </main>

        {/* Modals */}
        <ServerModal isOpen={showServerModal} onClose={() => setShowServerModal(false)} />
        <ChannelModal
          isOpen={showChannelModal}
          serverId={selectedServer?.id || null}
          onClose={() => setShowChannelModal(false)}
        />
        <SettingsModal isOpen={showAppSettings} onClose={() => setShowAppSettings(false)} />

        {/* Server Settings Modal */}
        <ServerSettingsModal
          isOpen={showServerSettings}
          onClose={() => setShowServerSettings(false)}
          server={selectedServer}
        />
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
