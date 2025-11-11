import React, { useEffect, useRef } from 'react'
import { User } from 'lucide-react'

interface MentionAutocompleteProps {
  users: Array<{ id: number; username: string }>
  selectedIndex: number
  onSelect: (username: string) => void
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  users,
  selectedIndex,
  onSelect,
}) => {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll selected item into view
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (users.length === 0) return null

  return (
    <div
      className="absolute bottom-full mb-2 left-0 w-64 bg-grey-900 border-2 border-grey-700 shadow-lg animate-slide-up max-h-64 overflow-y-auto z-50"
      ref={listRef}
    >
      {users.map((user, index) => (
        <button
          key={user.id}
          onClick={() => onSelect(user.username)}
          className={`w-full px-3 py-2 flex items-center gap-3 transition-colors border-b border-grey-800 last:border-b-0 ${
            index === selectedIndex
              ? 'bg-grey-800 text-white'
              : 'text-grey-300 hover:bg-grey-850 hover:text-white'
          }`}
        >
          <div className="w-8 h-8 bg-grey-800 flex items-center justify-center flex-shrink-0 border-2 border-grey-700">
            <User className="w-4 h-4 text-grey-400" />
          </div>
          <span className="font-bold text-sm truncate">@{user.username}</span>
        </button>
      ))}
    </div>
  )
}
