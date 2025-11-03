import React, { useEffect, useRef, useState } from 'react'
import { Hash, Send, Users, MoreVertical, Edit2, Trash2, Volume2, PhoneCall } from 'lucide-react'
import { useMessagesStore } from '../stores/messages'
import { wsManager } from '../services/websocket-manager'
import { useAuthStore } from '../stores/auth'
import { useVoiceStore } from '../stores/voice'
import { voiceManager } from '../services/voice-manager'
import MembersModal from './MembersModal'
import VoiceControls from './VoiceControls'
import type { Channel, Server, Message } from '../services/api'

interface ChatAreaProps {
  selectedChannel: Channel | null
  server: Server | null
}

const ChatArea: React.FC<ChatAreaProps> = ({ selectedChannel, server }) => {
  const [messageInput, setMessageInput] = useState('')
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [contextMenuMessageId, setContextMenuMessageId] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  const allMessages = useMessagesStore((state) => state.messages)
  const messages = selectedChannel ? allMessages[selectedChannel.id] || [] : []
  const sendMessage = useMessagesStore((state) => state.sendMessage)
  const fetchMessages = useMessagesStore((state) => state.fetchMessages)
  const editMessage = useMessagesStore((state) => state.editMessage)
  const deleteMessage = useMessagesStore((state) => state.deleteMessage)
  const { user } = useAuthStore()

  const { connectedChannelId, isConnecting } = useVoiceStore()
  const isVoiceChannel = selectedChannel?.type === 'voice'
  const isConnectedToVoice = connectedChannelId === selectedChannel?.id

  // Fetch messages when channel changes (text channels only)
  useEffect(() => {
    if (selectedChannel && selectedChannel.type === 'text') {
      fetchMessages(selectedChannel.id)
      wsManager.joinChannel(selectedChannel.id)

      return () => {
        wsManager.leaveChannel(selectedChannel.id)
      }
    }
  }, [selectedChannel, fetchMessages])

  // Initialize voice manager
  useEffect(() => {
    voiceManager.initialize()
  }, [])

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

  const handleJoinVoice = async () => {
    if (!selectedChannel || selectedChannel.type !== 'voice') return

    try {
      await voiceManager.joinVoiceChannel(selectedChannel.id)
    } catch (error) {
      console.error('Failed to join voice channel:', error)
    }
  }

  const handleEditMessage = async (messageId: number) => {
    if (!editContent.trim()) return

    try {
      await editMessage(messageId, editContent.trim())
      setEditingMessageId(null)
      setEditContent('')
    } catch (error) {
      console.error('Failed to edit message:', error)
    }
  }

  const handleDeleteMessage = async (messageId: number) => {
    if (!selectedChannel) return

    try {
      await deleteMessage(selectedChannel.id, messageId)
      setContextMenuMessageId(null)
    } catch (error) {
      console.error('Failed to delete message:', error)
    }
  }

  const startEditingMessage = (message: Message) => {
    setEditingMessageId(message.id)
    setEditContent(message.content)
    setContextMenuMessageId(null)
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditContent('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, messageId: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditMessage(messageId)
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  const canEditOrDelete = (message: Message) => {
    if (!user) return false
    const isOwner = message.user?.id === user.id
    const timeSinceCreation = Date.now() - new Date(message.createdAt).getTime()
    const fifteenMinutes = 15 * 60 * 1000
    return isOwner && timeSinceCreation <= fifteenMinutes
  }

  const isServerOwner = server && user && server.ownerId === user.id

  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingMessageId])

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

  // Voice Channel UI
  if (isVoiceChannel) {
    return (
      <div className="flex-1 bg-grey-900 flex flex-col h-full">
        {/* Channel Header */}
        <div className="h-14 border-b-2 border-grey-800 px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-grey-400" />
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

        {/* Voice Channel Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          {!isConnectedToVoice && !isConnecting ? (
            <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-grey-850 border-2 border-grey-700 flex items-center justify-center mx-auto mb-6">
                <Volume2 className="w-12 h-12 text-grey-600" />
              </div>
              <h2 className="text-white text-2xl font-bold mb-3">{selectedChannel.name}</h2>
              <p className="text-grey-400 mb-6">
                Join this voice channel to talk with others in real-time. Make sure your microphone
                is working.
              </p>
              <button
                onClick={handleJoinVoice}
                className="px-6 py-3 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-bold flex items-center gap-2 mx-auto"
              >
                <PhoneCall className="w-5 h-5" />
                Join Voice Channel
              </button>
            </div>
          ) : (
            <div className="text-center">
              {isConnecting ? (
                <>
                  <div className="w-16 h-16 border-4 border-white border-t-transparent animate-spin mx-auto mb-4"></div>
                  <p className="text-white text-lg font-bold">Connecting to voice...</p>
                  <p className="text-grey-400 text-sm mt-2">Requesting microphone access...</p>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-white border-2 border-white flex items-center justify-center mx-auto mb-6">
                    <Volume2 className="w-12 h-12 text-black" />
                  </div>
                  <h2 className="text-white text-2xl font-bold mb-3">Voice Connected</h2>
                  <p className="text-grey-400">You are now in the voice channel</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Voice Controls (shown when connected) */}
        {isConnectedToVoice && <VoiceControls channel={selectedChannel} />}

        {/* Members Modal */}
        <MembersModal
          isOpen={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          server={server}
        />
      </div>
    )
  }

  // Text Channel UI (existing code continues below)

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
            const canModify = canEditOrDelete(message)
            const canDelete = isOwnMessage || isServerOwner
            const isEditing = editingMessageId === message.id

            return (
              <div key={message.id} className="message-enter group relative">
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
                          {message.isEdited && <span className="ml-1 text-grey-600">(edited)</span>}
                        </span>
                      </div>
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            ref={editInputRef}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => handleEditKeyDown(e, message.id)}
                            className="w-full bg-grey-800 border-2 border-grey-700 px-3 py-2 text-white resize-none focus:border-white"
                            rows={2}
                            maxLength={2000}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditMessage(message.id)}
                              className="px-3 py-1 bg-white text-black text-sm font-bold hover:bg-grey-200 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-3 py-1 bg-grey-800 text-white text-sm border-2 border-grey-700 hover:border-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-grey-100 break-words">{message.content}</p>
                      )}
                    </div>
                    {!isEditing && (canModify || canDelete) && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            setContextMenuMessageId(
                              contextMenuMessageId === message.id ? null : message.id
                            )
                          }
                          className="p-1 hover:bg-grey-800 text-grey-400 hover:text-white transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {contextMenuMessageId === message.id && (
                          <div className="absolute right-0 top-8 bg-grey-900 border-2 border-grey-700 z-10 min-w-[150px] animate-fade-in">
                            {canModify && (
                              <button
                                onClick={() => startEditingMessage(message)}
                                className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteMessage(message.id)}
                                className="w-full px-4 py-2 text-left text-red-400 hover:bg-grey-800 flex items-center gap-2 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-3 hover:bg-grey-850/30 -mx-2 px-2 py-0.5">
                    <div className="w-10 flex-shrink-0 flex items-center justify-center">
                      <span className="text-grey-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTimestamp(message.createdAt)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            ref={editInputRef}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => handleEditKeyDown(e, message.id)}
                            className="w-full bg-grey-800 border-2 border-grey-700 px-3 py-2 text-white resize-none focus:border-white"
                            rows={2}
                            maxLength={2000}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditMessage(message.id)}
                              className="px-3 py-1 bg-white text-black text-sm font-bold hover:bg-grey-200 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-3 py-1 bg-grey-800 text-white text-sm border-2 border-grey-700 hover:border-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-grey-100 break-words inline">{message.content}</p>
                          {message.isEdited && (
                            <span className="text-grey-600 text-xs ml-2">(edited)</span>
                          )}
                        </>
                      )}
                    </div>
                    {!isEditing && (canModify || canDelete) && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity relative">
                        <button
                          onClick={() =>
                            setContextMenuMessageId(
                              contextMenuMessageId === message.id ? null : message.id
                            )
                          }
                          className="p-1 hover:bg-grey-800 text-grey-400 hover:text-white transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {contextMenuMessageId === message.id && (
                          <div className="absolute right-0 top-8 bg-grey-900 border-2 border-grey-700 z-10 min-w-[150px] animate-fade-in">
                            {canModify && (
                              <button
                                onClick={() => startEditingMessage(message)}
                                className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteMessage(message.id)}
                                className="w-full px-4 py-2 text-left text-red-400 hover:bg-grey-800 flex items-center gap-2 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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
