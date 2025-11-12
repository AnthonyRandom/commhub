import React, { useEffect, useRef, useState } from 'react'
import { Hash, Users, Volume2, PhoneCall, ChevronDown } from 'lucide-react'
import { useMessagesStore } from '../stores/messages'
import { useAuthStore } from '../stores/auth'
import { useVoiceStore } from '../stores/voice'
import { voiceManager } from '../services/voice-manager'
import { useSettingsStore } from '../stores/settings'
import { useFriendsStore } from '../stores/friends'
import { useMentionsStore } from '../stores/mentions'
import MembersPane from './MembersPane'
import VoiceControls from './VoiceControls'
import GifPicker from './GifPicker'
import EmojiPicker from './EmojiPicker'
import { VoiceChannelParticipants } from './chat/VoiceChannelParticipants'
import { FocusedStreamView } from './chat/FocusedStreamView'
import { MessageInput } from './chat/MessageInput'
import { MessageItem } from './chat/MessageItem'
import type { Channel, Server, Message } from '../services/api'
import { apiService } from '../services/api'
import { wsService } from '../services/websocket'

interface ChatAreaProps {
  selectedChannel: Channel | null
  server: Server | null
}

const ChatArea: React.FC<ChatAreaProps> = ({ selectedChannel, server }) => {
  const [channelInputs, setChannelInputs] = useState<Map<number, string>>(new Map())
  const [showMembersPane, setShowMembersPane] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editAttachmentsToRemove, setEditAttachmentsToRemove] = useState<number[]>([])
  const [contextMenuMessageId, setContextMenuMessageId] = useState<number | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isInitialChannelLoad = useRef(true)
  const previouslyFocusedScreenSharerRef = useRef<number | null>(null)

  // Get the current channel's input value
  const messageInput = selectedChannel ? channelInputs.get(selectedChannel.id) || '' : ''

  // Update the current channel's input value
  const setMessageInput = (value: string) => {
    if (selectedChannel) {
      setChannelInputs((prev) => {
        const newMap = new Map(prev)
        if (value === '') {
          newMap.delete(selectedChannel.id)
        } else {
          newMap.set(selectedChannel.id, value)
        }
        return newMap
      })
    }
  }

  const allMessages = useMessagesStore((state) => state.messages)
  const messages = selectedChannel ? allMessages[selectedChannel.id] || [] : []
  const isLoadingOlder = useMessagesStore((state) => state.isLoadingOlder)
  const hasMoreMessages = useMessagesStore((state) => state.hasMoreMessages)
  const sendMessage = useMessagesStore((state) => state.sendMessage)
  const fetchMessages = useMessagesStore((state) => state.fetchMessages)
  const loadOlderMessages = useMessagesStore((state) => state.loadOlderMessages)
  const editMessage = useMessagesStore((state) => state.editMessage)
  const deleteMessage = useMessagesStore((state) => state.deleteMessage)
  const { user } = useAuthStore()
  const { getTimeFormat } = useSettingsStore()
  const markChannelMentionsAsRead = useMentionsStore((state) => state.markChannelMentionsAsRead)
  const { blockedUsers } = useFriendsStore()

  const {
    connectedChannelId,
    isConnecting,
    connectedUsers,
    focusedStreamUserId,
    localVideoEnabled,
    localVideoStream,
    localScreenShareEnabled,
    localScreenShareStream,
  } = useVoiceStore()
  const isVoiceChannel = selectedChannel?.type === 'voice'
  const isConnectedToVoice = connectedChannelId === selectedChannel?.id

  // Get focused user data
  const isLocalUserFocused = user && focusedStreamUserId === user.id

  let focusedUser: any = null
  let focusedStream: MediaStream | undefined

  if (isLocalUserFocused && user) {
    // For local user, construct focused user from local state
    focusedUser = {
      userId: user.id,
      username: user.username,
      hasVideo: localVideoEnabled,
      hasScreenShare: localScreenShareEnabled,
      isSpeaking: connectedUsers.get(user.id)?.isSpeaking || false,
      isMuted: useVoiceStore.getState().isMuted,
      connectionStatus: 'connected' as const,
      connectionQuality: 'excellent' as const,
      localMuted: false,
      localVolume: 1.0,
    }

    // Use local streams
    if (localScreenShareEnabled && localScreenShareStream) {
      focusedStream = localScreenShareStream
    } else if (localVideoEnabled && localVideoStream) {
      focusedStream = localVideoStream
    }
  } else if (focusedStreamUserId) {
    // For remote users, use data from connectedUsers
    focusedUser = connectedUsers.get(focusedStreamUserId) || null

    if (focusedUser) {
      if (focusedUser.hasScreenShare) {
        focusedStream = focusedUser.screenShareStream || focusedUser.stream
      } else if (focusedUser.hasVideo) {
        focusedStream = focusedUser.videoStream || focusedUser.stream
      }
    }
  }

  // Helper function to check if a user is blocked
  const isUserBlocked = (userId: number) => {
    return blockedUsers.some((blockedUser) => blockedUser.id === userId)
  }

  // Fetch messages when channel changes (text channels only)
  // Note: No need to join/leave channel rooms - the 'ready' event automatically
  // joins users to all their channels for background updates (needed for @mentions, notifications, unread counts)
  useEffect(() => {
    if (selectedChannel && selectedChannel.type === 'text') {
      fetchMessages(selectedChannel.id)
      // Fetch and mark mentions as read when visiting a channel
      const { fetchChannelMentionCount, markChannelMentionsAsRead } = useMentionsStore.getState()
      fetchChannelMentionCount(selectedChannel.id)
      markChannelMentionsAsRead(selectedChannel.id)
      // Mark as initial load when switching channels
      isInitialChannelLoad.current = true
    }
  }, [selectedChannel, fetchMessages, markChannelMentionsAsRead])

  // Auto-scroll to bottom when messages are first loaded for a channel
  useEffect(() => {
    if (selectedChannel && messages.length > 0 && isInitialChannelLoad.current) {
      // Use requestAnimationFrame to ensure DOM has painted, then scroll
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
          isInitialChannelLoad.current = false
        })
      })
    }
  }, [selectedChannel?.id, messages.length])

  // Initialize voice manager
  useEffect(() => {
    voiceManager.initialize()
  }, [])

  // Control screen share audio based on focused stream
  useEffect(() => {
    // Only enable screen share audio for the focused user (if any)
    // When no user is focused (null), all screen share audio is disabled
    if (focusedStreamUserId !== undefined) {
      voiceManager.setFocusedUserScreenShareAudio(focusedStreamUserId)

      // Notify the screen sharer when someone focuses on their stream (only once per focus session)
      if (focusedStreamUserId !== null) {
        const focusedUser = connectedUsers.get(focusedStreamUserId)
        if (
          focusedUser?.hasScreenShare &&
          focusedStreamUserId !== previouslyFocusedScreenSharerRef.current
        ) {
          // Update the previously focused screen sharer
          previouslyFocusedScreenSharerRef.current = focusedStreamUserId

          // Emit event to notify the screen sharer
          const socket = wsService.getSocket()
          if (socket) {
            socket.emit('screen-share-focused', {
              userId: focusedStreamUserId,
              channelId: connectedChannelId,
            })
          }
        }
      } else if (focusedStreamUserId === null) {
        // Reset when focus is cleared
        previouslyFocusedScreenSharerRef.current = null
      }
    }
  }, [focusedStreamUserId, connectedUsers, connectedChannelId])

  // Auto-scroll to bottom when new messages arrive (but not when loading older messages or user is scrolled up)
  useEffect(() => {
    if (messages.length > 0 && !isLoadingOlder[selectedChannel?.id || 0] && !isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoadingOlder, selectedChannel?.id, isScrolledUp])

  // Handle scroll to load older messages and track scroll position
  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (!container || !selectedChannel) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isNearTop = scrollTop < 100 // Load when within 100px of top
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const isScrolledUpSignificantly = distanceFromBottom > 200 // More than 200px from bottom

    // Update scroll state
    setIsScrolledUp(isScrolledUpSignificantly)

    // Load older messages if near top
    if (isNearTop && hasMoreMessages[selectedChannel.id] && !isLoadingOlder[selectedChannel.id]) {
      loadOlderMessages(selectedChannel.id)
    }
  }

  // Jump to bottom of messages
  const jumpToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsScrolledUp(false)
  }

  // Reset scroll state when switching channels
  useEffect(() => {
    if (selectedChannel) {
      setIsScrolledUp(false)
    }
  }, [selectedChannel])

  const handleSendMessage = async (
    e: React.FormEvent,
    attachments?: Array<{ url: string; filename: string; mimeType: string; size: number }>
  ) => {
    e.preventDefault()
    if (!selectedChannel || (!messageInput.trim() && !attachments?.length)) return

    const channelId = selectedChannel.id
    try {
      await sendMessage(channelId, messageInput.trim(), replyingTo?.id, attachments)
      // Clear this channel's input
      setChannelInputs((prev) => {
        const newMap = new Map(prev)
        newMap.delete(channelId)
        return newMap
      })
      setReplyingTo(null)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleGifSelect = async (gifUrl: string) => {
    if (!selectedChannel) return

    const channelId = selectedChannel.id
    try {
      await sendMessage(channelId, gifUrl, replyingTo?.id)
      setReplyingTo(null)
      setShowGifPicker(false)
    } catch (error) {
      console.error('Failed to send GIF:', error)
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(messageInput + emoji)
  }

  const handleReplyTo = (message: Message) => {
    setReplyingTo(message)
    setContextMenuMessageId(null)
  }

  const cancelReply = () => {
    setReplyingTo(null)
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
    // Allow saving if content exists OR attachments are being removed
    // But require at least one of them (content or remaining attachments)
    const message = messages.find((m) => m.id === messageId)
    const hasRemainingAttachments =
      message?.attachments &&
      message.attachments.filter((att) => !editAttachmentsToRemove.includes(att.id)).length > 0

    if (!editContent.trim() && editAttachmentsToRemove.length === 0 && !hasRemainingAttachments) {
      return
    }

    try {
      // Delete attachments that were removed
      for (const attachmentId of editAttachmentsToRemove) {
        try {
          await apiService.deleteAttachment(attachmentId)
        } catch (error) {
          console.error('Failed to delete attachment:', error)
        }
      }

      // Update message content (send empty string if no content but attachments remain)
      const contentToSave = editContent.trim() || ''
      await editMessage(messageId, contentToSave)

      setEditingMessageId(null)
      setEditContent('')
      setEditAttachmentsToRemove([])
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
    setEditAttachmentsToRemove([])
    setContextMenuMessageId(null)
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditContent('')
    setEditAttachmentsToRemove([])
  }

  const handleRemoveAttachmentFromEdit = (attachmentId: number) => {
    setEditAttachmentsToRemove((prev) => [...prev, attachmentId])
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

  const isServerOwner = !!(server && user && server.ownerId === user.id)

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuMessageId !== null) {
        const target = event.target as HTMLElement
        // Check if click is outside the context menu
        if (!target.closest('.context-menu') && !target.closest('.context-menu-trigger')) {
          setContextMenuMessageId(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenuMessageId])

  // Server member updates are handled via WebSocket in real-time
  // No polling needed - WebSocket events automatically update server members

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

  const formatTimeOnly = (timestamp: string) => {
    const date = new Date(timestamp)
    const formatTime = getTimeFormat()
    return formatTime(date)
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
      <div className="flex-1 bg-grey-900 flex h-full">
        <div className="flex-1 flex flex-col h-full">
          {/* Channel Header */}
          <div className="h-14 border-b-2 border-grey-800 px-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-grey-400" />
              <h2 className="font-bold text-white text-lg">{selectedChannel.name}</h2>
            </div>
            {server && (
              <button
                onClick={() => setShowMembersPane(!showMembersPane)}
                className={`p-2 transition-colors border-2 ${
                  showMembersPane
                    ? 'text-white bg-grey-850 border-grey-700'
                    : 'text-grey-400 hover:text-white hover:bg-grey-850 border-transparent hover:border-grey-700'
                }`}
                title={showMembersPane ? 'Hide Members' : 'Show Members'}
              >
                <Users className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Voice Channel Content */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto relative">
            {!isConnectedToVoice && !isConnecting ? (
              <div className="text-center max-w-md">
                <div className="w-24 h-24 bg-grey-850 border-2 border-grey-700 flex items-center justify-center mx-auto mb-6">
                  <Volume2 className="w-12 h-12 text-grey-600" />
                </div>
                <h2 className="text-white text-2xl font-bold mb-3">{selectedChannel.name}</h2>
                <p className="text-grey-400 mb-6">
                  Join this voice channel to talk with others in real-time. Make sure your
                  microphone is working.
                </p>
                <button
                  onClick={handleJoinVoice}
                  className="px-6 py-3 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-bold flex items-center gap-2 mx-auto"
                >
                  <PhoneCall className="w-5 h-5" />
                  Join Voice Channel
                </button>
              </div>
            ) : focusedUser && focusedStreamUserId ? (
              <FocusedStreamView
                user={focusedUser}
                stream={focusedStream}
                isScreenShare={focusedUser.hasScreenShare}
                onClose={() => useVoiceStore.getState().setFocusedStreamUserId(null)}
              />
            ) : (
              <VoiceChannelParticipants />
            )}
          </div>

          {/* Voice Controls (shown when connected) */}
          {isConnectedToVoice && <VoiceControls channel={selectedChannel} />}
        </div>

        {/* Members Pane */}
        {server && <MembersPane isOpen={showMembersPane} server={server} />}
      </div>
    )
  }

  // Text Channel UI (existing code continues below)

  return (
    <div className="flex-1 bg-grey-900 flex h-full">
      <div className="flex-1 flex flex-col h-full">
        {/* Channel Header */}
        <div className="h-14 border-b-2 border-grey-800 px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-grey-400" />
            <h2 className="font-bold text-white text-lg">{selectedChannel.name}</h2>
          </div>
          {server && (
            <button
              onClick={() => setShowMembersPane(!showMembersPane)}
              className={`p-2 transition-colors border-2 ${
                showMembersPane
                  ? 'text-white bg-grey-850 border-grey-700'
                  : 'text-grey-400 hover:text-white hover:bg-grey-850 border-transparent hover:border-grey-700'
              }`}
              title={showMembersPane ? 'Hide Members' : 'Show Members'}
            >
              <Users className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 relative"
          onScroll={handleScroll}
        >
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
            <div>
              {/* Loading indicator for older messages */}
              {selectedChannel && isLoadingOlder[selectedChannel.id] && (
                <div className="flex justify-center py-4">
                  <div className="text-grey-400 text-sm">Loading older messages...</div>
                </div>
              )}

              {messages.map((message, index) => {
                const isOwnMessage = message.user?.id === user?.id
                const previousMessage = index > 0 ? messages[index - 1] : null
                const showUserInfo = shouldSeparateMessages(message, previousMessage, index)
                const canModify = canEditOrDelete(message)
                const canDelete = isOwnMessage || isServerOwner
                const isEditing = editingMessageId === message.id

                return (
                  <MessageItem
                    key={`message-${message.id}-${index}`}
                    message={message}
                    showUserInfo={showUserInfo}
                    isOwnMessage={isOwnMessage}
                    canModify={canModify}
                    canDelete={canDelete}
                    isEditing={isEditing}
                    editContent={editContent}
                    setEditContent={setEditContent}
                    onEditMessage={handleEditMessage}
                    onCancelEditing={cancelEditing}
                    onDeleteMessage={handleDeleteMessage}
                    onReplyTo={handleReplyTo}
                    onStartEditing={startEditingMessage}
                    formatTimestamp={formatTimestamp}
                    formatTimeOnly={formatTimeOnly}
                    isUserBlocked={isUserBlocked}
                    contextMenuMessageId={contextMenuMessageId}
                    setContextMenuMessageId={setContextMenuMessageId}
                    editAttachmentsToRemove={editAttachmentsToRemove}
                    onRemoveAttachmentFromEdit={handleRemoveAttachmentFromEdit}
                  />
                )
              })}
            </div>
          )}

          {/* Jump to bottom button */}
          {isScrolledUp && (
            <button
              onClick={jumpToBottom}
              className="absolute bottom-4 right-4 bg-grey-800 hover:bg-grey-700 text-grey-300 hover:text-white p-2 rounded border-2 border-grey-700 hover:border-grey-600 transition-all duration-200 ease-in-out animate-slide-up z-10"
              title="Jump to bottom"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <MessageInput
          messageInput={messageInput}
          setMessageInput={setMessageInput}
          replyingTo={replyingTo}
          onSend={handleSendMessage}
          onGifClick={() => setShowGifPicker(!showGifPicker)}
          onEmojiClick={() => setShowEmojiPicker(!showEmojiPicker)}
          onCancelReply={cancelReply}
          channelName={selectedChannel.name}
          channelId={selectedChannel.id}
        />

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
      </div>

      {/* Members Pane */}
      {server && <MembersPane isOpen={showMembersPane} server={server} />}
    </div>
  )
}

export default ChatArea
