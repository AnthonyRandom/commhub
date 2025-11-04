import React, { useState } from 'react'
import { X, Search, Smile, Heart, Sparkles, Coffee, Flag, Activity } from 'lucide-react'

interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectEmoji: (emoji: string) => void
  position?: { top?: number; bottom?: number; left?: number; right?: number }
}

interface EmojiCategory {
  name: string
  icon: any
  emojis: string[]
}

const emojiCategories: EmojiCategory[] = [
  {
    name: 'Smileys',
    icon: Smile,
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '🤣',
      '😂',
      '🙂',
      '🙃',
      '😉',
      '😊',
      '😇',
      '🥰',
      '😍',
      '🤩',
      '😘',
      '😗',
      '😚',
      '😙',
      '😋',
      '😛',
      '😜',
      '🤪',
      '😝',
      '🤑',
      '🤗',
      '🤭',
      '🤫',
      '🤔',
      '🤐',
      '🤨',
      '😐',
      '😑',
      '😶',
      '😏',
      '😒',
      '🙄',
      '😬',
      '🤥',
      '😌',
      '😔',
      '😪',
      '🤤',
      '😴',
      '😷',
      '🤒',
      '🤕',
      '🤢',
      '🤮',
      '🤧',
      '🥵',
      '🥶',
      '😶‍🌫️',
      '🥴',
      '😵',
      '🤯',
      '🤠',
      '🥳',
      '😎',
    ],
  },
  {
    name: 'Gestures',
    icon: Activity,
    emojis: [
      '👋',
      '🤚',
      '🖐️',
      '✋',
      '🖖',
      '👌',
      '🤌',
      '🤏',
      '✌️',
      '🤞',
      '🤟',
      '🤘',
      '🤙',
      '👈',
      '👉',
      '👆',
      '🖕',
      '👇',
      '☝️',
      '👍',
      '👎',
      '✊',
      '👊',
      '🤛',
      '🤜',
      '👏',
      '🙌',
      '👐',
      '🤲',
      '🤝',
      '🙏',
      '✍️',
      '💪',
      '🦾',
      '🦿',
      '🦵',
      '🦶',
      '👂',
      '🦻',
      '👃',
      '🧠',
      '🦷',
      '🦴',
      '👀',
      '👁️',
      '👅',
      '👄',
      '💋',
    ],
  },
  {
    name: 'Hearts',
    icon: Heart,
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💔',
      '❣️',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
      '☮️',
      '✝️',
      '☪️',
      '🕉️',
      '☸️',
      '✡️',
      '🔯',
      '🕎',
      '☯️',
      '☦️',
      '🛐',
      '⛎',
      '♈',
      '♉',
      '♊',
      '♋',
      '♌',
    ],
  },
  {
    name: 'Animals',
    icon: Coffee,
    emojis: [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🐷',
      '🐽',
      '🐸',
      '🐵',
      '🙈',
      '🙉',
      '🙊',
      '🐒',
      '🐔',
      '🐧',
      '🐦',
      '🐤',
      '🐣',
      '🐥',
      '🦆',
      '🦅',
      '🦉',
      '🦇',
      '🐺',
      '🐗',
      '🐴',
      '🦄',
      '🐝',
      '🐛',
      '🦋',
      '🐌',
      '🐞',
      '🐜',
      '🦟',
      '🦗',
      '🕷️',
      '🦂',
      '🐢',
      '🐍',
      '🦎',
      '🦖',
      '🦕',
      '🐙',
      '🦑',
      '🦐',
      '🦞',
      '🦀',
      '🐡',
      '🐠',
      '🐟',
      '🐬',
      '🐳',
      '🐋',
    ],
  },
  {
    name: 'Food',
    icon: Coffee,
    emojis: [
      '🍇',
      '🍈',
      '🍉',
      '🍊',
      '🍋',
      '🍌',
      '🍍',
      '🥭',
      '🍎',
      '🍏',
      '🍐',
      '🍑',
      '🍒',
      '🍓',
      '🥝',
      '🍅',
      '🥥',
      '🥑',
      '🍆',
      '🥔',
      '🥕',
      '🌽',
      '🌶️',
      '🥒',
      '🥬',
      '🥦',
      '🧄',
      '🧅',
      '🍄',
      '🥜',
      '🌰',
      '🍞',
      '🥐',
      '🥖',
      '🥨',
      '🥯',
      '🥞',
      '🧇',
      '🧀',
      '🍖',
      '🍗',
      '🥩',
      '🥓',
      '🍔',
      '🍟',
      '🍕',
      '🌭',
      '🥪',
      '🌮',
      '🌯',
      '🥙',
      '🧆',
      '🥚',
      '🍳',
      '🥘',
      '🍲',
      '🥣',
      '🥗',
      '🍿',
      '🧈',
      '🧂',
      '🥫',
      '🍱',
      '🍘',
      '🍙',
      '🍚',
      '🍛',
      '🍜',
      '🍝',
      '🍠',
      '🍢',
      '🍣',
    ],
  },
  {
    name: 'Activities',
    icon: Activity,
    emojis: [
      '⚽',
      '🏀',
      '🏈',
      '⚾',
      '🥎',
      '🎾',
      '🏐',
      '🏉',
      '🥏',
      '🎱',
      '🪀',
      '🏓',
      '🏸',
      '🏒',
      '🏑',
      '🥍',
      '🏏',
      '🥅',
      '⛳',
      '🪁',
      '🏹',
      '🎣',
      '🤿',
      '🥊',
      '🥋',
      '🎽',
      '🛹',
      '🛼',
      '🛷',
      '⛸️',
      '🥌',
      '🎿',
      '⛷️',
      '🏂',
      '🪂',
      '🏋️',
      '🤼',
      '🤸',
      '🤺',
      '⛹️',
      '🤾',
      '🏌️',
      '🏇',
      '🧘',
      '🏊',
      '🤽',
      '🚣',
      '🧗',
    ],
  },
  {
    name: 'Objects',
    icon: Flag,
    emojis: [
      '⌚',
      '📱',
      '📲',
      '💻',
      '⌨️',
      '🖥️',
      '🖨️',
      '🖱️',
      '🖲️',
      '🕹️',
      '🗜️',
      '💾',
      '💿',
      '📀',
      '📼',
      '📷',
      '📸',
      '📹',
      '🎥',
      '📽️',
      '🎞️',
      '📞',
      '☎️',
      '📟',
      '📠',
      '📺',
      '📻',
      '🎙️',
      '🎚️',
      '🎛️',
      '🧭',
      '⏱️',
      '⏲️',
      '⏰',
      '🕰️',
      '⌛',
      '⏳',
      '📡',
      '🔋',
      '🔌',
      '💡',
      '🔦',
      '🕯️',
      '🪔',
      '🧯',
      '🛢️',
      '💸',
      '💵',
      '💴',
      '💶',
      '💷',
      '🪙',
      '💰',
      '💳',
      '🧾',
      '💎',
      '⚖️',
      '🪜',
      '🧰',
      '🔧',
    ],
  },
  {
    name: 'Symbols',
    icon: Sparkles,
    emojis: [
      '💯',
      '🔟',
      '🔢',
      '#️⃣',
      '*️⃣',
      '⏏️',
      '▶️',
      '⏸️',
      '⏯️',
      '⏹️',
      '⏺️',
      '⏭️',
      '⏮️',
      '⏩',
      '⏪',
      '⏫',
      '⏬',
      '◀️',
      '🔼',
      '🔽',
      '➡️',
      '⬅️',
      '⬆️',
      '⬇️',
      '↗️',
      '↘️',
      '↙️',
      '↖️',
      '↕️',
      '↔️',
      '↪️',
      '↩️',
      '⤴️',
      '⤵️',
      '🔀',
      '🔁',
      '🔂',
      '🔄',
      '🔃',
      '🎵',
      '🎶',
      '➕',
      '➖',
      '➗',
      '✖️',
      '♾️',
      '💲',
      '💱',
      '™️',
      '©️',
      '®️',
      '〰️',
      '➰',
      '➿',
      '🔚',
      '🔙',
      '🔛',
      '🔝',
      '🔜',
      '✔️',
      '☑️',
      '🔘',
      '🔴',
      '🟠',
      '🟡',
      '🟢',
      '🔵',
      '🟣',
      '⚫',
      '⚪',
      '🟤',
      '🔺',
      '🔻',
    ],
  },
]

