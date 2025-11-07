import React, { useEffect } from 'react'
import {
  Hash,
  Volume2,
  Plus,
  Settings,
  LogOut,
  Copy,
  MoreVertical,
  Edit2,
  Trash2,
  PhoneCall,
  MessageSquare,
  Users,
  X,
} from 'lucide-react'
import { useChannelsStore } from '../stores/channels'
import { useServersStore } from '../stores/servers'
import { useAuthStore } from '../stores/auth'
import { useVoiceStore } from '../stores/voice'
import { useVoiceMembersStore } from '../stores/voiceMembers'
import { apiService, type Conversation } from '../services/api'
import StatusIndicator from './StatusIndicator'
import VoiceStatus from './VoiceStatus'
import type { Channel, Server } from '../services/api'

interface ChannelListProps {
  server: Server | null
  selectedChannel: Channel | null
  onChannelSelect: (channel: Channel) => void
  onCreateChannel: () => void
  onServerSettings: () => void
  onAppSettings: () => void
  dmConversations?: Conversation[]
  onDMSelect?: (userId: number) => void
  onDeleteDM?: (userId: number) => void
}

const ChannelList: React.FC<ChannelListProps> = ({
  server,
  selectedChannel,
  onChannelSelect,
  onCreateChannel,
  onServerSettings,
  onAppSettings,
  dmConversations = [],
  onDMSelect,
  onDeleteDM,
}) => {
  const getChannelsByServer = useChannelsStore((state) => state.getChannelsByServer)
  const fetchChannels = useChannelsStore((state) => state.fetchChannels)
  const leaveServer = useServersStore((state) => state.leaveServer)
  const getServerInviteCode = useServersStore((state) => state.getServerInviteCode)
  const { user, logout } = useAuthStore()
  const { connectedChannelId, connectedUsers } = useVoiceStore()
  const voiceChannelMembers = useVoiceMembersStore((state) => state.membersByChannel)

  const [showServerMenu, setShowServerMenu] = React.useState(false)
  const [inviteCode, setInviteCode] = React.useState<string | null>(null)
  const [copySuccess, setCopySuccess] = React.useState(false)
  const [contextMenuChannelId, setContextMenuChannelId] = React.useState<number | null>(null)
  const [editingChannel, setEditingChannel] = React.useState<Channel | null>(null)
  const [editChannelName, setEditChannelName] = React.useState('')
  const [deletingChannel, setDeletingChannel] = React.useState<Channel | null>(null)
  const [contextMenuDMId, setContextMenuDMId] = React.useState<number | null>(null)
  const [deletingDM, setDeletingDM] = React.useState<Conversation | null>(null)

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const serverChannels = server ? getChannelsByServer(server.id) : []
  const textChannels = serverChannels.filter((ch) => ch.type === 'text')
  const voiceChannels = serverChannels.filter((ch) => ch.type === 'voice')

  // Find the current voice channel the user is connected to
  const currentVoiceChannel = connectedChannelId
    ? serverChannels.find((ch) => ch.id === connectedChannelId && ch.type === 'voice')
    : null

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleLeaveServer = async () => {
    if (!server) return
    try {
      await leaveServer(server.id)
      setShowServerMenu(false)
    } catch (error) {
      console.error('Failed to leave server:', error)
    }
  }

  const handleGetInviteCode = async () => {
    if (!server) return
    try {
      const code = await getServerInviteCode(server.id)
      setInviteCode(code)
    } catch (error) {
      console.error('Failed to get invite code:', error)
    }
  }

  const handleCopyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel)
    setEditChannelName(channel.name)
    setContextMenuChannelId(null)
  }

  const handleSaveChannelEdit = async () => {
    if (!editingChannel || !editChannelName.trim()) return

    try {
      await apiService.updateChannel(editingChannel.id, { name: editChannelName.trim() })
      await fetchChannels()
      setEditingChannel(null)
      setEditChannelName('')
    } catch (error) {
      console.error('Failed to update channel:', error)
    }
  }

  const handleDeleteChannel = (channel: Channel) => {
    setDeletingChannel(channel)
    setContextMenuChannelId(null)
  }

  const confirmDeleteChannel = async () => {
    if (!deletingChannel) return

    try {
      await apiService.deleteChannel(deletingChannel.id)
      await fetchChannels()
      setDeletingChannel(null)
    } catch (error) {
      console.error('Failed to delete channel:', error)
    }
  }

  const handleCloseDM = (conversation: Conversation) => {
    setDeletingDM(conversation)
    setContextMenuDMId(null)
  }

  const confirmCloseDM = async () => {
    if (!deletingDM || !onDeleteDM) return

    try {
      // Just close the conversation - it can be reopened by messaging the friend
      onDeleteDM(deletingDM.user.id)
      setDeletingDM(null)
    } catch (error) {
      console.error('Failed to close DM conversation:', error)
    }
  }

  const isOwner = server && user && server.ownerId === user.id

  return (
    <div className="w-60 bg-grey-900 border-r-2 border-grey-800 flex flex-col h-full">
      {/* Server Header */}
      <div className="relative">
        <div className="w-full h-14 px-4 flex items-center justify-between border-b-2 border-grey-800">
          <span className="font-bold text-white text-lg truncate">
            {server ? server.name : 'Direct Messages'}
          </span>
          {server && (
            <button
              onClick={() => setShowServerMenu(!showServerMenu)}
              className="p-2 text-grey-400 hover:text-white hover:bg-grey-850 transition-colors border-2 border-transparent hover:border-grey-700"
              title="Server Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Server Dropdown Menu */}
        {showServerMenu && (
          <div className="absolute top-full left-0 right-0 bg-grey-850 border-2 border-grey-700 z-50 animate-slide-down">
            {server && (
              <>
                {server.ownerId === user?.id && (
                  <>
                    <button
                      onClick={() => {
                        handleGetInviteCode()
                        setShowServerMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-white hover:bg-grey-800 flex items-center gap-2 border-b border-grey-700"
                    >
                      <Copy className="w-4 h-4" />
                      Invite People
                    </button>
                    <button
                      onClick={onServerSettings}
                      className="w-full px-4 py-3 text-left text-white hover:bg-grey-800 flex items-center gap-2 border-b border-grey-700"
                    >
                      <Settings className="w-4 h-4" />
                      Server Settings
                    </button>
                  </>
                )}
                <button
                  onClick={handleLeaveServer}
                  className="w-full px-4 py-3 text-left text-red-500 hover:bg-grey-800 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Leave Server
                </button>
              </>
            )}
          </div>
        )}

        {/* Invite Code Modal */}
        {inviteCode && server?.ownerId === user?.id && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-grey-900 border-2 border-white w-96 animate-slide-up">
              <div className="border-b-2 border-grey-800 p-4">
                <h3 className="font-bold text-white text-lg">Invite Friends</h3>
              </div>
              <div className="p-4">
                <p className="text-grey-300 text-sm mb-4">
                  Share this code with your friends to invite them to {server?.name}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteCode}
                    readOnly
                    className="flex-1 bg-grey-850 border-2 border-grey-700 px-3 py-2 text-white font-mono"
                  />
                  <button
                    onClick={handleCopyInviteCode}
                    className="px-4 py-2 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-medium"
                  >
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="border-t-2 border-grey-800 p-4 flex justify-end">
                <button
                  onClick={() => setInviteCode(null)}
                  className="px-4 py-2 bg-grey-800 text-white border-2 border-grey-700 hover:border-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Channels Section */}
      <div className="flex-1 overflow-y-auto p-2">
        {server ? (
          <>
            {/* Text Channels */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <h3 className="text-grey-400 text-xs font-bold uppercase tracking-wider">
                  Text Channels
                </h3>
                <button
                  onClick={() => onCreateChannel()}
                  className="text-grey-400 hover:text-white transition-colors"
                  title="Create Channel"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                {textChannels.map((channel) => (
                  <div key={channel.id} className="group relative flex items-center">
                    <button
                      onClick={() => onChannelSelect(channel)}
                      className={`
                        flex-1 px-2 py-2 flex items-center gap-2
                        border-2 transition-all duration-100
                        ${
                          selectedChannel?.id === channel.id
                            ? 'bg-white text-black border-white'
                            : 'bg-transparent text-grey-300 border-transparent hover:border-grey-700 hover:bg-grey-850'
                        }
                      `}
                    >
                      <Hash className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate text-sm font-medium flex-1 text-left">
                        {channel.name}
                      </span>
                    </button>
                    {isOwner && (
                      <div
                        className={`absolute right-2 ${selectedChannel?.id === channel.id ? 'text-black' : 'text-white'}`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setContextMenuChannelId(
                              contextMenuChannelId === channel.id ? null : channel.id
                            )
                          }}
                          className={`opacity-0 group-hover:opacity-100 p-1 transition-opacity ${
                            selectedChannel?.id === channel.id
                              ? 'hover:bg-white hover:text-black'
                              : 'hover:bg-grey-800'
                          }`}
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {contextMenuChannelId === channel.id && isOwner && (
                      <>
                        {/* Backdrop to close menu on outside click */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setContextMenuChannelId(null)}
                        />
                        <div className="absolute right-0 top-full bg-grey-900 border-2 border-grey-700 z-50 min-w-[150px] animate-fade-in">
                          <button
                            onClick={() => handleEditChannel(channel)}
                            className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteChannel(channel)}
                            className="w-full px-4 py-2 text-left text-red-400 hover:bg-grey-800 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Voice Channels */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <h3 className="text-grey-400 text-xs font-bold uppercase tracking-wider">
                  Voice Channels
                </h3>
              </div>
              <div className="space-y-1">
                {voiceChannels.map((channel) => {
                  const isConnected = connectedChannelId === channel.id
                  const channelMembers = voiceChannelMembers[channel.id] || []
                  const hasMember = channelMembers.length > 0

                  return (
                    <div key={channel.id} className="relative">
                      <button
                        onClick={() => onChannelSelect(channel)}
                        className={`
                          w-full px-2 py-2 flex items-center gap-2
                          border-2 transition-all duration-100
                          ${
                            selectedChannel?.id === channel.id
                              ? 'bg-white text-black border-white'
                              : isConnected
                                ? 'bg-grey-850 text-white border-grey-700'
                                : hasMember
                                  ? 'bg-grey-900 text-white border-grey-700'
                                  : 'bg-transparent text-grey-300 border-transparent hover:border-grey-700 hover:bg-grey-850'
                          }
                        `}
                      >
                        <Volume2 className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate text-sm font-medium flex-1 text-left">
                          {channel.name}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {hasMember && (
                            <div
                              className={`flex items-center gap-1 px-1.5 py-0.5 border ${
                                selectedChannel?.id === channel.id
                                  ? 'bg-white text-black border-white'
                                  : 'bg-grey-800 text-grey-300 border-grey-700'
                              }`}
                            >
                              <Users className="w-3 h-3" />
                              <span className="text-xs font-bold">{channelMembers.length}</span>
                            </div>
                          )}
                          {isConnected && <PhoneCall className="w-3 h-3 animate-pulse" />}
                        </div>
                      </button>

                      {/* Voice Channel Members List */}
                      {hasMember && channelMembers.length > 0 && (
                        <div className="ml-6 mt-1 space-y-1">
                          {channelMembers.slice(0, 5).map((member) => {
                            const voiceUser = connectedUsers.get(member.userId)
                            const isSpeaking = voiceUser?.isSpeaking || false

                            return (
                              <div key={member.userId} className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 transition-colors ${
                                    selectedChannel?.id === channel.id
                                      ? `bg-white border-white ${isSpeaking ? 'ring-2 ring-green-400' : ''}`
                                      : `bg-grey-700 border-grey-600 ${isSpeaking ? 'ring-2 ring-green-400' : ''}`
                                  }`}
                                >
                                  <span
                                    className={`text-xs font-bold ${
                                      selectedChannel?.id === channel.id
                                        ? 'text-black'
                                        : 'text-grey-300'
                                    }`}
                                  >
                                    {member.username.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs truncate flex-1 ${
                                    selectedChannel?.id === channel.id
                                      ? 'text-white'
                                      : 'text-grey-400'
                                  }`}
                                >
                                  {member.username}
                                </span>
                              </div>
                            )
                          })}
                          {channelMembers.length > 5 && (
                            <div
                              className={`text-xs ml-6 ${
                                selectedChannel?.id === channel.id
                                  ? 'text-grey-300'
                                  : 'text-grey-500'
                              }`}
                            >
                              +{channelMembers.length - 5} more
                            </div>
                          )}
                        </div>
                      )}

                      {/* Show connected users when hovering (keep for additional info) */}
                      {hasMember && !isConnected && (
                        <div className="absolute left-full top-0 ml-2 z-50 hidden group-hover:block">
                          <div className="bg-grey-900 border-2 border-grey-700 p-2 min-w-[150px] animate-fade-in">
                            <p className="text-grey-400 text-xs font-bold uppercase mb-1">
                              In Voice
                            </p>
                            <div className="space-y-1">
                              {channelMembers.map((member) => (
                                <div key={member.userId} className="flex items-center gap-2">
                                  <div className="w-4 h-4 bg-grey-800 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-bold">
                                      {member.username.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="text-white text-xs truncate">
                                    {member.username}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {/* Direct Messages Header */}
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <h3 className="text-grey-400 text-xs font-bold uppercase tracking-wider">
                Direct Messages
              </h3>
            </div>

            {/* DM Conversations */}
            {dmConversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="w-12 h-12 text-grey-700 mx-auto mb-3 opacity-50" />
                <p className="text-grey-500 mb-2">No conversations yet</p>
                <p className="text-grey-600 text-sm">
                  Friends will appear here when you start chatting
                </p>
              </div>
            ) : (
              dmConversations.map((conversation) => {
                const hasUnread = conversation.unreadCount > 0
                const lastMessage = conversation.lastMessage

                return (
                  <div key={conversation.user.id} className="relative group">
                    <button
                      onClick={() => onDMSelect?.(conversation.user.id)}
                      className="w-full flex items-center gap-3 p-3 bg-grey-850 border-2 border-grey-800 hover:border-grey-700 transition-colors text-left"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-white flex-shrink-0 flex items-center justify-center">
                          <span className="text-black font-bold">
                            {conversation.user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="absolute -bottom-1 -right-1">
                          <StatusIndicator userId={conversation.user.id} size="md" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p
                            className={`font-bold truncate ${hasUnread ? 'text-white' : 'text-grey-300'}`}
                          >
                            {conversation.user.username}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {lastMessage && (
                              <span className="text-grey-500 text-xs">
                                {new Date(lastMessage.createdAt).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                            {hasUnread && (
                              <div className="bg-white text-black text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                              </div>
                            )}
                          </div>
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
                    </button>

                    {/* DM Context Menu */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setContextMenuDMId(
                            contextMenuDMId === conversation.user.id ? null : conversation.user.id
                          )
                        }}
                        className="p-2 bg-grey-800 text-grey-400 hover:text-white hover:bg-grey-900 transition-colors border-2 border-grey-700 hover:border-grey-600"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {contextMenuDMId === conversation.user.id && (
                      <>
                        {/* Backdrop to close menu on outside click */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setContextMenuDMId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-grey-900 border-2 border-grey-700 z-50 min-w-[140px] animate-fade-in shadow-lg">
                          <button
                            onClick={() => handleCloseDM(conversation)}
                            className="w-full px-4 py-3 text-left text-sm text-grey-300 hover:text-white hover:bg-grey-800 flex items-center gap-3 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Close Chat
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Edit Channel Modal */}
        {editingChannel && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-grey-900 border-2 border-white w-96 animate-slide-up">
              <div className="border-b-2 border-grey-800 p-4">
                <h3 className="font-bold text-white text-lg">Edit Channel</h3>
              </div>
              <div className="p-4">
                <label className="block text-grey-300 text-sm font-bold mb-2">Channel Name</label>
                <input
                  type="text"
                  value={editChannelName}
                  onChange={(e) => setEditChannelName(e.target.value)}
                  className="w-full bg-grey-850 border-2 border-grey-700 px-4 py-2 text-white focus:border-white"
                  maxLength={50}
                  autoFocus
                />
              </div>
              <div className="border-t-2 border-grey-800 p-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingChannel(null)
                    setEditChannelName('')
                  }}
                  className="px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChannelEdit}
                  disabled={!editChannelName.trim()}
                  className="px-4 py-2 bg-white text-black font-bold hover:bg-grey-100 disabled:bg-grey-700 disabled:text-grey-500 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Channel Modal */}
        {deletingChannel && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-grey-900 border-2 border-white w-96 animate-slide-up">
              <div className="border-b-2 border-grey-800 p-4">
                <h3 className="font-bold text-white text-lg">Delete Channel</h3>
              </div>
              <div className="p-4">
                <p className="text-grey-300 text-sm mb-4">
                  Are you sure you want to delete{' '}
                  <strong className="text-white">#{deletingChannel.name}</strong>?
                </p>
                <p className="text-red-400 text-sm">
                  This action cannot be undone. All messages in this channel will be permanently
                  deleted.
                </p>
              </div>
              <div className="border-t-2 border-grey-800 p-4 flex justify-end gap-2">
                <button
                  onClick={() => setDeletingChannel(null)}
                  className="px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteChannel}
                  className="px-4 py-2 bg-red-900 text-white border-2 border-red-700 hover:border-red-500 transition-colors font-bold"
                >
                  Delete Channel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close DM Modal */}
        {deletingDM && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-grey-900 border-2 border-white w-96 animate-slide-up">
              <div className="border-b-2 border-grey-800 p-4">
                <h3 className="font-bold text-white text-lg">Close Conversation</h3>
              </div>
              <div className="p-4">
                <p className="text-grey-300 text-sm mb-4">
                  Close your conversation with{' '}
                  <strong className="text-white">{deletingDM.user.username}</strong>?
                </p>
                <p className="text-grey-400 text-sm">
                  This will remove the conversation from your Direct Messages list. You can reopen
                  it anytime by clicking the message button on their profile in your friends list.
                </p>
              </div>
              <div className="border-t-2 border-grey-800 p-4 flex justify-end gap-2">
                <button
                  onClick={() => setDeletingDM(null)}
                  className="px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCloseDM}
                  className="px-4 py-2 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-bold"
                >
                  Close Conversation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Voice Status */}
      <VoiceStatus currentVoiceChannel={currentVoiceChannel || null} />

      {/* User Info Footer */}
      <div className="border-t-2 border-grey-800 bg-grey-950 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-black font-bold text-xs">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-medium text-sm truncate">{user?.username}</p>
            <p className="text-grey-500 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onAppSettings}
            className="p-2 text-grey-400 hover:text-white hover:bg-grey-800 transition-colors border-2 border-transparent hover:border-grey-700"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-grey-400 hover:text-red-500 hover:bg-grey-800 transition-colors border-2 border-transparent hover:border-red-500"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChannelList
