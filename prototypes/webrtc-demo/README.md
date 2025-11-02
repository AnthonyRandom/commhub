# WebRTC Voice Communication Prototype

This prototype demonstrates peer-to-peer voice communication using WebRTC, similar to what will be used in CommHub for voice channels.

## Features Demonstrated

- Peer-to-peer audio streaming using WebRTC
- Signaling server for connection establishment
- Room-based voice channels
- Real-time connection status
- Audio stream management (start/stop voice)

## How to Run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the signaling server:

   ```bash
   node signaling-server.js
   ```

3. In another terminal, start the web server:

   ```bash
   npm start
   ```

4. Open `http://localhost:3002` in multiple browser tabs/windows

5. In each tab:
   - Enter the same room ID (e.g., "test-room")
   - Click "Join Room"
   - Click "Start Voice" to begin audio streaming

## Architecture Notes

- Uses `simple-peer` library for WebRTC abstraction
- Socket.IO for signaling (offer/answer exchange)
- No STUN/TURN servers configured (works on local network)
- Audio-only streams (no video)

## Browser Requirements

- Modern browser with WebRTC support (Chrome, Firefox, Edge)
- Microphone permissions required
- HTTPS required for production (or localhost for development)

## Testing Multi-User Audio

1. Open the app in 2+ browser tabs
2. Join the same room in all tabs
3. Start voice in each tab
4. Speak into microphone - audio should be heard in other tabs

## Next Steps for CommHub

This prototype validates the WebRTC approach for voice communication. For the full implementation:

- Integrate with Tauri desktop framework
- Add audio controls (mute/unmute, volume)
- Implement push-to-talk functionality
- Add voice activity detection
- Configure STUN/TURN servers for internet connectivity
- Handle network interruptions gracefully
- Add voice channel management (join/leave rooms)

## Known Limitations

- Requires microphone permissions
- No echo cancellation or noise suppression
- Basic audio quality (configurable in production)
- No fallback for non-WebRTC browsers