const EmojiPicker: React.FC<EmojiPickerProps> = ({ isOpen, onClose, onSelectEmoji, position }) => {
  const [selectedCategory, setSelectedCategory] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  if (!isOpen) return null

  const filteredEmojis = searchQuery.trim()
    ? emojiCategories
        .flatMap((cat) => cat.emojis)
        .filter(() => {
          // Simple filter - in production, you'd want emoji names/descriptions
          return true
        })
    : emojiCategories[selectedCategory].emojis

  const positionStyles = position
    ? {
        position: 'absolute' as const,
        ...position,
      }
    : {
        position: 'fixed' as const,
        bottom: '80px',
        right: '20px',
      }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Emoji Picker */}
      <div
        style={positionStyles}
        className="bg-grey-900 border-2 border-grey-700 w-[372px] h-[420px] flex flex-col z-50 animate-slide-up"
      >
        {/* Header */}
        <div className="border-b-2 border-grey-700 p-3 flex items-center justify-between">
          <h3 className="text-white font-bold text-sm">Emoji Picker</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-grey-800 text-grey-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-2 border-b-2 border-grey-800">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-grey-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search emojis"
              className="w-full bg-grey-850 border-2 border-grey-700 px-8 py-2 text-sm text-white focus:border-white placeholder:text-grey-600"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="border-b-2 border-grey-800 flex">
          {emojiCategories.map((category, index) => {
            const Icon = category.icon
            const isActive = selectedCategory === index
            return (
              <button
                key={category.name}
                onClick={() => {
                  setSelectedCategory(index)
                  setSearchQuery('')
                }}
                className={`p-3 border-r-2 border-grey-800 transition-colors flex-shrink-0 ${
                  isActive
                    ? 'bg-grey-800 text-white'
                    : 'text-grey-500 hover:bg-grey-850 hover:text-white'
                }`}
                title={category.name}
              >
                <Icon className="w-5 h-5" />
              </button>
            )
          })}
        </div>

        {/* Emoji Grid */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-8 gap-1">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => {
                  onSelectEmoji(emoji)
                  onClose()
                }}
                className="aspect-square flex items-center justify-center text-2xl hover:bg-grey-800 transition-colors border-2 border-transparent hover:border-grey-600"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default EmojiPicker
