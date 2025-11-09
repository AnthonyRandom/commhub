import React, { useRef, useEffect } from 'react'
import { Send, Image as ImageIcon, Smile, Reply as ReplyIcon, X } from 'lucide-react'
import type { Message } from '../../services/api'

interface MessageInputProps {
  messageInput: string
  setMessageInput: (value: string) => void
  replyingTo: Message | null
  onSend: (e: React.FormEvent) => Promise<void>
  onGifClick: () => void
  onEmojiClick: () => void
  onCancelReply: () => void
  channelName: string
}

export const MessageInput: React.FC<MessageInputProps> = ({
  messageInput,
  setMessageInput,
  replyingTo,
  onSend,
  onGifClick,
  onEmojiClick,
  onCancelReply,
  channelName,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Focus input when channel changes
  useEffect(() => {
    inputRef.current?.focus()
  }, [channelName])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend(e)
    }
  }

  // Auto-resize textarea based on content
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value)

    // Reset height to auto to get the correct scrollHeight
    e.target.style.height = 'auto'
    // Set height to scrollHeight to fit content
    const newHeight = Math.min(e.target.scrollHeight, 200) // Max 200px
    e.target.style.height = `${newHeight}px`
  }

  const handleSendClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (messageInput.trim()) {
      await onSend(e as any)
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = '48px'
      }
    }
  }

  return (
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
              onClick={onCancelReply}
              className="p-1 hover:bg-grey-800 text-grey-400 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4">
        <form onSubmit={onSend} className="relative">
          <textarea
            ref={inputRef}
            value={messageInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            className="w-full bg-grey-850 border-2 border-grey-700 px-4 py-3 pr-32 text-white resize-none focus:border-white placeholder:text-grey-500"
            rows={1}
            maxLength={2000}
            autoComplete="off"
            style={{
              minHeight: '48px',
              maxHeight: '200px',
              height: '48px',
              overflow: 'hidden',
            }}
          />

          {/* Action Buttons */}
          <div className="absolute right-2 top-[10px] flex items-center gap-1 z-10">
            <button
              type="button"
              onClick={onGifClick}
              className="h-8 w-8 flex items-center justify-center hover:bg-grey-800 text-grey-400 hover:text-white transition-colors border-2 border-transparent hover:border-grey-600"
              title="Send GIF"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onEmojiClick}
              className="h-8 w-8 flex items-center justify-center hover:bg-grey-800 text-grey-400 hover:text-white transition-colors border-2 border-transparent hover:border-grey-600"
              title="Add emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSendClick}
              disabled={!messageInput.trim()}
              className="h-8 w-8 flex items-center justify-center bg-white text-black hover:bg-grey-100 disabled:bg-grey-700 disabled:text-grey-500 disabled:cursor-not-allowed transition-colors border-2 border-transparent"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
        <p className="text-grey-600 text-xs mt-2">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  )
}
