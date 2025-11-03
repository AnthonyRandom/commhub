import React, { useEffect, useState } from 'react'
import { UserPlus, Check, X, Trash2, Ban, Search } from 'lucide-react'
import { useFriendsStore } from '../stores/friends'
import { useAuthStore } from '../stores/auth'
import { apiService } from '../services/api'

const FriendsPanel: React.FC = () => {
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

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'blocked'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      fetchFriends(user.id)
      fetchReceivedRequests()
      fetchSentRequests()
      fetchBlockedUsers(user.id)
    }
  }, [user, fetchFriends, fetchReceivedRequests, fetchSentRequests, fetchBlockedUsers])

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
        fetchFriends(user.id)
      }
    } catch (err) {
      setError('Failed to accept friend request')
    }
  }

  const handleRejectRequest = async (requestId: number) => {
    try {
      await respondToRequest(requestId, 'rejected')
    } catch (err) {
      setError('Failed to reject friend request')
    }
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

  return (
    <div className="flex-1 bg-grey-900 flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b-2 border-grey-800 px-4 flex items-center">
        <h2 className="font-bold text-white text-lg">Friends</h2>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-grey-800 flex">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-3 font-bold transition-colors ${
            activeTab === 'all'
              ? 'text-white border-b-2 border-white -mb-[2px]'
              : 'text-grey-400 hover:text-white'
          }`}
        >
          All Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-3 font-bold transition-colors ${
            activeTab === 'pending'
              ? 'text-white border-b-2 border-white -mb-[2px]'
              : 'text-grey-400 hover:text-white'
          }`}
        >
          Pending ({receivedRequests.length + sentRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('blocked')}
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
