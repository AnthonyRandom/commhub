import React, { useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

interface FileUploadButtonProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  onFilesSelected,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const validateFiles = (files: FileList | null): File[] => {
    if (!files || files.length === 0) return []

    const validFiles: File[] = []
    const errors: string[] = []

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} exceeds 20MB limit`)
      } else {
        validFiles.push(file)
      }
    })

    if (errors.length > 0) {
      setError(errors.join(', '))
      setTimeout(() => setError(null), 5000)
    }

    return validFiles
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validFiles = validateFiles(e.target.files)
    if (validFiles.length > 0) {
      onFilesSelected(validFiles)
    }
    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="h-8 w-8 flex items-center justify-center hover:bg-grey-800 text-grey-400 hover:text-white transition-colors border-2 border-transparent hover:border-grey-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Upload file (max 20MB)"
      >
        <Paperclip className="w-4 h-4" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*,audio/*,text/plain,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.tar,.gz,.exe"
      />
      {error && (
        <div className="absolute bottom-full left-0 mb-2 bg-red-600 text-white px-3 py-2 text-sm border-2 border-white animate-slide-down max-w-xs">
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </>
  )
}
