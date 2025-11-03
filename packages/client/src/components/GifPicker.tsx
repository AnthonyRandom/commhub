import React, { useState, useEffect, useRef } from 'react'
import { X, Search, TrendingUp } from 'lucide-react'

interface GifPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectGif: (gifUrl: string) => void
}

interface TenorGif {
  id: string
  media_formats: {
    gif: {
      url: string
    }
    tinygif: {
      url: string
    }
  }
  content_description: string
}

const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY
const TENOR_CLIENT_KEY = 'commhub'

if (!TENOR_API_KEY) {
  console.error(
    'VITE_TENOR_API_KEY environment variable is not set. GIF functionality will not work.'
  )
}

const GifPicker: React.FC<GifPickerProps> = ({ isOpen, onClose, onSelectGif }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [gifs, setGifs] = useState<TenorGif[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  const categories = [
    { name: 'Trending', icon: TrendingUp },
    { name: 'Happy' },
    { name: 'Sad' },
    { name: 'Excited' },
    { name: 'Angry' },
    { name: 'Thumbs Up' },
    { name: 'Thumbs Down' },
    { name: 'Dancing' },
  ]

  useEffect(() => {
    if (isOpen) {
      fetchTrendingGifs()
    }
  }, [isOpen])

  useEffect(() => {
    if (searchQuery.trim()) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        searchGifs(searchQuery)
      }, 500)
    } else if (isOpen) {
      fetchTrendingGifs()
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const fetchTrendingGifs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20`
      )
      const data = await response.json()
      setGifs(data.results || [])
    } catch (error) {
      console.error('Error fetching trending gifs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const searchGifs = async (query: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(
          query
        )}&key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20`
      )
      const data = await response.json()
      setGifs(data.results || [])
    } catch (error) {
      console.error('Error searching gifs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName)
    if (categoryName === 'Trending') {
      setSearchQuery('')
      fetchTrendingGifs()
    } else {
      setSearchQuery(categoryName)
    }
  }

  const handleGifSelect = (gif: TenorGif) => {
    const gifUrl = gif.media_formats.gif.url
    onSelectGif(gifUrl)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-grey-900 border-4 border-grey-700 w-full max-w-3xl max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="border-b-4 border-grey-700 p-4 flex items-center justify-between">
          <h2 className="text-white text-xl font-bold">Choose a GIF</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-grey-800 text-grey-400 hover:text-white transition-colors border-2 border-transparent hover:border-grey-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b-2 border-grey-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-grey-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for GIFs"
              className="w-full bg-grey-850 border-2 border-grey-700 px-10 py-3 text-white focus:border-white placeholder:text-grey-600"
              autoFocus
            />
          </div>
        </div>

        {/* Categories */}
        <div className="p-4 border-b-2 border-grey-800 overflow-x-auto">
          <div className="flex gap-2">
            {categories.map((category) => {
              const Icon = category.icon
              const isActive = selectedCategory === category.name
              return (
                <button
                  key={category.name}
                  onClick={() => handleCategoryClick(category.name)}
                  className={`px-4 py-2 border-2 font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                    isActive
                      ? 'bg-white text-black border-white'
                      : 'bg-grey-850 text-white border-grey-700 hover:bg-grey-800 hover:border-white'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {category.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* GIF Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent animate-spin mx-auto mb-4"></div>
                <p className="text-white font-bold">Loading GIFs...</p>
              </div>
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-white font-bold mb-2">No GIFs found</p>
                <p className="text-grey-400 text-sm">Try a different search</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleGifSelect(gif)}
                  className="relative aspect-square overflow-hidden bg-grey-850 border-2 border-grey-700 hover:border-white transition-all group"
                >
                  <img
                    src={gif.media_formats.tinygif.url}
                    alt={gif.content_description}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-bold text-sm">Send</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-grey-800 p-3">
          <p className="text-grey-600 text-xs text-center">Powered by Tenor</p>
        </div>
      </div>
    </div>
  )
}

export default GifPicker
