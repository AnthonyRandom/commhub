const { createServer } = require('http');
const { Server } = require('socket.io');

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = 3003;

// Store rooms and their participants
const rooms = new Map();

io.on('connection', socket => {
  console.log(`Peer connected: ${socket.id}`);

  // Handle joining a room
  socket.on('join-room', data => {
    const { roomId, peerId } = data;

    // Leave previous room if any
    if (socket.roomId) {
      leaveRoom(socket);
    }

    socket.roomId = roomId;
    socket.peerId = peerId;

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);
    room.add(socket.id);

    // Join socket.io room for broadcasting
    socket.join(roomId);

    console.log(`Peer ${peerId} joined room ${roomId}`);

    // Notify others in the room
    socket.to(roomId).emit('peer-joined', {
      peerId,
      socketId: socket.id,
    });

    // Send list of existing peers to the new peer
    const existingPeers = Array.from(room).filter(id => id !== socket.id);
    socket.emit('room-joined', {
      roomId,
      peers: existingPeers,
    });
  });

  // Handle WebRTC signaling
  socket.on('signal', data => {
    const { targetPeerId, signal, type } = data;

    // Find the target socket
    const targetSocket = io.sockets.sockets.get(targetPeerId);
    if (targetSocket) {
      targetSocket.emit('signal', {
        peerId: socket.id,
        signal,
        type,
      });
    }
  });

  // Handle voice channel management
  socket.on('start-voice', data => {
    const { roomId } = data;
    socket.to(roomId).emit('voice-started', {
      peerId: socket.peerId,
    });
  });

  socket.on('stop-voice', data => {
    const { roomId } = data;
    socket.to(roomId).emit('voice-stopped', {
      peerId: socket.peerId,
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Peer disconnected: ${socket.id}`);
    leaveRoom(socket);
  });

  function leaveRoom(socket) {
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.delete(socket.id);

      // Notify others
      socket.to(socket.roomId).emit('peer-left', {
        peerId: socket.peerId,
        socketId: socket.id,
      });

      // Clean up empty rooms
      if (room.size === 0) {
        rooms.delete(socket.roomId);
      }

      socket.leave(socket.roomId);
    }
  }
});

server.listen(PORT, () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
  console.log(
    `Open index.html in multiple browser tabs to test peer-to-peer voice`
  );
});
