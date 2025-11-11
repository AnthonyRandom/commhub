import React, { useRef, useEffect, useState } from 'react'
import { Send, Image as ImageIcon, Smile, Reply as ReplyIcon, X, Loader } from 'lucide-react'
import type { Message } from '../../services/api'
import { FileUploadButton } from './FileUploadButton'
import { FileAttachment } from './FileAttachment'
import { MentionAutocomplete } from './MentionAutocomplete'
import { apiService } from '../../services/api'
import { useServersStore } from '../../stores/servers'
import { parseMentionsInMessage } from '../../utils/mentionUtils'

interface MessageInputProps {
  messageInput: string
  setMessageInput: (value: string) => void
  replyingTo: Message | null
  onSend: (
    e: React.FormEvent,
    attachments?: Array<{ url: string; filename: string; mimeType: string; size: number }>
  ) => Promise<void>
  onGifClick: () => void
  onEmojiClick: () => void
  onCancelReply: () => void
  channelName: string
  channelId: number
  dmUsers?: Array<{ id: number; username: string }> // For direct messages
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
  channelId,
  dmUsers,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [attachments, setAttachments] = useState<
    Array<{ url: string; filename: string; mimeType: string; size: number }>
  >([])
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionUsers, setMentionUsers] = useState<Array<{ id: number; username: string }>>([])
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const [mentionStartPos, setMentionStartPos] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const currentServer = useServersStore((state) => state.currentServer)

  // Focus input when channel changes
  useEffect(() => {
    inputRef.current?.focus()
  }, [channelName])

  // Clear attachments when channel changes
  useEffect(() => {
    setAttachments([])
    setUploadingFiles([])
    setUploadError(null)
    setShowMentionAutocomplete(false)
  }, [channelId])

  // Add document-level drag and drop handlers for Tauri compatibility
  // This ensures drag events work even if they don't bubble properly
  useEffect(() => {
    const handleDocumentDragOver = (e: DragEvent) => {
      // Prevent default to allow drop
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDocumentDragEnter = (e: DragEvent) => {
      // Only set dragging state if over our container
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        if (uploadingFiles.length === 0) {
          setIsDragging(true)
        }
      }
    }

    const handleDocumentDragLeave = (e: DragEvent) => {
      // Only clear dragging state if leaving our container
      if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
        setIsDragging(false)
      }
    }

    // Prevent default drag behavior on document to allow drop
    document.addEventListener('dragover', handleDocumentDragOver, false)
    document.addEventListener('dragenter', handleDocumentDragEnter, false)
    document.addEventListener('dragleave', handleDocumentDragLeave, false)

    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver, false)
      document.removeEventListener('dragenter', handleDocumentDragEnter, false)
      document.removeEventListener('dragleave', handleDocumentDragLeave, false)
    }
  }, [uploadingFiles.length])

  // Handle mention autocomplete
  useEffect(() => {
    if (!showMentionAutocomplete) {
      setMentionUsers([])
      return
    }

    // Use dmUsers if provided (for direct messages), otherwise use server members
    const users = dmUsers || currentServer?.members || []
    const filtered = users.filter((user) =>
      user.username.toLowerCase().includes(mentionQuery.toLowerCase())
    )
    setMentionUsers(filtered.slice(0, 10).map((u) => ({ id: u.id, username: u.username })))
  }, [showMentionAutocomplete, mentionQuery, currentServer, dmUsers])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention autocomplete navigation
    if (showMentionAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex((prev) => Math.min(prev + 1, mentionUsers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (mentionUsers.length > 0) {
          e.preventDefault()
          handleMentionSelect(mentionUsers[selectedMentionIndex].username)
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionAutocomplete(false)
        return
      }
    }

    // Original Enter key handling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (messageInput.trim() || attachments.length > 0) {
        onSend(e, attachments.length > 0 ? attachments : undefined)
        setAttachments([])
        setUploadError(null)
      }
    }
  }

  const handleMentionSelect = (username: string) => {
    const beforeMention = messageInput.substring(0, mentionStartPos)
    const afterMention = messageInput.substring(
      inputRef.current?.selectionStart || messageInput.length
    )
    const newValue = beforeMention + '@' + username + ' ' + afterMention
    setMessageInput(newValue)
    setShowMentionAutocomplete(false)
    setMentionQuery('')

    // Focus input and set cursor after mention
    setTimeout(() => {
      if (inputRef.current) {
        const cursorPos = (beforeMention + '@' + username + ' ').length
        inputRef.current.selectionStart = cursorPos
        inputRef.current.selectionEnd = cursorPos
        inputRef.current.focus()
      }
    }, 0)
  }

  // Auto-resize textarea based on content
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessageInput(value)

    // Reset height to auto to get the correct scrollHeight
    e.target.style.height = 'auto'
    // Set height to scrollHeight to fit content
    const newHeight = Math.min(e.target.scrollHeight, 200) // Max 200px
    e.target.style.height = `${newHeight}px`

    // Detect @ mentions
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      // Check if it's a valid mention (no spaces, no @ symbols after)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('@')) {
        setMentionQuery(textAfterAt)
        setMentionStartPos(lastAtIndex)
        setShowMentionAutocomplete(true)
        setSelectedMentionIndex(0)
      } else {
        setShowMentionAutocomplete(false)
      }
    } else {
      setShowMentionAutocomplete(false)
    }
  }

  const handleFilesSelected = async (files: File[]) => {
    setUploadingFiles((prev) => [...prev, ...files])
    setUploadError(null)

    for (const file of files) {
      try {
        // For DMs, use receiverId; for channels, use channelId
        if (dmUsers && dmUsers.length > 0) {
          const uploadedFile = await apiService.uploadFileForDM(file, dmUsers[0].id)
          setAttachments((prev) => [...prev, uploadedFile])
        } else {
          const uploadedFile = await apiService.uploadFile(file, channelId)
          setAttachments((prev) => [...prev, uploadedFile])
        }
        setUploadingFiles((prev) => prev.filter((f) => f !== file))
      } catch (error: any) {
        console.error('Failed to upload file:', error)
        setUploadError(error.response?.data?.message || `Failed to upload ${file.name}`)
        setUploadingFiles((prev) => prev.filter((f) => f !== file))
      }
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
    setUploadError(null)
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (uploadingFiles.length === 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set dragging to false if we're leaving the container itself
    if (e.currentTarget === containerRef.current) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (uploadingFiles.length === 0) {
      // Check for files in dataTransfer
      const hasFiles = e.dataTransfer.types.some(
        (type) => type === 'Files' || type === 'application/x-moz-file'
      )
      if (hasFiles) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (uploadingFiles.length > 0) return

    // Get files from dataTransfer
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFilesSelected(files)
    } else {
      // Fallback: try to get files from items (for Tauri and some browsers)
      const items = Array.from(e.dataTransfer.items)
      const filesFromItems: File[] = []

      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            filesFromItems.push(file)
          }
        }
      }

      if (filesFromItems.length > 0) {
        handleFilesSelected(filesFromItems)
      } else {
        console.warn('No files found in drag and drop event')
      }
    }
  }

  const handleSendClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (messageInput.trim() || attachments.length > 0) {
      await onSend(e as any, attachments.length > 0 ? attachments : undefined)
      // Reset textarea height and clear attachments
      if (inputRef.current) {
        inputRef.current.style.height = '48px'
      }
      setAttachments([])
      setUploadError(null)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`border-t-2 border-grey-800 flex-shrink-0 relative ${
        isDragging ? 'bg-grey-850 border-white' : ''
      } transition-colors`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-grey-900/80 border-4 border-dashed border-white z-50 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-white text-xl font-bold mb-2">Drop files to upload</div>
            <div className="text-grey-300 text-sm">Release to add attachments</div>
          </div>
        </div>
      )}
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

      {/* Attachments Preview */}
      {(attachments.length > 0 || uploadingFiles.length > 0) && (
        <div className="px-4 pt-3 pb-2 bg-grey-850 border-b-2 border-grey-800">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div key={`attachment-${attachment.filename}-${index}`} className="relative group">
                <FileAttachment
                  attachment={{ ...attachment, id: index, createdAt: new Date().toISOString() }}
                  onRemove={() => handleRemoveAttachment(index)}
                  showRemove={true}
                />
              </div>
            ))}
            {uploadingFiles.map((file, index) => (
              <div
                key={`uploading-${index}`}
                className="bg-grey-800 border-2 border-grey-700 p-3 flex items-center gap-3 animate-pulse rounded"
              >
                <Loader className="w-5 h-5 text-grey-400 animate-spin" />
                <span className="text-grey-300 text-sm">{file.name}</span>
                <button
                  onClick={() => setUploadingFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="ml-2 p-1 hover:bg-grey-700 text-grey-400 hover:text-white transition-colors rounded"
                  title="Cancel upload"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {uploadError && (
            <div className="mt-2 text-red-400 text-sm flex items-center gap-2">
              <X className="w-4 h-4" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4">
        <form onSubmit={onSend} className="relative">
          {/* Mention Autocomplete - positioned above textarea */}
          {showMentionAutocomplete && mentionUsers.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 px-4">
              <MentionAutocomplete
                users={mentionUsers}
                selectedIndex={selectedMentionIndex}
                onSelect={handleMentionSelect}
              />
            </div>
          )}

          {/* Mention Preview - shows highlighted mentions as you type */}
          {messageInput && messageInput.includes('@') && (
            <div className="absolute bottom-full left-0 right-0 mb-1 px-4 py-2 bg-grey-900 border-2 border-grey-700 text-sm text-grey-300 max-h-32 overflow-y-auto z-40">
              <div className="flex flex-wrap gap-1">
                {parseMentionsInMessage(messageInput).map((part, index) => {
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
              </div>
            </div>
          )}

          <textarea
            ref={inputRef}
            value={messageInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={dmUsers ? `Message ${channelName}` : `Message #${channelName}`}
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
            <FileUploadButton
              onFilesSelected={handleFilesSelected}
              disabled={uploadingFiles.length > 0}
            />
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
              disabled={!messageInput.trim() && attachments.length === 0}
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
