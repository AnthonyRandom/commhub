<script lang="ts">
  import Sidebar from './components/Sidebar.svelte'
  import ChatArea from './components/ChatArea.svelte'

  let selectedChannel = 'general'
  let selectedServer = 'My Server'

  function handleChannelSelect(event: CustomEvent) {
    selectedChannel = event.detail.channel
  }

  function handleServerSelect(event: CustomEvent) {
    selectedServer = event.detail.server
  }
</script>

<main class="flex h-screen bg-gray-800 text-white">
  <Sidebar
    {selectedServer}
    {selectedChannel}
    on:channelSelect={handleChannelSelect}
    on:serverSelect={handleServerSelect}
  />
  <ChatArea {selectedChannel} {selectedServer} />
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }
</style>
