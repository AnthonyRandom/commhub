export interface VoiceUser {
  userId: number
  username: string
  isSpeaking: boolean
  isMuted: boolean
  hasVideo: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'failed'
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected'
  localMuted: boolean
  localVolume: number
}

export interface VoiceChannelData {
  channelId: number
  users: Array<{ userId: number; username: string }>
}

export interface VoiceSettings {
  detectionMode: 'voice' | 'push-to-talk'
  attenuation: number
  masterVolume: number
  inputDevice: string
  outputDevice: string
}

export interface QualityStatus {
  overall: string
  warnings: string[]
  isDegraded: boolean
  description: string
}
