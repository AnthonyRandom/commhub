const io = require('socket.io-client');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Connect to the server
const socket = io('http://localhost:3001');

// Ask for user details
rl.question('Enter your username: ', username => {
  rl.question('Enter channel name: ', channel => {
    // Join the channel
    socket.emit('join', { username, channel });

    console.log(`\n=== Connected to channel: ${channel} as ${username} ===`);
    console.log('Type your messages and press Enter. Type "/quit" to exit.\n');

    // Listen for chat messages
    socket.on('chat-message', data => {
      if (data.username !== username) {
        console.log(
          `[${new Date(data.timestamp).toLocaleTimeString()}] ${data.username}: ${data.message}`
        );
      }
    });

    // Listen for user join/leave events
    socket.on('user-joined', data => {
      console.log(`*** ${data.message} ***`);
    });

    socket.on('user-left', data => {
      console.log(`*** ${data.message} ***`);
    });

    // Listen for typing indicators
    socket.on('typing-start', data => {
      if (data.username !== username) {
        console.log(`${data.username} is typing...`);
      }
    });

    socket.on('typing-stop', data => {
      // Could clear typing indicator here
    });

    // Handle user input
    rl.on('line', input => {
      if (input.trim() === '/quit') {
        console.log('Disconnecting...');
        socket.disconnect();
        rl.close();
        return;
      }

      if (input.trim()) {
        socket.emit('chat-message', {
          message: input.trim(),
          channel,
        });
      }
    });

    // Handle connection events
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      rl.close();
    });

    socket.on('connect_error', error => {
      console.error('Connection error:', error.message);
      rl.close();
    });
  });
});
