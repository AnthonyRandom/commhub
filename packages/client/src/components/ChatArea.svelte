<script lang="ts">
  import { Send, Hash } from 'lucide-svelte'

  export let selectedChannel: string
  export let selectedServer: string

  let messageInput = ''
  let messages: Array<{ id: string; user: string; content: string; timestamp: string }> = [
    {
      id: '1',
      user: 'System',
      content: 'Welcome to the chat! This is a demo interface.',
      timestamp: '12:00 PM',
    },
    {
      id: '2',
      user: 'User1',
      content: 'Hello everyone!',
      timestamp: '12:01 PM',
    },
    {
      id: '3',
      user: 'User2',
      content: "Hey there! How's it going?",
      timestamp: '12:02 PM',
    },
  ]

  function sendMessage() {
    if (messageInput.trim()) {
      const newMessage = {
        id: Date.now().toString(),
        user: 'You',
        content: messageInput.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      messages = [...messages, newMessage]
      messageInput = ''
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }
</script>

<div class="flex-1 flex flex-col">
  <!-- Channel Header -->
  <div class="h-12 bg-gray-700 flex items-center px-4 border-b border-gray-600">
    <Hash size={20} class="text-gray-400 mr-2" />
    <div class="flex flex-col">
      <span class="text-xs text-gray-400">{selectedServer}</span>
      <h2 class="text-white font-semibold">{selectedChannel}</h2>
    </div>
    <div class="ml-auto text-sm text-gray-400">
      {messages.length} messages
    </div>
  </div>

  <!-- Messages Area -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    {#each messages as message}
      <div class="flex gap-3">
        <div
          class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
        >
          {message.user.charAt(0).toUpperCase()}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2 mb-1">
            <span class="font-medium text-white">{message.user}</span>
            <span class="text-xs text-gray-400">{message.timestamp}</span>
          </div>
          <p class="text-gray-300 break-words">{message.content}</p>
        </div>
      </div>
    {/each}
  </div>

  <!-- Message Input -->
  <div class="p-4 border-t border-gray-600">
    <div class="flex gap-3">
      <div class="flex-1 relative">
        <textarea
          bind:value={messageInput}
          on:keypress={handleKeyPress}
          placeholder={`Message #${selectedChannel}`}
          class="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows="1"
        ></textarea>
      </div>
      <button
        on:click={sendMessage}
        disabled={!messageInput.trim()}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
      >
        <Send size={16} />
        <span class="hidden sm:inline">Send</span>
      </button>
    </div>
  </div>
</div>
