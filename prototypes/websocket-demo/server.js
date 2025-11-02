const { createServer } = require('http');
const { Server } = require('socket.io');

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = 3001;

// Store connected users and channels for demo purposes
const channels = new Map();
const users = new Map();

io.on('connection', socket => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('join', data => {
    const { username, channel } = data;
    users.set(socket.id, { username, channel });

    // Join the socket to the channel room
    socket.join(channel);

    // Initialize channel if it doesn't exist
    if (!channels.has(channel)) {
      channels.set(channel, []);
    }

    // Notify others in the channel
    socket.to(channel).emit('user-joined', {
      username,
      message: `${username} joined the channel`,
    });

    console.log(`${username} joined channel: ${channel}`);
  });

  // Handle chat messages
  socket.on('chat-message', data => {
    const { message, channel } = data;
    const user = users.get(socket.id);

    if (user) {
      const messageData = {
        username: user.username,
        message,
        timestamp: new Date().toISOString(),
        channel,
      };

      // Store message in channel history
      const channelMessages = channels.get(channel);
      channelMessages.push(messageData);

      // Broadcast to all users in the channel
      io.to(channel).emit('chat-message', messageData);

      console.log(`[${channel}] ${user.username}: ${message}`);
    }
  });

  // Handle typing indicators
  socket.on('typing-start', data => {
    const { channel } = data;
    const user = users.get(socket.id);

    if (user) {
      socket.to(channel).emit('typing-start', {
        username: user.username,
      });
    }
  });

  socket.on('typing-stop', data => {
    const { channel } = data;
    const user = users.get(socket.id);

    if (user) {
      socket.to(channel).emit('typing-stop', {
        username: user.username,
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(user.channel).emit('user-left', {
        username: user.username,
        message: `${user.username} left the channel`,
      });
      console.log(`${user.username} disconnected`);
      users.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(`Test the server by running: node client.js`);
});
