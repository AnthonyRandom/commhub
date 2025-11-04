import React, { useEffect, useRef, useState } from 'react'
import {
  Hash,
  Send,
  Users,
  MoreVertical,
  Edit2,
  Trash2,
  Volume2,
  PhoneCall,
  MicOff,
  VolumeX,
  Volume1,
  Image as ImageIcon,
  Smile,
  Reply as ReplyIcon,
  X,
} from 'lucide-react'
import { useMessagesStore } from '../stores/messages'
import { wsManager } from '../services/websocket-manager'
import { useAuthStore } from '../stores/auth'
import { useVoiceStore } from '../stores/voice'
import { voiceManager } from '../services/voice-manager'
import { useServersStore } from '../stores/servers'
import { useSettingsStore } from '../stores/settings'
import { useFriendsStore } from '../stores/friends'
import MembersModal from './MembersModal'
import VoiceControls from './VoiceControls'
import GifPicker from './GifPicker'
import EmojiPicker from './EmojiPicker'
import MediaEmbed from './MediaEmbed'
import type { Channel, Server, Message } from '../services/api'

interface ChatAreaProps {
  selectedChannel: Channel | null
  server: Server | null
}

// CSS for speaking animation (subtle jump up and down)
const speakingAnimationStyle = `
  @keyframes speakingJump {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }
  .speaking-animation {
    animation: speakingJump 1.5s ease-in-out infinite;
  }
`

