import React from 'react'
import { X, Crown } from 'lucide-react'
import type { Server } from '../services/api'
import StatusIndicator from './StatusIndicator'

interface MembersModalProps {
  isOpen: boolean
  onClose: () => void
  server: Server | null
}

const MembersModal: React.FC<MembersModalProps> = ({ isOpen, onClose, server }) => {
  if (!isOpen || !server) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-grey-900 border-2 border-white w-96 max-h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="border-b-2 border-grey-800 p-4 flex items-center justify-between">
          <h3 className="font-bold text-white text-lg">Members — {server.name}</h3>
          <button
            onClick={onClose}
            className="p-1 text-grey-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
        <div className="border-t-2 border-grey-800 p-4">
          <p className="text-grey-400 text-sm text-center">
            {server.members?.length || 0} member{server.members?.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default MembersModal
