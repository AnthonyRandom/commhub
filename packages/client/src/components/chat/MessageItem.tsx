import React, { useRef, useEffect } from 'react'
import { MoreVertical, Edit2, Trash2, Reply as ReplyIcon } from 'lucide-react'
import MediaEmbed from '../MediaEmbed'
import { FileAttachment } from './FileAttachment'
import { GifHoverActions } from './GifHoverActions'
import { parseMentionsInMessage } from '../../utils/mentionUtils'
import type { Message } from '../../services/api'

interface MessageItemProps {
  message: Message
  showUserInfo: boolean
  isOwnMessage: boolean
  canModify: boolean
  canDelete: boolean
  isEditing: boolean
  editContent: string
  setEditContent: (content: string) => void
  onEditMessage: (messageId: number) => Promise<void>
  onCancelEditing: () => void
  onDeleteMessage: (messageId: number) => Promise<void>
  onReplyTo: (message: Message) => void
  onStartEditing: (message: Message) => void
  formatTimestamp: (timestamp: string) => string
  formatTimeOnly: (timestamp: string) => string
  isUserBlocked: (userId: number) => boolean
  contextMenuMessageId: number | null
  setContextMenuMessageId: (id: number | null) => void
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  showUserInfo,
  isOwnMessage,
  canModify,
  canDelete,
  isEditing,
  editContent,
  setEditContent,
  onEditMessage,
  onCancelEditing,
  onDeleteMessage,
  onReplyTo,
  onStartEditing,
  formatTimestamp,
  formatTimeOnly,
  isUserBlocked,
  contextMenuMessageId,
  setContextMenuMessageId,
}) => {
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  // Focus edit input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [isEditing])

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onEditMessage(message.id)
    } else if (e.key === 'Escape') {
      onCancelEditing()
    }
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

  const renderMessageWithMentions = (text: string) => {
    const parts = parseMentionsInMessage(text)
    return (
      <>
        {parts.map((part, index) => {
          if (part.isMention) {
            return (
              <span
                key={index}
                className="bg-blue-600/30 text-blue-300 px-1 font-bold border-l-2 border-blue-500"
              >
                {part.text}
              </span>
            )
          }
          return <span key={index}>{part.text}</span>
        })}
      </>
    )
  }

  const urls = extractUrls(message.content)
  const messageIsGif = urls.length === 1 && isGifUrl(urls[0]) && message.content === urls[0]
  const cleanedContent = removeUrlsFromText(message.content)

  // Full message with user info
  if (showUserInfo) {
    return (
      <div className="message-enter group relative">
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
              <span className="text-grey-500 text-xs">{formatTimestamp(message.createdAt)}</span>
              {message.isEdited && (
                <span className="text-grey-600 text-xs px-2 py-0.5 bg-grey-850 border border-grey-700">
                  edited
                </span>
              )}
            </div>

            {/* Reply indicator */}
            {message.replyTo && (
              <div className="mb-2 pl-3 border-l-2 border-grey-700 bg-grey-850 bg-opacity-50 p-2 text-sm">
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
                  onKeyDown={handleEditKeyDown}
                  className="w-full bg-grey-800 border-2 border-grey-700 px-3 py-2 text-white resize-none focus:border-white"
                  rows={2}
                  maxLength={2000}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditMessage(message.id)}
                    className="px-3 py-1 bg-white text-black text-sm font-bold hover:bg-grey-200 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEditing}
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
                    <div className="bg-grey-850 border-2 border-grey-700 overflow-hidden inline-block relative group">
                      <img src={urls[0]} alt="GIF" className="block h-auto max-h-96 max-w-full" />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GifHoverActions gifUrl={urls[0]} thumbnailUrl={urls[0]} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {cleanedContent && (
                      <p className="text-grey-100 break-words whitespace-pre-wrap">
                        {isUserBlocked(message.userId)
                          ? '[This user is blocked]'
                          : renderMessageWithMentions(cleanedContent)}
                      </p>
                    )}
                    {/* Display media embeds for URLs in the message */}
                    {urls.map((url, urlIndex) => (
                      <MediaEmbed key={`${message.id}-${urlIndex}`} url={url} />
                    ))}
                    {/* Display file attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.attachments.map((attachment) => (
                          <FileAttachment key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          {!isEditing && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() =>
                  setContextMenuMessageId(contextMenuMessageId === message.id ? null : message.id)
                }
                className="context-menu-trigger p-1 hover:bg-grey-800 text-grey-400 hover:text-white transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {contextMenuMessageId === message.id && (
                <div className="context-menu absolute right-0 top-8 bg-grey-900 border-2 border-grey-700 z-10 min-w-[150px] animate-fade-in">
                  <button
                    onClick={() => onReplyTo(message)}
                    className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors"
                  >
                    <ReplyIcon className="w-4 h-4" />
                    Reply
                  </button>
                  {canModify && (
                    <button
                      onClick={() => onStartEditing(message)}
                      className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => onDeleteMessage(message.id)}
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
      </div>
    )
  }

  // Condensed message (without user info)
  return (
    <div className="message-enter group relative">
      <div className="flex gap-3 hover:bg-grey-850 hover:bg-opacity-30 -mx-2 px-2 py-0.5">
        <div className="w-10 flex-shrink-0 flex items-center justify-center">
          <span className="text-grey-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTimeOnly(message.createdAt)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {/* Reply indicator for condensed messages */}
          {message.replyTo && (
            <div className="mb-2 pl-3 border-l-2 border-grey-700 bg-grey-850 bg-opacity-50 p-2 text-sm">
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
                onKeyDown={handleEditKeyDown}
                className="w-full bg-grey-800 border-2 border-grey-700 px-3 py-2 text-white resize-none focus:border-white"
                rows={2}
                maxLength={2000}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onEditMessage(message.id)}
                  className="px-3 py-1 bg-white text-black text-sm font-bold hover:bg-grey-200 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={onCancelEditing}
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
                  <div className="bg-grey-850 border-2 border-grey-700 overflow-hidden inline-block relative group">
                    <img src={urls[0]} alt="GIF" className="block h-auto max-h-96 max-w-full" />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GifHoverActions gifUrl={urls[0]} thumbnailUrl={urls[0]} />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {cleanedContent && (
                    <p className="text-grey-100 break-words whitespace-pre-wrap inline">
                      {isUserBlocked(message.userId)
                        ? '[This user is blocked]'
                        : renderMessageWithMentions(cleanedContent)}
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
                  {/* Display file attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.attachments.map((attachment, index) => (
                        <FileAttachment
                          key={`${message.id}-attachment-${attachment.id}-${index}`}
                          attachment={attachment}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity relative">
            <button
              onClick={() =>
                setContextMenuMessageId(contextMenuMessageId === message.id ? null : message.id)
              }
              className="context-menu-trigger p-1 hover:bg-grey-800 text-grey-400 hover:text-white transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {contextMenuMessageId === message.id && (
              <div className="context-menu absolute right-0 top-8 bg-grey-900 border-2 border-grey-700 z-10 min-w-[150px] animate-fade-in">
                <button
                  onClick={() => onReplyTo(message)}
                  className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors"
                >
                  <ReplyIcon className="w-4 h-4" />
                  Reply
                </button>
                {canModify && (
                  <button
                    onClick={() => onStartEditing(message)}
                    className="w-full px-4 py-2 text-left text-white hover:bg-grey-800 flex items-center gap-2 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDeleteMessage(message.id)}
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
    </div>
  )
}
