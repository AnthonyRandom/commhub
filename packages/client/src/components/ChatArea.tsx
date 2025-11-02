import React, { useEffect, useRef, useState } from 'react'
import { Hash, Send, Users } from 'lucide-react'
import { useMessagesStore } from '../stores/messages'
import { wsManager } from '../services/websocket-manager'
import { useAuthStore } from '../stores/auth'
import MembersModal from './MembersModal'
import type { Channel, Server } from '../services/api'

interface ChatAreaProps {
  selectedChannel: Channel | null
  server: Server | null
}

const ChatArea: React.FC<ChatAreaProps> = ({ selectedChannel, server }) => {
  const [messageInput, setMessageInput] = useState('')
  const [showMembersModal, setShowMembersModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const allMessages = useMessagesStore((state) => state.messages)
  const messages = selectedChannel ? allMessages[selectedChannel.id] || [] : []
  const sendMessage = useMessagesStore((state) => state.sendMessage)
  const fetchMessages = useMessagesStore((state) => state.fetchMessages)
  const { user } = useAuthStore()

  // Fetch messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.id)
      wsManager.joinChannel(selectedChannel.id)

      return () => {
        wsManager.leaveChannel(selectedChannel.id)
      }
    }
  }, [selectedChannel, fetchMessages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when channel changes
  useEffect(() => {
    if (selectedChannel) {
      inputRef.current?.focus()
    }
  }, [selectedChannel])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChannel || !messageInput.trim()) return

    try {
      await sendMessage(selectedChannel.id, messageInput.trim())
      setMessageInput('')
      inputRef.current?.focus()
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!selectedChannel) {
    return (
      <div className="flex-1 bg-grey-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-grey-850 border-2 border-grey-700 flex items-center justify-center mx-auto mb-4">
            <Hash className="w-10 h-10 text-grey-600" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">No Channel Selected</h2>
          <p className="text-grey-400">Select a channel from the sidebar to start chatting</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-grey-900 flex flex-col h-full">
      {/* Channel Header */}
      <div className="h-14 border-b-2 border-grey-800 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-grey-400" />
          <h2 className="font-bold text-white text-lg">{selectedChannel.name}</h2>
        </div>
        <button
          onClick={() => setShowMembersModal(true)}
          className="p-2 text-grey-400 hover:text-white hover:bg-grey-850 transition-colors border-2 border-transparent hover:border-grey-700"
          title="Members"
        >
          <Users className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-grey-850 border-2 border-grey-700 flex items-center justify-center mx-auto mb-3">
                <Hash className="w-8 h-8 text-grey-600" />
              </div>
              <h3 className="text-white font-bold mb-2">Welcome to #{selectedChannel.name}</h3>
              <p className="text-grey-400 text-sm">
                This is the start of your conversation. Say hello!
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwnMessage = message.user?.id === user?.id
            const showUserInfo = index === 0 || messages[index - 1]?.user?.id !== message.user?.id

            return (
              <div key={message.id} className="message-enter">
                {showUserInfo ? (
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-white flex items-center justify-center flex-shrink-0">
                      <span className="text-black font-bold text-sm">
                        {message.user?.username?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span
                          className={`font-bold text-sm ${isOwnMessage ? 'text-white' : 'text-grey-200'}`}
                        >
                          {message.user?.username || 'Unknown'}
                        </span>
                        <span className="text-grey-500 text-xs">
                          {formatTimestamp(message.createdAt)}
                        </span>
                      </div>
                      <p className="text-grey-100 break-words">{message.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 hover:bg-grey-850/30 -mx-2 px-2 py-0.5">
                    <div className="w-10 flex-shrink-0 flex items-center justify-center">
                      <span className="text-grey-600 text-xs opacity-0 hover:opacity-100 transition-opacity">
                        {formatTimestamp(message.createdAt)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-grey-100 break-words">{message.content}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t-2 border-grey-800 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="relative">
          <textarea
            ref={inputRef}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${selectedChannel.name}`}
            className="w-full bg-grey-850 border-2 border-grey-700 px-4 py-3 pr-12 text-white resize-none focus:border-white"
            rows={1}
            maxLength={2000}
            style={{
              minHeight: '48px',
              maxHeight: '200px',
              height: 'auto',
            }}
          />
          <button
            type="submit"
            disabled={!messageInput.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-black hover:bg-grey-100 disabled:bg-grey-700 disabled:text-grey-500 disabled:cursor-not-allowed transition-colors border-2 border-transparent"
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <p className="text-grey-600 text-xs mt-2">Press Enter to send, Shift+Enter for new line</p>
      </div>

      {/* Members Modal */}
      <MembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        server={server}
      />
    </div>
  )
}

export default ChatArea
