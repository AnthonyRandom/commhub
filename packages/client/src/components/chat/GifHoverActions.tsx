import React, { useState } from 'react'
import { Star } from 'lucide-react'
import { useSavedGifsStore } from '../../stores/savedGifs'

interface GifHoverActionsProps {
  gifUrl: string
  tenorId?: string
  contentDescription?: string
  thumbnailUrl?: string
}

export const GifHoverActions: React.FC<GifHoverActionsProps> = ({
  gifUrl,
  tenorId,
  contentDescription,
  thumbnailUrl,
}) => {
  const { saveGif, removeSavedGif, isGifSaved, savedGifs } = useSavedGifsStore()
  const [isSaving, setIsSaving] = useState(false)
  const saved = isGifSaved(gifUrl)

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (isSaving) return

    setIsSaving(true)
    try {
      if (saved) {
        // Find the saved GIF by URL and remove it
        const savedGif = savedGifs.find((g) => g.gifUrl === gifUrl)
        if (savedGif) {
          await removeSavedGif(savedGif.id)
        }
      } else {
        // Save the GIF
        await saveGif({
          gifUrl,
          tenorId,
          contentDescription,
          thumbnailUrl,
        })
      }
    } catch (error) {
      console.error('Failed to toggle saved GIF:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <button
      onClick={handleToggleSave}
      disabled={isSaving}
      className={`p-2 transition-colors border-2 ${
        saved
          ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-white'
          : 'bg-grey-800 hover:bg-grey-700 text-grey-300 hover:text-white border-grey-700 hover:border-white'
      } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={saved ? 'Remove from saved' : 'Save GIF'}
    >
      <Star className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
    </button>
  )
}
