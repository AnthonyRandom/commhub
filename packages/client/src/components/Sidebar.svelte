<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Home, Hash, Volume2, Users } from 'lucide-svelte'

  export let selectedServer: string
  export let selectedChannel: string

  const dispatch = createEventDispatcher()

  // Mock data - will be replaced with real data later
  const servers = [
    { id: 'my-server', name: 'My Server', icon: '🏠' },
    { id: 'friends', name: 'Friends', icon: '👥' },
  ]

  const channels = {
    text: [
      { id: 'general', name: 'general', type: 'text' },
      { id: 'random', name: 'random', type: 'text' },
    ],
    voice: [
      { id: 'general-voice', name: 'General', type: 'voice' },
      { id: 'gaming', name: 'Gaming', type: 'voice' },
    ],
  }

  function selectServer(serverId: string) {
    dispatch('serverSelect', { server: serverId })
  }

  function selectChannel(channelId: string) {
    dispatch('channelSelect', { channel: channelId })
  }
</script>

<div class="w-64 bg-gray-900 flex flex-col">
  <!-- Server List -->
  <div class="p-4 border-b border-gray-700">
    <h2 class="text-lg font-semibold mb-3">Servers</h2>
    <div class="space-y-2">
      {#each servers as server}
        <button
          class="w-full text-left px-3 py-2 rounded hover:bg-gray-700 transition-colors flex items-center gap-2 {selectedServer ===
          server.id
            ? 'bg-gray-700'
            : ''}"
          on:click={() => selectServer(server.id)}
        >
          <span class="text-xl">{server.icon}</span>
          <span class="truncate">{server.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Channel List -->
  <div class="flex-1 p-4">
    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
      {selectedServer}
    </h3>

    <!-- Text Channels -->
    <div class="mb-4">
      <div
        class="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider"
      >
        <Hash size={12} />
        Text Channels
      </div>
      <div class="space-y-1">
        {#each channels.text as channel}
          <button
            class="w-full text-left px-2 py-1 rounded hover:bg-gray-700 transition-colors text-sm flex items-center gap-2 {selectedChannel ===
            channel.id
              ? 'bg-gray-700 text-white'
              : 'text-gray-300'}"
            on:click={() => selectChannel(channel.id)}
          >
            <Hash size={14} />
            {channel.name}
          </button>
        {/each}
      </div>
    </div>

    <!-- Voice Channels -->
    <div>
      <div
        class="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider"
      >
        <Volume2 size={12} />
        Voice Channels
      </div>
      <div class="space-y-1">
        {#each channels.voice as channel}
          <button
            class="w-full text-left px-2 py-1 rounded hover:bg-gray-700 transition-colors text-sm flex items-center gap-2 {selectedChannel ===
            channel.id
              ? 'bg-gray-700 text-white'
              : 'text-gray-300'}"
            on:click={() => selectChannel(channel.id)}
          >
            <Volume2 size={14} />
            {channel.name}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- User Status -->
  <div class="p-4 border-t border-gray-700">
    <div class="flex items-center gap-3">
      <div
        class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold"
      >
        U
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate">Username</div>
        <div class="text-xs text-gray-400">#1234</div>
      </div>
    </div>
  </div>
</div>
