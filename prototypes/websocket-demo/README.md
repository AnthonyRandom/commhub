# WebSocket Real-Time Messaging Prototype

This prototype demonstrates basic real-time messaging functionality using Socket.IO, similar to what will be used in CommHub for text chat channels.

## Features Demonstrated

- Real-time message broadcasting to channel members
- User join/leave notifications
- Typing indicators (basic)
- Multiple channel support
- Connection handling and error management

## How to Run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. In another terminal, run the client:

   ```bash
   npm run client
   ```

4. Enter a username and channel name when prompted

5. Start chatting! Open multiple client instances to test multi-user functionality

## Commands

- Type any message and press Enter to send
- Type `/quit` to disconnect and exit

## Architecture Notes

- Server maintains channel-based rooms using Socket.IO
- Messages are broadcast to all users in the same channel
- Basic user presence tracking
- No persistence - messages exist only during server runtime

## Next Steps for CommHub

This prototype validates the core Socket.IO approach for real-time messaging. For the full implementation:

- Integrate with NestJS framework (already configured in server package)
- Add authentication and authorization
- Implement message persistence with database
- Add channel management (create/delete channels)
- Support direct messages between users
