import { useVoiceStore } from '../../stores/voice'
import type { QualityStatus } from './types'

/**
 * Monitors voice connection quality and provides feedback
 * Tracks connection status and quality metrics for all peers
 */
export class VoiceQualityMonitor {
  getConnectionQualities(): Map<number, string> {
    const qualities = new Map<number, string>()
    const users = Array.from(useVoiceStore.getState().connectedUsers.values())

    for (const user of users) {
      qualities.set(user.userId, user.connectionQuality)
    }

    return qualities
  }

  getOverallQuality(): string {
    const qualities = Array.from(this.getConnectionQualities().values())
    if (qualities.length === 0) return 'disconnected'
    if (qualities.some((q) => q === 'poor')) return 'poor'
    if (qualities.some((q) => q === 'good')) return 'good'
    return 'excellent'
  }

  getQualityWarnings(): string[] {
    const warnings: string[] = []
    const users = Array.from(useVoiceStore.getState().connectedUsers.values())

    for (const user of users) {
      if (user.connectionQuality === 'poor') {
        warnings.push(`Poor connection with ${user.username}`)
      }
    }

    return warnings
  }

  isQualityDegraded(): boolean {
    const qualities = Array.from(this.getConnectionQualities().values())
    return qualities.some((q) => q === 'poor' || q === 'disconnected')
  }

  getQualityStatusDescription(): string {
    const overall = this.getOverallQuality()

    switch (overall) {
      case 'excellent':
        return 'Voice quality is excellent'
      case 'good':
        return 'Voice quality is good'
      case 'poor':
        return 'Voice quality is poor - connection issues detected'
      case 'disconnected':
        return 'Not connected to voice'
      default:
        return 'Unknown voice quality'
    }
  }

  getQualityStatus(): QualityStatus {
    return {
      overall: this.getOverallQuality(),
      warnings: this.getQualityWarnings(),
      isDegraded: this.isQualityDegraded(),
      description: this.getQualityStatusDescription(),
    }
  }
}

export const voiceQualityMonitor = new VoiceQualityMonitor()
