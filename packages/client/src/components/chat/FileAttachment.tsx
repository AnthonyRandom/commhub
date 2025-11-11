import React, { useState } from 'react'
import { FileText, Film, Music, Image as ImageIcon, Download, X, Archive, File } from 'lucide-react'
import type { Attachment } from '../../services/api'
import config from '../../config/environment'

interface FileAttachmentProps {
  attachment: Attachment
  onRemove?: () => void
  showRemove?: boolean
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({
  attachment,
  onRemove,
  showRemove = false,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [audioError, setAudioError] = useState(false)

  const fullUrl = attachment.url.startsWith('http')
    ? attachment.url
    : `${config.API_URL}${attachment.url}`

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-6 h-6" />
    if (mimeType.startsWith('video/')) return <Film className="w-6 h-6" />
    if (mimeType.startsWith('audio/')) return <Music className="w-6 h-6" />
    if (
      mimeType.includes('zip') ||
      mimeType.includes('rar') ||
      mimeType.includes('7z') ||
      mimeType.includes('tar') ||
      mimeType.includes('gzip')
    )
      return <Archive className="w-6 h-6" />
    if (mimeType === 'text/plain' || mimeType.includes('document') || mimeType.includes('pdf'))
      return <FileText className="w-6 h-6" />
    return <File className="w-6 h-6" />
  }

  // Image attachment
  if (attachment.mimeType.startsWith('image/') && !imageError) {
    return (
      <>
        <div className="relative inline-block animate-slide-up">
          <div className="bg-grey-850 border-2 border-grey-700 overflow-hidden inline-block group">
            <img
              src={fullUrl}
              alt={attachment.filename}
              className="block h-auto max-h-96 max-w-full cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setLightboxOpen(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
            {showRemove && onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 text-white border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="text-grey-400 text-xs mt-1">
            {attachment.filename} • {formatFileSize(attachment.size)}
          </div>
        </div>

        {/* Lightbox */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 bg-grey-900 hover:bg-grey-800 text-white border-2 border-grey-700 hover:border-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={fullUrl}
              alt={attachment.filename}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    )
  }

  // Video attachment
  if (attachment.mimeType.startsWith('video/')) {
    if (videoError) {
      // Fallback UI when video fails to load
      return (
        <div className="mt-2 max-w-md animate-slide-up">
          <div className="bg-grey-850 border-2 border-grey-700 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-grey-800 flex items-center justify-center flex-shrink-0">
                <Film className="w-6 h-6 text-grey-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{attachment.filename}</p>
                <p className="text-grey-400 text-xs">{formatFileSize(attachment.size)}</p>
              </div>
            </div>
            <div className="bg-grey-900 border-2 border-grey-800 p-4 text-center">
              <p className="text-grey-400 text-sm mb-2">Video file not available</p>
              <p className="text-grey-500 text-xs mb-3">The file may have been deleted or moved.</p>
              <a
                href={fullUrl}
                download={attachment.filename}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-grey-200 text-black border-2 border-white transition-colors text-sm"
                title="Try downloading the file"
              >
                <Download className="w-4 h-4" />
                Try Download
              </a>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="mt-2 max-w-md animate-slide-up">
        <div className="bg-grey-850 border-2 border-grey-700 overflow-hidden">
          <video
            src={fullUrl}
            controls
            className="w-full h-auto max-h-96"
            onError={() => setVideoError(true)}
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="text-grey-400 text-xs mt-1">
          {attachment.filename} • {formatFileSize(attachment.size)}
        </div>
      </div>
    )
  }

  // Audio attachment
  if (attachment.mimeType.startsWith('audio/')) {
    if (audioError) {
      // Fallback UI when audio fails to load
      return (
        <div className="mt-2 max-w-md animate-slide-up">
          <div className="bg-grey-850 border-2 border-grey-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-grey-800 flex items-center justify-center flex-shrink-0">
                <Music className="w-5 h-5 text-grey-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{attachment.filename}</p>
                <p className="text-grey-400 text-xs">{formatFileSize(attachment.size)}</p>
              </div>
              {showRemove && onRemove && (
                <button
                  onClick={onRemove}
                  className="p-1 bg-red-600 hover:bg-red-700 text-white border-2 border-white transition-colors"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="bg-grey-900 border-2 border-grey-800 p-4 text-center">
              <p className="text-grey-400 text-sm mb-2">Audio file not available</p>
              <p className="text-grey-500 text-xs mb-3">The file may have been deleted or moved.</p>
              <a
                href={fullUrl}
                download={attachment.filename}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-grey-200 text-black border-2 border-white transition-colors text-sm"
                title="Try downloading the file"
              >
                <Download className="w-4 h-4" />
                Try Download
              </a>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="mt-2 max-w-md animate-slide-up">
        <div className="bg-grey-850 border-2 border-grey-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-grey-800 flex items-center justify-center flex-shrink-0">
              <Music className="w-5 h-5 text-grey-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate">{attachment.filename}</p>
              <p className="text-grey-400 text-xs">{formatFileSize(attachment.size)}</p>
            </div>
            {showRemove && onRemove && (
              <button
                onClick={onRemove}
                className="p-1 bg-red-600 hover:bg-red-700 text-white border-2 border-white transition-colors"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <audio src={fullUrl} controls className="w-full" onError={() => setAudioError(true)}>
            Your browser does not support the audio tag.
          </audio>
        </div>
      </div>
    )
  }

  // Generic file attachment (documents, archives, executables, etc.)
  return (
    <div className="mt-2 animate-slide-up">
      <div className="bg-grey-850 border-2 border-grey-700 hover:border-white p-3 flex items-center gap-3 group transition-colors">
        <div className="w-10 h-10 bg-grey-800 flex items-center justify-center flex-shrink-0">
          {getFileIcon(attachment.mimeType)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{attachment.filename}</p>
          <p className="text-grey-400 text-xs">{formatFileSize(attachment.size)}</p>
        </div>
        <div className="flex items-center gap-2">
          {showRemove && onRemove ? (
            <button
              onClick={onRemove}
              className="p-2 bg-red-600 hover:bg-red-700 text-white border-2 border-white transition-colors"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <a
              href={fullUrl}
              download={attachment.filename}
              className="p-2 bg-white hover:bg-grey-200 text-black border-2 border-white transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
