import React, { useState, useEffect, useRef } from 'react'
import { X, Search, TrendingUp, Star, Loader } from 'lucide-react'
import { apiService } from '../services/api'
import { useSavedGifsStore } from '../stores/savedGifs'

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

type TabType = 'trending' | 'search' | 'saved'

const GifPicker: React.FC<GifPickerProps> = ({ isOpen, onClose, onSelectGif }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [gifs, setGifs] = useState<TenorGif[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('trending')
  const [nextPos, setNextPos] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { savedGifs, fetchSavedGifs } = useSavedGifsStore()

  const categories = [
    { name: 'Trending', icon: TrendingUp },
    { name: 'Happy' },
    { name: 'Sad' },
    { name: 'Excited' },
    { name: 'Angry' },
    { name: 'Thumbs Up' },
    { name: 'Thumbs Down' },
  ]

  useEffect(() => {
    if (isOpen) {
      fetchTrendingGifs(true)
      fetchSavedGifs()
    }
  }, [isOpen])

  useEffect(() => {
    if (searchQuery.trim()) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        searchGifsWithQuery(searchQuery, true)
        setActiveTab('search')
      }, 500)
    } else if (isOpen && activeTab === 'search') {
      setActiveTab('trending')
      fetchTrendingGifs(true)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const fetchTrendingGifs = async (reset = false) => {
    if (!hasMore && !reset) return
    if (isLoading) return

    setIsLoading(true)
    try {
      const pos = reset ? undefined : nextPos || undefined
      const response = await apiService.getTrendingGifs(50, pos)

      if (reset) {
        setGifs(response.results)
        setPage(1)
      } else {
        setGifs((prev) => [...prev, ...response.results])
        setPage((p) => p + 1)
      }

      setNextPos(response.next || null)
      setHasMore(!!response.next && page < 2) // Limit to 3 pages (0, 1, 2)
    } catch (error) {
      console.error('Error fetching trending gifs:', error)
      if (reset) setGifs([])
    } finally {
      setIsLoading(false)
    }
  }

  const searchGifsWithQuery = async (query: string, reset = false) => {
    if (!hasMore && !reset) return
    if (isLoading) return

    setIsLoading(true)
    try {
      const pos = reset ? undefined : nextPos || undefined
      const response = await apiService.searchGifs(query, 50, pos)

      if (reset) {
        setGifs(response.results)
        setPage(1)
      } else {
        setGifs((prev) => [...prev, ...response.results])
        setPage((p) => p + 1)
      }

      setNextPos(response.next || null)
      setHasMore(!!response.next && page < 2) // Limit to 3 pages
    } catch (error) {
      console.error('Error searching gifs:', error)
      if (reset) setGifs([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Load more when scrolled 80% down
    if (scrollPercentage > 0.8 && hasMore && !isLoading && activeTab !== 'saved') {
      if (activeTab === 'trending') {
        fetchTrendingGifs(false)
      } else if (activeTab === 'search' && searchQuery.trim()) {
        searchGifsWithQuery(searchQuery, false)
      }
    }
  }

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName)
    setActiveTab('search')
    if (categoryName === 'Trending') {
      setSearchQuery('')
      setActiveTab('trending')
      fetchTrendingGifs(true)
    } else {
      setSearchQuery(categoryName)
    }
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSelectedCategory(null)
    if (tab === 'trending') {
      setSearchQuery('')
      setHasMore(true)
      setPage(0)
      setNextPos(null)
      fetchTrendingGifs(true)
    } else if (tab === 'saved') {
      setSearchQuery('')
    }
  }

  const handleGifSelect = (gif: TenorGif | any) => {
    const gifUrl = gif.media_formats?.gif?.url || gif.gifUrl
    onSelectGif(gifUrl)
    onClose()
  }

  if (!isOpen) return null

  const displayGifs = activeTab === 'saved' ? savedGifs : gifs

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-grey-900 border-4 border-grey-700 w-full max-w-4xl max-h-[700px] flex flex-col">
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

        {/* Tabs */}
        <div className="border-b-2 border-grey-800 flex">
          <button
            onClick={() => handleTabChange('trending')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors border-b-4 ${
              activeTab === 'trending'
                ? 'bg-grey-850 text-white border-white'
                : 'bg-grey-900 text-grey-400 border-transparent hover:bg-grey-850 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trending
            </div>
          </button>
          <button
            onClick={() => handleTabChange('saved')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors border-b-4 ${
              activeTab === 'saved'
                ? 'bg-grey-850 text-white border-white'
                : 'bg-grey-900 text-grey-400 border-transparent hover:bg-grey-850 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Star className="w-4 h-4" />
              Saved ({savedGifs.length})
            </div>
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
        <div className="p-4 border-b-2 border-grey-800">
          <div className="flex flex-wrap gap-2">
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
        <div
          className="flex-1 overflow-y-auto p-4"
          onScroll={handleScroll}
          ref={scrollContainerRef}
        >
          {activeTab === 'saved' && displayGifs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Star className="w-16 h-16 text-grey-600 mx-auto mb-4" />
                <p className="text-white font-bold mb-2">No Saved GIFs</p>
                <p className="text-grey-400 text-sm">
                  Hover over any GIF and click the star to save it
                </p>
              </div>
            </div>
          ) : isLoading && displayGifs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent animate-spin mx-auto mb-4"></div>
                <p className="text-white font-bold">Loading GIFs...</p>
              </div>
            </div>
          ) : displayGifs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-white font-bold mb-2">No GIFs found</p>
                <p className="text-grey-400 text-sm">Try a different search</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {displayGifs.map((gif: any) => (
                  <button
                    key={gif.id}
                    onClick={() => handleGifSelect(gif)}
                    className="relative aspect-square overflow-hidden bg-grey-850 border-2 border-grey-700 hover:border-white transition-all group"
                  >
                    <img
                      src={gif.media_formats?.tinygif?.url || gif.thumbnailUrl || gif.gifUrl}
                      alt={gif.content_description || 'GIF'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-bold text-sm">Send</span>
                    </div>
                    {activeTab === 'saved' && (
                      <div className="absolute top-2 right-2">
                        <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {isLoading && (
                <div className="flex justify-center py-4">
                  <Loader className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </>
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
