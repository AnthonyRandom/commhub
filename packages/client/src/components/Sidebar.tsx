import React from 'react'
import ServerList from './ServerList'
import ChannelList from './ChannelList'
import type { Server, Channel } from '../services/api'

interface SidebarProps {
  selectedServer: Server | null
  selectedChannel: Channel | null
  onChannelSelect: (channel: Channel) => void
  onServerSelect: (server: Server | null) => void
  onCreateServer: () => void
  onCreateChannel: () => void
  onServerSettings: () => void
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedServer,
  selectedChannel,
  onChannelSelect,
  onServerSelect,
  onCreateServer,
  onCreateChannel,
  onServerSettings,
}) => {
  return (
    <div className="flex h-full">
      <ServerList
        selectedServer={selectedServer}
        onServerSelect={onServerSelect}
        onCreateServer={onCreateServer}
      />
      <ChannelList
        server={selectedServer}
        selectedChannel={selectedChannel}
        onChannelSelect={onChannelSelect}
        onCreateChannel={onCreateChannel}
        onServerSettings={onServerSettings}
      />
    </div>
  )
}

export default Sidebar
