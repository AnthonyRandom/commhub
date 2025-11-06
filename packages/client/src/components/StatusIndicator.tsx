import React from 'react'
import { useStatusStore } from '../stores/status'

interface StatusIndicatorProps {
  userId: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  userId,
  size = 'md',
  className = '',
}) => {
  const getUserStatus = useStatusStore((state) => state.getUserStatus)
  const status = getUserStatus(userId) as 'online' | 'idle' | 'dnd' | 'invisible' | 'offline'

  // Don't show indicator for invisible users or offline users
  if (status === 'invisible' || !status || status === 'offline') {
    return null
  }

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  const getStatusStyles = () => {
    switch (status) {
      case 'online':
        return 'bg-green-500 border-green-600'
      case 'idle':
        return 'bg-yellow-500 border-yellow-600'
      case 'dnd':
        return 'bg-red-500 border-red-600'
      default:
        return 'bg-grey-500 border-grey-600'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'idle':
        return '🌙'
      case 'dnd':
        return '⭕'
      default:
        return null
    }
  }

  const icon = getStatusIcon()

  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${getStatusStyles()}
        border-2
        rounded-full
        flex items-center justify-center
        text-white text-xs
        font-bold
        ${className}
      `}
      title={`Status: ${status}`}
    >
      {icon && size === 'lg' && <span className="text-[8px] leading-none">{icon}</span>}
    </div>
  )
}

export default StatusIndicator
