import type SimplePeer from 'simple-peer'

export interface PeerConnection {
  peer: SimplePeer.Instance
  userId: number
  username: string
  audioElement?: HTMLAudioElement
  videoElement?: HTMLVideoElement
  retryCount: number
  lastConnectAttempt: number
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
  onSignal: (signal: SimplePeer.SignalData) => void
  onStream: (stream: MediaStream) => void
  onClose: () => void
}
