import React, { useState, useEffect } from 'react'
import { ExternalLink, Play } from 'lucide-react'

interface MediaEmbedProps {
  url: string
}

interface EmbedData {
  type: 'image' | 'video' | 'youtube' | 'twitter' | 'link'
  url: string
  title?: string
  description?: string
  thumbnail?: string
  embedUrl?: string
}

const MediaEmbed: React.FC<MediaEmbedProps> = ({ url }) => {
  const [embedData, setEmbedData] = useState<EmbedData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    parseUrl(url)
  }, [url])

  const parseUrl = async (urlString: string) => {
    setIsLoading(true)
    try {
      const urlObj = new URL(urlString)
      const hostname = urlObj.hostname.toLowerCase().replace('www.', '')

      // Image extensions
      if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(urlObj.pathname)) {
        setEmbedData({
          type: 'image',
          url: urlString,
        })
        setIsLoading(false)
        return
      }

      // Video extensions
      if (/\.(mp4|webm|ogg|mov)$/i.test(urlObj.pathname)) {
        setEmbedData({
          type: 'video',
          url: urlString,
        })
        setIsLoading(false)
        return
      }

      // YouTube
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        const videoId = extractYouTubeVideoId(urlString)
        if (videoId) {
          setEmbedData({
            type: 'youtube',
            url: urlString,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          })
          setIsLoading(false)
          return
        }
      }

      // Twitter/X
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        setEmbedData({
          type: 'twitter',
          url: urlString,
        })
        setIsLoading(false)
        return
      }

      // Imgur
      if (hostname.includes('imgur.com')) {
        const imgurId = urlObj.pathname
          .split('/')
          .pop()
          ?.replace(/\.(jpg|jpeg|png|gif)$/i, '')
        if (imgurId) {
          setEmbedData({
            type: 'image',
            url: `https://i.imgur.com/${imgurId}.jpg`,
          })
          setIsLoading(false)
          return
        }
      }

      // Reddit images/videos
      if (hostname.includes('reddit.com') || hostname.includes('redd.it')) {
        // Reddit preview images
        if (hostname.includes('i.redd.it') || hostname.includes('preview.redd.it')) {
          setEmbedData({
            type: 'image',
            url: urlString,
          })
          setIsLoading(false)
          return
        }
        // Reddit videos
        if (hostname.includes('v.redd.it')) {
          setEmbedData({
            type: 'video',
            url: urlString,
          })
          setIsLoading(false)
          return
        }
      }

      // Generic link
      setEmbedData({
        type: 'link',
        url: urlString,
        title: hostname,
      })
    } catch (error) {
      console.error('Error parsing URL:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const extractYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="bg-grey-850 border-2 border-grey-700 p-4 mt-2 animate-pulse">
        <div className="h-4 bg-grey-800 w-1/3 mb-2"></div>
        <div className="h-3 bg-grey-800 w-2/3"></div>
      </div>
    )
  }

  if (!embedData) return null

  // Image Embed
  if (embedData.type === 'image') {
    return (
      <div className="mt-2 max-w-md animate-slide-up">
        <div className="bg-grey-850 border-2 border-grey-700 overflow-hidden">
          <img
            src={embedData.url}
            alt="Embedded image"
            className="w-full h-auto max-h-96 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
        </div>
      </div>
    )
  }

  // Video Embed
  if (embedData.type === 'video') {
    return (
      <div className="mt-2 max-w-md animate-slide-up">
        <div className="bg-grey-850 border-2 border-grey-700 overflow-hidden">
          <video
            src={embedData.url}
            controls
            className="w-full h-auto max-h-96"
            onError={(e) => {
              const target = e.target as HTMLVideoElement
              target.style.display = 'none'
            }}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    )
  }

  // YouTube Embed
  if (embedData.type === 'youtube' && embedData.embedUrl) {
    return (
      <div className="mt-2 max-w-md animate-slide-up">
        <div className="bg-grey-850 border-2 border-grey-700 overflow-hidden">
          {!showVideo && embedData.thumbnail ? (
            <button
              onClick={() => setShowVideo(true)}
              className="relative w-full aspect-video group"
            >
              <img
                src={embedData.thumbnail}
                alt="YouTube thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/60 transition-colors">
                <div className="w-16 h-16 bg-red-600 border-2 border-white flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-white ml-1" fill="white" />
                </div>
              </div>
            </button>
          ) : (
            <iframe
              src={embedData.embedUrl}
              className="w-full aspect-video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          )}
          <div className="p-3 border-t-2 border-grey-800">
            <a
              href={embedData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-grey-300 text-sm font-bold flex items-center gap-2 group"
            >
              <span className="truncate">YouTube Video</span>
              <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Twitter Embed
  if (embedData.type === 'twitter') {
    return (
      <div className="mt-2 animate-slide-up">
        <div className="bg-grey-850 border-2 border-grey-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 bg-grey-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">𝕏</span>
            </div>
            <span className="text-white font-bold text-sm">Twitter/X Post</span>
          </div>
          <a
            href={embedData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-grey-300 hover:text-white text-sm flex items-center gap-2 group"
          >
            <span className="truncate">{embedData.url}</span>
            <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </div>
    )
  }

  // Generic Link Embed
  if (embedData.type === 'link') {
    return (
      <div className="mt-2 animate-slide-up">
        <a
          href={embedData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-grey-850 border-2 border-grey-700 hover:border-white p-3 flex items-center gap-3 group transition-colors"
        >
          <div className="w-10 h-10 bg-grey-800 flex items-center justify-center flex-shrink-0">
            <ExternalLink className="w-5 h-5 text-grey-400 group-hover:text-white transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{embedData.title}</p>
            <p className="text-grey-400 text-xs truncate">{embedData.url}</p>
          </div>
        </a>
      </div>
    )
  }

  return null
}

export default MediaEmbed
