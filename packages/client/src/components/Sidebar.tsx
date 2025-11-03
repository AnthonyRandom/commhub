import React from 'react'
import ServerList from './ServerList'
import ChannelList from './ChannelList'
import type { Server, Channel, Conversation } from '../services/api'

interface SidebarProps {
  selectedServer: Server | null
  selectedChannel: Channel | null
  onChannelSelect: (channel: Channel) => void
  onServerSelect: (server: Server | null) => void
  onCreateServer: () => void
  onCreateChannel: () => void
  onServerSettings: () => void
  onAppSettings: () => void
  onShowFriends: () => void
  showFriendsPanel: boolean
  dmConversations?: Conversation[]
  onDMSelect?: (userId: number) => void
  onDeleteDM?: (userId: number) => void
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedServer,
  selectedChannel,
  onChannelSelect,
  onServerSelect,
  onCreateServer,
  onCreateChannel,
  onServerSettings,
  onAppSettings,
  onShowFriends,
  showFriendsPanel,
  dmConversations = [],
  onDMSelect,
  onDeleteDM,
}) => {
  return (
    <div className="flex h-full">
      <ServerList
        selectedServer={selectedServer}
        onServerSelect={onServerSelect}
        onCreateServer={onCreateServer}
        onShowFriends={onShowFriends}
        showFriendsPanel={showFriendsPanel}
      />
      <ChannelList
        server={selectedServer}
        selectedChannel={selectedChannel}
        onChannelSelect={onChannelSelect}
        onCreateChannel={onCreateChannel}
        onServerSettings={onServerSettings}
        onAppSettings={onAppSettings}
        dmConversations={dmConversations}
        onDMSelect={onDMSelect}
        onDeleteDM={onDeleteDM}
      />
    </div>
  )
}

export default Sidebar
