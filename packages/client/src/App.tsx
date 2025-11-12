import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import Auth from './components/auth/Auth'
import ServerModal from './components/ServerModal'
import ChannelModal from './components/ChannelModal'
import SettingsModal from './components/SettingsModal'
import ServerSettingsModal from './components/ServerSettingsModal'
import FriendsPanel from './components/FriendsPanel'
import UpdateNotification from './components/UpdateNotification'
import { useAuthStore } from './stores/auth'
import { useServersStore } from './stores/servers'
import { useDirectMessagesStore } from './stores/directMessages'
import { useStatusStore } from './stores/status'
import { wsManager } from './services/websocket-manager'
import type { Server, Channel } from './services/api'
import './app.css'

// Prevent default Tauri update dialogs globally
if (window.__TAURI__) {
  import('@tauri-apps/api/window').then(({ appWindow }) => {
    // Intercept any update-related events to prevent default dialogs
    appWindow.listen('tauri://update-available', (_event: any) => {
      console.log('Global: Intercepted update-available event, custom dialog should handle this')
    })

    appWindow.listen('tauri://update-install', (_event: any) => {
      console.log('Global: Intercepted update-install event')
    })

    appWindow.listen('tauri://update-status', (_event: any) => {
      console.log('Global: Intercepted update-status event')
    })
  })
}

function App() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [selectedDMUserId, setSelectedDMUserId] = useState<number | null>(null)
  const [showServerModal, setShowServerModal] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [showAppSettings, setShowAppSettings] = useState(false)
  const [showFriendsPanel, setShowFriendsPanel] = useState(false)
  const [showUpdateNotification, setShowUpdateNotification] = useState(false)

  const { isAuthenticated, isLoading } = useAuthStore()
  const selectServer = useServersStore((state) => state.selectServer)
  const { conversations, fetchConversations, deleteConversation } = useDirectMessagesStore()
  const { initializeStatusTracking, cleanup } = useStatusStore()

  // Debug showUpdateNotification state changes (development only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[App] showUpdateNotification state changed to:', showUpdateNotification)
    }
  }, [showUpdateNotification])

  // Initialize WebSocket manager and check auth on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize WebSocket manager
        wsManager.initialize()

        // Check authentication status
        await useAuthStore.getState().checkAuth()

        // Initialize status tracking if authenticated
        if (useAuthStore.getState().isAuthenticated) {
          initializeStatusTracking()
        }

        // Check for updates (only in Tauri environment and only once per session)
        if (window.__TAURI__ && !sessionStorage.getItem('updateChecked')) {
          // Delay update check to avoid interfering with initial app load
          setTimeout(() => {
            setShowUpdateNotification(true)
            sessionStorage.setItem('updateChecked', 'true')
          }, 2000)
        }
      } catch (error) {
        console.error('App initialization error:', error)
      }
    }

    // Listen for manual update check events from settings
    const handleShowUpdateNotification = (_event: CustomEvent) => {
      // Debug update notification events (development only)
      if (import.meta.env.DEV) {
        console.log('[App] Received showUpdateNotification event, showing update notification')
        console.log(
          '[App] Setting showUpdateNotification to true, current value:',
          showUpdateNotification
        )
      }
      // If an update manifest is provided via the event, show the notification
      // Otherwise, let the UpdateNotification component handle the check itself
      setShowUpdateNotification(true)
      if (import.meta.env.DEV) {
        console.log('[App] showUpdateNotification should now be true')
      }
    }

    window.addEventListener('showUpdateNotification', handleShowUpdateNotification as EventListener)

    initializeApp()

    return () => {
      window.removeEventListener(
        'showUpdateNotification',
        handleShowUpdateNotification as EventListener
      )
      cleanup()
    }
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
      // Note: We don't refetch conversations since "closing" a DM is just a local UI action
      // The conversation can be reopened by messaging the friend again
    } catch (error) {
      console.error('Failed to close DM conversation:', error)
    }
  }

  const handleBackFromDM = () => {
    setSelectedDMUserId(null)
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

  const handleDismissUpdateNotification = () => {
    setShowUpdateNotification(false)
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
            <FriendsPanel
              selectedDMUserId={selectedDMUserId}
              onStartDM={handleDMSelect}
              onBackFromDM={handleBackFromDM}
            />
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

        {/* Update Notification */}
        {showUpdateNotification && (
          <UpdateNotification onDismiss={handleDismissUpdateNotification} />
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
