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

  // Get user status, default to 'offline' if not found
  const status = (getUserStatus(userId) || 'offline') as
    | 'online'
    | 'idle'
    | 'dnd'
    | 'invisible'
    | 'offline'

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
      case 'offline':
        return 'bg-grey-400 border-grey-500'
      case 'invisible':
        return 'bg-grey-600 border-grey-700'
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
      case 'invisible':
        return '👻'
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