// Twitter Spaces-style voice participant grid
const VoiceChannelParticipants: React.FC = () => {
  const { connectedUsers, isMuted, isDeafened, isConnecting } = useVoiceStore()
  const { user } = useAuthStore()
  const [selectedUser, setSelectedUser] = useState<number | null>(null)
  const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null)

  // Inject speaking animation CSS
  React.useEffect(() => {
    const style = document.createElement('style')
    style.textContent = speakingAnimationStyle
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  if (isConnecting) {
    return (
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 border-4 border-white border-t-transparent animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg font-bold">Connecting to voice...</p>
        <p className="text-grey-400 text-sm mt-2">Requesting microphone access...</p>
      </div>
    )
  }

  const connectedUsersArray = Array.from(connectedUsers.values()).filter(
    (voiceUser) => voiceUser.userId !== user?.id
  )
  const currentUserVoiceState = user ? connectedUsers.get(user.id) : null
  const currentUser = {
    userId: user?.id || 0,
    username: user?.username || 'You',
    isSpeaking: currentUserVoiceState?.isSpeaking || false,
    isMuted,
    isDeafened,
  }

  const handleUserLocalMute = (userId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const targetUser = connectedUsers.get(userId)
    if (targetUser) {
      voiceManager.setUserLocalMuted(userId, !targetUser.localMuted)
    }
  }

  const handleUserVolumeChange = (userId: number, volume: number) => {
    voiceManager.setUserVolume(userId, volume)
  }

  const handleUserClick = (userId: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return
    setSelectedUser(selectedUser === userId ? null : userId)
    setShowVolumeSlider(null)
  }

  const toggleVolumeSlider = (userId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setShowVolumeSlider(showVolumeSlider === userId ? null : userId)
  }

  // Dynamic grid size based on number of users
  const totalUsers = connectedUsersArray.length + 1
  const gridCols = Math.min(Math.ceil(Math.sqrt(totalUsers)), 5)

  return (
    <div className="w-full max-w-6xl">
      {/* Grid of participants - centered layout */}
      <div
        className="grid gap-5 justify-items-center items-start"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, max-content))`,
          justifyContent: 'center',
        }}
      >
        {/* Current User - always first/centered */}
        <div
          key={currentUser.userId}
          className={`flex flex-col items-center gap-3 animate-slide-up ${
            currentUser.isSpeaking ? 'speaking-animation' : ''
          }`}
          style={{
            gridColumn: connectedUsersArray.length === 0 ? '1 / -1' : 'auto',
            justifySelf: connectedUsersArray.length === 0 ? 'center' : 'auto',
          }}
        >
          {/* Avatar */}
          <div className="relative">
            <div
              className={`w-32 h-32 flex items-center justify-center transition-all duration-300 border-4 border-grey-800 ${
                currentUser.isSpeaking
                  ? 'bg-white ring-4 ring-white ring-offset-2 ring-offset-grey-900 scale-105'
                  : 'bg-white'
              }`}
            >
              <span className="font-bold text-3xl text-black">
                {currentUser.username.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Status badges */}
            {(currentUser.isMuted || currentUser.isDeafened) && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 animate-slide-up">
                {currentUser.isMuted && (
                  <div className="bg-red-900 border-2 border-grey-900 p-1.5">
                    <MicOff className="w-4 h-4 text-white" />
                  </div>
                )}
                {currentUser.isDeafened && (
                  <div className="bg-red-900 border-2 border-grey-900 p-1.5">
                    <VolumeX className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Username */}
          <div className="text-center">
            <p className="text-white font-bold text-base">{currentUser.username}</p>
          </div>
        </div>

        {/* Other Users */}
        {connectedUsersArray.map((participant, index) => {
          const voiceUser = connectedUsers.get(participant.userId)
          const isSelected = selectedUser === participant.userId

          return (
            <div
              key={participant.userId}
              className={`flex flex-col items-center gap-3 relative cursor-pointer animate-slide-up ${
                participant.isSpeaking ? 'speaking-animation' : ''
              }`}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
              onClick={() => handleUserClick(participant.userId, false)}
            >
              {/* Avatar */}
              <div className="relative">
                <div
                  className={`w-32 h-32 flex items-center justify-center transition-all duration-300 border-4 border-grey-800 ${
                    participant.isSpeaking
                      ? 'bg-white ring-4 ring-white ring-offset-2 ring-offset-grey-900 scale-105'
                      : 'bg-grey-800 hover:bg-grey-750'
                  } ${isSelected ? 'ring-2 ring-grey-600' : ''}`}
                >
                  <span
                    className={`font-bold text-3xl transition-colors ${
                      participant.isSpeaking ? 'text-black' : 'text-grey-300'
                    }`}
                  >
                    {participant.username.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Status badges */}
                {(participant.isMuted || voiceUser?.localMuted) && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 animate-slide-up">
                    {participant.isMuted && (
                      <div className="bg-red-900 border-2 border-grey-900 p-1.5">
                        <MicOff className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {voiceUser?.localMuted && (
                      <div className="bg-grey-700 border-2 border-grey-900 p-1.5">
                        <VolumeX className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Username */}
              <div className="text-center">
                <p className="text-white font-bold text-sm">{participant.username}</p>
              </div>

              {/* Controls panel - shown when selected */}
              {isSelected && voiceUser && (
                <div className="absolute top-full mt-4 z-50 animate-slide-up">
                  <div className="bg-grey-950 border-2 border-grey-700 p-4 min-w-[240px] shadow-xl">
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={(e) => handleUserLocalMute(participant.userId, e)}
                        className={`flex-1 p-3 border-2 transition-all duration-100 text-sm font-bold ${
                          voiceUser.localMuted
                            ? 'bg-red-900 border-red-700 text-white hover:bg-red-800'
                            : 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {voiceUser.localMuted ? (
                            <VolumeX className="w-4 h-4" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                          <span>{voiceUser.localMuted ? 'Unmute' : 'Mute'}</span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => toggleVolumeSlider(participant.userId, e)}
                        className="p-3 border-2 bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white transition-all duration-100"
                      >
                        <Volume1 className="w-4 h-4" />
                      </button>
                    </div>
                    {showVolumeSlider === participant.userId && (
                      <div className="pt-3 border-t border-grey-800 animate-slide-down">
                        <div className="flex items-center gap-3">
                          <Volume1 className="w-4 h-4 text-grey-400" />
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={voiceUser.localVolume * 100}
                            onChange={(e) =>
                              handleUserVolumeChange(
                                participant.userId,
                                parseInt(e.target.value) / 100
                              )
                            }
                            className="flex-1 h-1 bg-grey-700 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm text-white font-mono w-12 text-right">
                            {Math.round(voiceUser.localVolume * 100)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChatArea: React.FC<ChatAreaProps> = ({ selectedChannel, server }) => {
  const [messageInput, setMessageInput] = useState('')
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [contextMenuMessageId, setContextMenuMessageId] = useState<number | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
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
  const { fetchServers } = useServersStore()
  const { getTimeFormat } = useSettingsStore()
  const { blockedUsers } = useFriendsStore()

  const { connectedChannelId, isConnecting } = useVoiceStore()
  const isVoiceChannel = selectedChannel?.type === 'voice'
  const isConnectedToVoice = connectedChannelId === selectedChannel?.id

  // Helper function to check if a user is blocked
  const isUserBlocked = (userId: number) => {
    return blockedUsers.some((blockedUser) => blockedUser.id === userId)
  }

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
      await sendMessage(selectedChannel.id, messageInput.trim(), replyingTo?.id)
      setMessageInput('')
      setReplyingTo(null)
      inputRef.current?.focus()
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleGifSelect = async (gifUrl: string) => {
    if (!selectedChannel) return

    try {
      await sendMessage(selectedChannel.id, gifUrl, replyingTo?.id)
      setReplyingTo(null)
      setShowGifPicker(false)
    } catch (error) {
      console.error('Failed to send GIF:', error)
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => prev + emoji)
    inputRef.current?.focus()
  }

  const handleReplyTo = (message: Message) => {
    setReplyingTo(message)
    setContextMenuMessageId(null)
    inputRef.current?.focus()
  }

  const cancelReply = () => {
    setReplyingTo(null)
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

  const shouldSeparateMessages = (
    currentMessage: Message,
    previousMessage: Message | null,
    currentIndex: number
  ): boolean => {
    // Always show user info for the first message
    if (currentIndex === 0) return true

    // Always separate if different users
    if (!previousMessage || previousMessage.user?.id !== currentMessage.user?.id) return true

    // Check time gap between messages
    const currentTime = new Date(currentMessage.createdAt).getTime()
    const previousTime = new Date(previousMessage.createdAt).getTime()
    const timeGap = currentTime - previousTime

    // Separate if gap is more than 10 minutes (600,000 ms)
    const tenMinutes = 10 * 60 * 1000
    return timeGap > tenMinutes
  }

  const isServerOwner = server && user && server.ownerId === user.id

  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingMessageId])

  // Poll for server member updates when members modal is open
  useEffect(() => {
    if (!showMembersModal || !server) return

    const pollInterval = setInterval(async () => {
      try {
        await fetchServers()
      } catch (error) {
        console.error('Error polling for server member updates:', error)
      }
    }, 10000) // Poll every 10 seconds (less frequent than DM polling)

    return () => clearInterval(pollInterval)
  }, [showMembersModal, server, fetchServers])

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const formatTime = getTimeFormat()

    if (isToday) {
      return formatTime(date)
    }

    return `${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} ${formatTime(date)}`
  }

  const extractUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.match(urlRegex) || []
  }

  const removeUrlsFromText = (text: string): string => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.replace(urlRegex, '').trim()
  }

  const isGifUrl = (url: string): boolean => {
    return /\.(gif)$/i.test(url) || url.includes('tenor.com') || url.includes('giphy.com')
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
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
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
            <VoiceChannelParticipants />
          )}
        </div>

        {/* Voice Controls (shown when connected) */}
        {isConnectedToVoice && <VoiceControls channel={selectedChannel} />}

        {/* Members Modal */}
        <MembersModal
          key={`members-${server?.id}-${server?.members?.length || 0}`}
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
            const previousMessage = index > 0 ? messages[index - 1] : null
            const showUserInfo = shouldSeparateMessages(message, previousMessage, index)
            const canModify = canEditOrDelete(message)
            const canDelete = isOwnMessage || isServerOwner
            const isEditing = editingMessageId === message.id
            const urls = extractUrls(message.content)
            const messageIsGif =
              urls.length === 1 && isGifUrl(urls[0]) && message.content === urls[0]
            const cleanedContent = removeUrlsFromText(message.content)

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
                        </span>
                        {message.isEdited && (
                          <span className="text-grey-600 text-xs px-2 py-0.5 bg-grey-850 border border-grey-700">
                            edited
                          </span>
                        )}
                      </div>

                      {/* Reply indicator */}
                      {message.replyTo && (
                        <div className="mb-2 pl-3 border-l-2 border-grey-700 bg-grey-850/50 p-2 text-sm">
                          <div className="flex items-center gap-1 mb-1">
                            <ReplyIcon className="w-3 h-3 text-grey-500" />
                            <span className="text-grey-400 font-bold text-xs">
                              {isUserBlocked(message.replyTo.user.id)
                                ? 'Blocked User'
                                : message.replyTo.user.username}
                            </span>
                          </div>
                          <p className="text-grey-400 text-xs truncate">
                            {isUserBlocked(message.replyTo.user.id)
                              ? '[This user is blocked]'
                              : removeUrlsFromText(message.replyTo.content)}
                          </p>
                        </div>
                      )}

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
                          {/* Display GIF if message is just a GIF URL */}
                          {messageIsGif ? (
                            <div className="max-w-md">
                              <div className="bg-grey-850 border-2 border-grey-700 overflow-hidden">
                                <img
                                  src={urls[0]}
                                  alt="GIF"
                                  className="w-full h-auto max-h-96 object-contain"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              {cleanedContent && (
                                <p className="text-grey-100 break-words whitespace-pre-wrap">
                                  {isUserBlocked(message.userId)
                                    ? '[This user is blocked]'
                                    : cleanedContent}
                                </p>
                              )}
                              {/* Display media embeds for URLs in the message */}
                              {urls.map((url, urlIndex) => (
                                <MediaEmbed key={`${message.id}-${urlIndex}`} url={url} />
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {!isEditing && (
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
                            <button
                              onClick={() => handleReplyTo(message)}
                              className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors"
                            >
                              <ReplyIcon className="w-4 h-4" />
                              Reply
                            </button>
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
                      {/* Reply indicator for condensed messages */}
                      {message.replyTo && (
                        <div className="mb-2 pl-3 border-l-2 border-grey-700 bg-grey-850/50 p-2 text-sm">
                          <div className="flex items-center gap-1 mb-1">
                            <ReplyIcon className="w-3 h-3 text-grey-500" />
                            <span className="text-grey-400 font-bold text-xs">
                              {isUserBlocked(message.replyTo.user.id)
                                ? 'Blocked User'
                                : message.replyTo.user.username}
                            </span>
                          </div>
                          <p className="text-grey-400 text-xs truncate">
                            {isUserBlocked(message.replyTo.user.id)
                              ? '[This user is blocked]'
                              : removeUrlsFromText(message.replyTo.content)}
                          </p>
                        </div>
                      )}

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
                          {messageIsGif ? (
                            <div className="max-w-md">
                              <div className="bg-grey-850 border-2 border-grey-700 overflow-hidden">
                                <img
                                  src={urls[0]}
                                  alt="GIF"
                                  className="w-full h-auto max-h-96 object-contain"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              {cleanedContent && (
                                <p className="text-grey-100 break-words whitespace-pre-wrap inline">
                                  {isUserBlocked(message.userId)
                                    ? '[This user is blocked]'
                                    : cleanedContent}
                                </p>
                              )}
                              {message.isEdited && (
                                <span className="text-grey-600 text-xs ml-2 px-2 py-0.5 bg-grey-850 border border-grey-700 align-middle">
                                  edited
                                </span>
                              )}
                              {urls.map((url, urlIndex) => (
                                <MediaEmbed key={`${message.id}-${urlIndex}`} url={url} />
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {!isEditing && (
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
                            <button
                              onClick={() => handleReplyTo(message)}
                              className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors"
                            >
                              <ReplyIcon className="w-4 h-4" />
                              Reply
                            </button>
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
      <div className="border-t-2 border-grey-800 flex-shrink-0">
        {/* Reply Indicator */}
        {replyingTo && (
          <div className="px-4 pt-3 pb-2 bg-grey-850 border-b-2 border-grey-800 animate-slide-down">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ReplyIcon className="w-4 h-4 text-grey-400 flex-shrink-0" />
                  <span className="text-grey-300 text-sm font-bold">
                    Replying to {replyingTo.user?.username}
                  </span>
                </div>
                <p className="text-grey-400 text-xs truncate pl-6">{replyingTo.content}</p>
              </div>
              <button
                onClick={cancelReply}
                className="p-1 hover:bg-grey-800 text-grey-400 hover:text-white transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4">
          <form onSubmit={handleSendMessage} className="relative">
            <textarea
              ref={inputRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${selectedChannel.name}`}
              className="w-full bg-grey-850 border-2 border-grey-700 px-4 py-3 pr-32 text-white resize-none focus:border-white"
              rows={1}
              maxLength={2000}
              style={{
                minHeight: '48px',
                maxHeight: '200px',
                height: 'auto',
              }}
            />

            {/* Action Buttons */}
            <div className="absolute right-2 top-[10px] flex items-center gap-1 z-10">
              <button
                type="button"
                onClick={() => setShowGifPicker(!showGifPicker)}
                className="h-8 w-8 flex items-center justify-center hover:bg-grey-800 text-grey-400 hover:text-white transition-colors border-2 border-transparent hover:border-grey-600"
                title="Send GIF"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="h-8 w-8 flex items-center justify-center hover:bg-grey-800 text-grey-400 hover:text-white transition-colors border-2 border-transparent hover:border-grey-600"
                title="Add emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="h-8 w-8 flex items-center justify-center bg-white text-black hover:bg-grey-100 disabled:bg-grey-700 disabled:text-grey-500 disabled:cursor-not-allowed transition-colors border-2 border-transparent"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          <p className="text-grey-600 text-xs mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* GIF Picker */}
      <GifPicker
        isOpen={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelectGif={handleGifSelect}
      />

      {/* Emoji Picker */}
      <EmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={handleEmojiSelect}
      />

      {/* Members Modal */}
      <MembersModal
        key={`members-mobile-${server?.id}-${server?.members?.length || 0}`}
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        server={server}
      />
    </div>
  )
}

export default ChatArea
