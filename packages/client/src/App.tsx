import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import Auth from './components/auth/Auth'
import { useAuthStore } from './stores/auth'
import { wsManager } from './services/websocket-manager'
import './app.css'

function App() {
  const [selectedChannel, setSelectedChannel] = useState('')
  const [selectedServer, setSelectedServer] = useState('')
  const { isAuthenticated, isLoading } = useAuthStore()

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

  const handleChannelSelect = (channel: string) => {
    setSelectedChannel(channel)
  }

  const handleServerSelect = (server: string) => {
    setSelectedServer(server)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading CommHub...</p>
          <p className="text-gray-400 text-sm mt-2">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <main className="flex h-screen bg-gray-800 text-white">
        <Sidebar
          selectedServer={selectedServer}
          selectedChannel={selectedChannel}
          onChannelSelect={handleChannelSelect}
          onServerSelect={handleServerSelect}
        />
        <ChatArea selectedChannel={selectedChannel} />
      </main>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <Auth />
    </div>
  )
}

export default App
