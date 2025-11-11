import React from 'react'
import { Crown } from 'lucide-react'
import type { Server } from '../services/api'
import StatusIndicator from './StatusIndicator'

interface MembersPaneProps {
  isOpen: boolean
  server: Server | null
}

const MembersPane: React.FC<MembersPaneProps> = ({ isOpen, server }) => {
  if (!server) return null

  return (
    <div
      className={`
        bg-grey-900 border-l-2 border-grey-800 flex flex-col h-full flex-shrink-0
        transition-all duration-300 ease-in-out overflow-hidden
        ${isOpen ? 'w-64 opacity-100' : 'w-0 min-w-0 opacity-0 pointer-events-none border-l-0'}
      `}
    >
      {/* Header */}
      <div className="border-b-2 border-grey-800 p-4 flex-shrink-0">
        <h3 className="font-bold text-white text-lg">Members — {server.name}</h3>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto p-4">
        {server.members && server.members.length > 0 ? (
          <div className="space-y-2">
            {server.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 bg-grey-850 border-2 border-grey-700 hover:border-grey-600 transition-colors"
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-white flex items-center justify-center flex-shrink-0">
                    <span className="text-black font-bold text-sm">
                      {member.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1">
                    <StatusIndicator userId={member.id} size="sm" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">{member.username}</span>
                    {server.ownerId === member.id && (
                      <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-grey-400 text-sm truncate">
                    {server.ownerId === member.id ? 'Server Owner' : 'Member'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-grey-500 py-8">
            <p>No members found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 border-grey-800 p-4 flex-shrink-0">
        <p className="text-grey-400 text-sm text-center">
          {server.members?.length || 0} member{server.members?.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}

export default MembersPane
