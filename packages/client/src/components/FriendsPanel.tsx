import React, { useEffect, useState } from 'react'
import {
  UserPlus,
  Check,
  X,
  Trash2,
  Ban,
  Search,
  MessageSquare,
  ArrowLeft,
  Send,
  MoreVertical,
  Edit2,
} from 'lucide-react'
import { useFriendsStore } from '../stores/friends'
import { useAuthStore } from '../stores/auth'
import { useDirectMessagesStore } from '../stores/directMessages'
import { apiService, type DirectMessage } from '../services/api'

interface FriendsPanelProps {
  selectedDMUserId?: number | null
}

const FriendsPanel: React.FC<FriendsPanelProps> = ({ selectedDMUserId }) => {
  const { user } = useAuthStore()
  const {
    friends,
    receivedRequests,
    sentRequests,
    blockedUsers,
    fetchFriends,
    fetchReceivedRequests,
    fetchSentRequests,
    fetchBlockedUsers,
    sendFriendRequest,
    respondToRequest,
    cancelRequest,
    removeFriend,
    blockUser,
    unblockUser,
  } = useFriendsStore()
  const messages = useDirectMessagesStore((state) => state.messages)
  const conversations = useDirectMessagesStore((state) => state.conversations)

  const {
    setActiveConversation,
    fetchConversation,
    fetchConversations,
    sendDirectMessage,
    editDirectMessage,
    deleteDirectMessage,
    markConversationAsRead,
  } = useDirectMessagesStore()

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'blocked' | 'messages'>('all')
  const [messageInput, setMessageInput] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [contextMenuMessageId, setContextMenuMessageId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')
  const [conversationMessages, setConversationMessages] = useState<DirectMessage[]>([])

  const selectedFriend = friends.find((f) => f.id === selectedDMUserId)

  // Update conversation messages when messages or selectedDMUserId changes
  useEffect(() => {
    const newMessages = selectedDMUserId ? messages[selectedDMUserId] || [] : []
    setConversationMessages(newMessages)
  }, [messages, selectedDMUserId])

  // Poll for new messages when DM conversation is active
  useEffect(() => {
    if (!selectedDMUserId) return

    const pollInterval = setInterval(async () => {
      try {
        await fetchConversation(selectedDMUserId)
      } catch (error) {
        console.error('Error polling for DM messages:', error)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [selectedDMUserId, fetchConversation])

  useEffect(() => {
    if (user) {
      fetchFriends(user.id)
      fetchReceivedRequests()
      fetchSentRequests()
      fetchBlockedUsers(user.id)
      fetchConversations()
    }
  }, [
    user,
    fetchFriends,
    fetchReceivedRequests,
    fetchSentRequests,
    fetchBlockedUsers,
    fetchConversations,
  ])

  // Fetch conversation when DM user is selected
  useEffect(() => {
    if (selectedDMUserId) {
      setActiveConversation(selectedDMUserId)
      setActiveTab('messages')
      fetchConversation(selectedDMUserId)
      markConversationAsRead(selectedDMUserId)
    }
    return () => {
      if (selectedDMUserId) {
        setActiveConversation(null)
      }
    }
  }, [selectedDMUserId, setActiveConversation, fetchConversation, markConversationAsRead])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setError('')

    try {
      const users = await apiService.findAll()
      const filtered = users.filter(
        (u) => u.username.toLowerCase().includes(searchQuery.toLowerCase()) && u.id !== user?.id
      )
      setSearchResults(filtered)
    } catch (err) {
      setError('Failed to search users')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSendRequest = async (receiverId: number) => {
    try {
      await sendFriendRequest(receiverId)
      setSearchResults([])
      setSearchQuery('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send friend request')
    }
  }

  const handleAcceptRequest = async (requestId: number) => {
    try {
      await respondToRequest(requestId, 'accepted')
      if (user) {
        // Refresh both friends list and pending requests
        await fetchFriends(user.id)
        await fetchReceivedRequests()
        await fetchSentRequests()
      }
    } catch (err) {
      setError('Failed to accept friend request')
    }
  }

  const handleRejectRequest = async (requestId: number) => {
    try {
      await respondToRequest(requestId, 'rejected')
      // Refresh pending requests after rejecting
      await fetchReceivedRequests()
      await fetchSentRequests()
    } catch (err) {
      setError('Failed to reject friend request')
    }
  }

  const handleStartDM = async (friendId: number) => {
    try {
      // This function is now handled by the parent component
      // The selectedDMUserId is passed as a prop
      setActiveTab('messages')
      await fetchConversation(friendId)
      await fetchConversations()
    } catch (err) {
      setError('Failed to start conversation')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleBackFromDM = () => {
    // This is now handled by the parent component
    setActiveTab('all')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDMUserId || !messageInput.trim()) return

    try {
      await sendDirectMessage(selectedDMUserId, messageInput.trim())
      setMessageInput('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleEditMessage = async (messageId: number) => {
    if (!editContent.trim()) return

    try {
      await editDirectMessage(messageId, editContent.trim())
      setEditingMessageId(null)
      setEditContent('')
    } catch (error) {
      console.error('Failed to edit message:', error)
    }
  }

  const handleDeleteMessage = async (message: DirectMessage) => {
    if (!selectedDMUserId) return

    try {
      await deleteDirectMessage(message.id, message.senderId, message.receiverId)
      setContextMenuMessageId(null)
    } catch (error) {
      console.error('Failed to delete message:', error)
    }
  }

  const canEditOrDelete = (message: DirectMessage) => {
    if (!user) return false
    const isOwner = message.senderId === user.id
    const timeSinceCreation = Date.now() - new Date(message.createdAt).getTime()
    const fifteenMinutes = 15 * 60 * 1000
    return isOwner && timeSinceCreation <= fifteenMinutes
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatDate = (date: string) => {
    const messageDate = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return messageDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }
  }

  const groupMessagesByDate = (msgs: DirectMessage[]) => {
    const groups: { [key: string]: DirectMessage[] } = {}

    msgs.forEach((message) => {
      const date = new Date(message.createdAt).toDateString()
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(message)
    })

    return Object.entries(groups).map(([, messages]) => ({
      date: formatDate(messages[0].createdAt),
      messages,
    }))
  }

  const handleCancelRequest = async (requestId: number) => {
    try {
      await cancelRequest(requestId)
    } catch (err) {
      setError('Failed to cancel friend request')
    }
  }

  const handleRemoveFriend = async (friendId: number) => {
    if (!user) return
    try {
      await removeFriend(user.id, friendId)
    } catch (err) {
      setError('Failed to remove friend')
    }
  }

  const handleBlockUser = async (userId: number) => {
    if (!user) return
    try {
      await blockUser(user.id, userId)
      if (user) {
        fetchFriends(user.id)
      }
    } catch (err) {
      setError('Failed to block user')
    }
  }

  const handleUnblockUser = async (userId: number) => {
    if (!user) return
    try {
      await unblockUser(user.id, userId)
    } catch (err) {
      setError('Failed to unblock user')
    }
  }

  // Show DM interface when a conversation is selected
  if (selectedDMUserId && selectedFriend) {
    const messageGroups = groupMessagesByDate(conversationMessages)

    return (
      <div className="flex-1 bg-grey-900 flex flex-col h-full">
        {/* DM Header */}
        <div className="h-14 border-b-2 border-grey-800 px-4 flex items-center gap-3">
          <button
            onClick={handleBackFromDM}
            className="p-2 hover:bg-grey-800 transition-colors"
            title="Back to friends"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="w-8 h-8 bg-white flex items-center justify-center">
            <span className="text-black font-bold text-sm">
              {selectedFriend.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="font-bold text-white">{selectedFriend.username}</h2>
            <p className="text-grey-500 text-xs">Direct Message</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {conversationMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-white flex items-center justify-center mb-4">
                <span className="text-black font-bold text-2xl">
                  {selectedFriend.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="text-white text-lg font-bold mb-2">{selectedFriend.username}</p>
              <p className="text-grey-500 text-sm">
                This is the beginning of your direct message history with {selectedFriend.username}.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messageGroups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {/* Date Separator */}
                  <div className="flex items-center gap-4 my-4">
                    <div className="flex-1 h-[2px] bg-grey-800" />
                    <span className="text-grey-500 text-xs font-bold">{group.date}</span>
                    <div className="flex-1 h-[2px] bg-grey-800" />
                  </div>

                  {/* Messages */}
                  <div className="space-y-3">
                    {group.messages.map((message) => {
                      const isOwnMessage = message.senderId === user?.id
                      const isEditing = editingMessageId === message.id
                      const showContextMenu = contextMenuMessageId === message.id

                      return (
                        <div
                          key={message.id}
                          className={`group flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          {/* Avatar */}
                          <div className="w-10 h-10 bg-white flex-shrink-0 flex items-center justify-center">
                            <span className="text-black font-bold">
                              {isOwnMessage
                                ? user?.username.charAt(0).toUpperCase()
                                : selectedFriend.username.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          {/* Message Content */}
                          <div
                            className={`flex-1 ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-sm font-bold ${isOwnMessage ? 'text-white' : 'text-grey-300'}`}
                              >
                                {isOwnMessage ? 'You' : selectedFriend.username}
                              </span>
                              <span className="text-grey-600 text-xs">
                                {formatTime(message.createdAt)}
                              </span>
                              {message.isEdited && (
                                <span className="text-grey-600 text-xs">(edited)</span>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="w-full max-w-xl">
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      handleEditMessage(message.id)
                                    } else if (e.key === 'Escape') {
                                      setEditingMessageId(null)
                                      setEditContent('')
                                    }
                                  }}
                                  className="w-full bg-grey-850 border-2 border-grey-700 px-3 py-2 text-white resize-none focus:border-white transition-colors"
                                  rows={3}
                                  autoFocus
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => handleEditMessage(message.id)}
                                    className="px-3 py-1 bg-white text-black text-sm font-bold hover:bg-grey-100 transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingMessageId(null)
                                      setEditContent('')
                                    }}
                                    className="px-3 py-1 bg-grey-800 text-white text-sm font-bold hover:bg-grey-700 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="relative group/message">
                                <div
                                  className={`px-4 py-2 break-words max-w-xl ${
                                    isOwnMessage
                                      ? 'bg-white text-black'
                                      : 'bg-grey-850 text-white border-2 border-grey-800'
                                  }`}
                                >
                                  {message.content}
                                </div>

                                {/* Context Menu */}
                                {canEditOrDelete(message) && (
                                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2">
                                    <button
                                      onClick={() =>
                                        setContextMenuMessageId(showContextMenu ? null : message.id)
                                      }
                                      className="p-1 bg-grey-800 text-grey-300 hover:text-white opacity-0 group-hover/message:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>

                                    {showContextMenu && (
                                      <div className="absolute right-0 mt-1 bg-grey-850 border-2 border-grey-800 shadow-lg z-10 min-w-[120px]">
                                        <button
                                          onClick={() => {
                                            setEditingMessageId(message.id)
                                            setEditContent(message.content)
                                            setContextMenuMessageId(null)
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-grey-800 transition-colors flex items-center gap-2"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteMessage(message)}
                                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-grey-800 transition-colors flex items-center gap-2"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t-2 border-grey-800">
          <form onSubmit={handleSendMessage} className="relative">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e)
                }
              }}
              placeholder={`Message ${selectedFriend.username}`}
              className="w-full bg-grey-850 border-2 border-grey-800 px-4 py-3 pr-12 text-white placeholder-grey-600 resize-none focus:border-white transition-colors"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
            <button
              type="submit"
              disabled={!messageInput.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white text-black hover:bg-grey-100 disabled:bg-grey-700 disabled:text-grey-500 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-grey-900 flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b-2 border-grey-800 px-4 flex items-center">
        <h2 className="font-bold text-white text-lg">Friends</h2>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-grey-800 flex">
        <button
          onClick={() => {
            setActiveTab('all')
          }}
          className={`px-4 py-3 font-bold transition-colors ${
            activeTab === 'all'
              ? 'text-white border-b-2 border-white -mb-[2px]'
              : 'text-grey-400 hover:text-white'
          }`}
        >
          All Friends ({friends.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('messages')
          }}
          className={`px-4 py-3 font-bold transition-colors ${
            activeTab === 'messages'
              ? 'text-white border-b-2 border-white -mb-[2px]'
              : 'text-grey-400 hover:text-white'
          }`}
        >
          Messages
          {conversations.filter((c) => c.unreadCount > 0).length > 0 && (
            <span className="ml-2 bg-white text-black text-xs font-bold px-2 py-0.5 rounded-full">
              {conversations.filter((c) => c.unreadCount > 0).length}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('pending')
          }}
          className={`px-4 py-3 font-bold transition-colors ${
            activeTab === 'pending'
              ? 'text-white border-b-2 border-white -mb-[2px]'
              : 'text-grey-400 hover:text-white'
          }`}
        >
          Pending ({receivedRequests.length + sentRequests.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('blocked')
          }}
          className={`px-4 py-3 font-bold transition-colors ${
            activeTab === 'blocked'
              ? 'text-white border-b-2 border-white -mb-[2px]'
              : 'text-grey-400 hover:text-white'
          }`}
        >
          Blocked ({blockedUsers.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-900/20 border-2 border-red-500 p-3 text-red-200 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Add Friend Section */}
        {activeTab === 'all' && (
          <div className="mb-6">
            <h3 className="text-white font-bold mb-3">Add Friend</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by username..."
                className="flex-1 bg-grey-850 border-2 border-grey-700 px-4 py-2 text-white focus:border-white"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-4 py-2 bg-white text-black font-bold hover:bg-grey-100 disabled:bg-grey-700 disabled:cursor-not-allowed transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map((result) => {
                  const isFriend = friends.some((f) => f.id === result.id)
                  const hasSentRequest = sentRequests.some((r) => r.receiverId === result.id)

                  return (
                    <div
                      key={result.id}
                      className="flex items-center gap-3 p-3 bg-grey-850 border-2 border-grey-800"
                    >
                      <div className="w-10 h-10 bg-white flex items-center justify-center">
                        <span className="text-black font-bold">
                          {result.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold">{result.username}</p>
                        <p className="text-grey-500 text-sm">{result.email}</p>
                      </div>
                      {isFriend ? (
                        <span className="text-grey-500 text-sm">Already friends</span>
                      ) : hasSentRequest ? (
                        <span className="text-grey-500 text-sm">Request sent</span>
                      ) : (
                        <button
                          onClick={() => handleSendRequest(result.id)}
                          className="px-3 py-2 bg-white text-black font-bold hover:bg-grey-100 transition-colors flex items-center gap-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          Add
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="space-y-2">
            {conversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-grey-700 mx-auto mb-3" />
                <p className="text-grey-500 mb-2">No conversations yet</p>
                <p className="text-grey-600 text-sm">
                  Click the message icon next to a friend to start chatting
                </p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const hasUnread = conversation.unreadCount > 0
                const lastMessage = conversation.lastMessage

                return (
                  <button
                    key={conversation.user.id}
                    onClick={() => handleStartDM(conversation.user.id)}
                    className="w-full flex items-center gap-3 p-3 bg-grey-850 border-2 border-grey-800 hover:border-grey-700 transition-colors group text-left"
                  >
                    <div className="w-10 h-10 bg-white flex-shrink-0 flex items-center justify-center">
                      <span className="text-black font-bold">
                        {conversation.user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p
                          className={`font-bold truncate ${hasUnread ? 'text-white' : 'text-grey-300'}`}
                        >
                          {conversation.user.username}
                        </p>
                        {lastMessage && (
                          <span className="text-grey-500 text-xs flex-shrink-0">
                            {new Date(lastMessage.createdAt).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      {lastMessage && (
                        <p
                          className={`text-sm truncate ${hasUnread ? 'text-grey-300 font-medium' : 'text-grey-500'}`}
                        >
                          {lastMessage.senderId === user?.id && 'You: '}
                          {lastMessage.content.length > 40
                            ? lastMessage.content.substring(0, 40) + '...'
                            : lastMessage.content}
                        </p>
                      )}
                    </div>
                    {hasUnread && (
                      <div className="bg-white text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}

        {/* All Friends Tab */}
        {activeTab === 'all' && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-grey-500 mb-2">No friends yet</p>
                <p className="text-grey-600 text-sm">Search for users above to add friends</p>
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 p-3 bg-grey-850 border-2 border-grey-800 hover:border-grey-700 transition-colors group"
                >
                  <div className="w-10 h-10 bg-white flex items-center justify-center">
                    <span className="text-black font-bold">
                      {friend.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold">{friend.username}</p>
                    <p className="text-grey-500 text-sm">{friend.email}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartDM(friend.id)}
                      className="p-2 bg-grey-800 text-grey-400 hover:text-white hover:bg-grey-900 transition-colors"
                      title="Send message"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleBlockUser(friend.id)}
                      className="p-2 bg-grey-800 text-grey-400 hover:text-red-400 hover:bg-grey-900 transition-colors"
                      title="Block user"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="p-2 bg-grey-800 text-grey-400 hover:text-red-400 hover:bg-grey-900 transition-colors"
                      title="Remove friend"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-6">
            {/* Incoming Requests */}
            {receivedRequests.length > 0 && (
              <div>
                <h3 className="text-white font-bold mb-3">Incoming Requests</h3>
                <div className="space-y-2">
                  {receivedRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 bg-grey-850 border-2 border-grey-800"
                    >
                      <div className="w-10 h-10 bg-white flex items-center justify-center">
                        <span className="text-black font-bold">
                          {request.sender?.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold">{request.sender?.username}</p>
                        <p className="text-grey-500 text-sm">{request.sender?.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          className="p-2 bg-green-700 text-white hover:bg-green-600 transition-colors"
                          title="Accept"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="p-2 bg-red-700 text-white hover:bg-red-600 transition-colors"
                          title="Reject"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing Requests */}
            {sentRequests.length > 0 && (
              <div>
                <h3 className="text-white font-bold mb-3">Outgoing Requests</h3>
                <div className="space-y-2">
                  {sentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 bg-grey-850 border-2 border-grey-800"
                    >
                      <div className="w-10 h-10 bg-white flex items-center justify-center">
                        <span className="text-black font-bold">
                          {request.receiver?.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold">{request.receiver?.username}</p>
                        <p className="text-grey-500 text-sm">Pending...</p>
                      </div>
                      <button
                        onClick={() => handleCancelRequest(request.id)}
                        className="px-3 py-2 bg-grey-800 text-grey-300 hover:text-white hover:bg-grey-900 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {receivedRequests.length === 0 && sentRequests.length === 0 && (
              <div className="text-center py-12">
                <p className="text-grey-500">No pending friend requests</p>
              </div>
            )}
          </div>
        )}

        {/* Blocked Tab */}
        {activeTab === 'blocked' && (
          <div className="space-y-2">
            {blockedUsers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-grey-500">No blocked users</p>
              </div>
            ) : (
              blockedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 bg-grey-850 border-2 border-grey-800"
                >
                  <div className="w-10 h-10 bg-white flex items-center justify-center">
                    <span className="text-black font-bold">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold">{user.username}</p>
                    <p className="text-grey-500 text-sm">{user.email}</p>
                  </div>
                  <button
                    onClick={() => handleUnblockUser(user.id)}
                    className="px-3 py-2 bg-grey-800 text-grey-300 hover:text-white hover:bg-grey-900 transition-colors"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FriendsPanel
