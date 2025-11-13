export interface PeerConnection {
  peerConnection: RTCPeerConnection
  userId: number
  username: string
  audioElement?: HTMLAudioElement
  videoElement?: HTMLVideoElement
  retryCount: number
  lastConnectAttempt: number
  dataChannel?: RTCDataChannel
}

export interface ConnectionState {
  quality: 'excellent' | 'good' | 'poor' | 'critical' | 'connecting' | 'unknown'
  status: 'connecting' | 'connected' | 'disconnected' | 'failed'
  latency?: number
  packetLoss?: number
  jitter?: number
}

export interface SpeakingDetectionConfig {
  mode: 'voice' | 'push-to-talk'
  threshold: number
  pttKey: string
  autoGainControl: boolean
  noiseSuppression: boolean
  echoCancellation: boolean
}

export interface NoiseSuppressionConfig {
  enabled: boolean
  method: 'native' | 'processor'
  intensity: number
}

export interface ConnectionCallbacks {
  onSignal: (signal: RTCSessionDescriptionInit | RTCIceCandidate) => void
  onStream: (stream: MediaStream) => void
  onClose: () => void
  onIceCandidate?: (candidate: RTCIceCandidate) => void
}
