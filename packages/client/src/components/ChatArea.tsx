import React from 'react'

interface ChatAreaProps {
  selectedChannel: string
}

const ChatArea: React.FC<ChatAreaProps> = ({ selectedChannel }) => {
  return (
    <div className="flex-1 bg-gray-800 p-4">
      <h2 className="text-white text-lg font-bold mb-4">Chat Area</h2>
      <p className="text-gray-300">Current Channel: {selectedChannel || 'None'}</p>
      <p className="text-gray-400 text-sm mt-4">Chat area component - to be implemented</p>
    </div>
  )
}

export default ChatArea
