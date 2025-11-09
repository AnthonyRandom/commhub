import type { voiceManager } from './voice-manager'

type VoiceManager = typeof voiceManager

let voiceManagerInstance: VoiceManager | null = null

/**
 * Get voice manager instance (async)
 * Creates singleton on first call and initializes it
 */
export async function getVoiceManager(): Promise<VoiceManager> {
  if (!voiceManagerInstance) {
    const module = await import('./voice-manager')
    voiceManagerInstance = module.voiceManager
    voiceManagerInstance.initialize()
  }
  return voiceManagerInstance
}

/**
 * Get voice manager instance synchronously
 * Returns null if not yet initialized
 */
export function getVoiceManagerSync(): VoiceManager | null {
  return voiceManagerInstance
}
