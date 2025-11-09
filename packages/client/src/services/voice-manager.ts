/**
 * Voice Manager - Backwards compatibility wrapper
 * This file maintains the original API while delegating to the new modular structure
 *
 * The voice manager has been refactored from 849 lines into specialized modules:
 * - connection-manager.ts: Join/leave voice channels
 * - signaling-handler.ts: WebRTC signaling (offer/answer/ICE)
 * - settings-manager.ts: Audio controls (mute, volume, etc.)
 * - device-manager.ts: Audio/video device management
 * - quality-monitor.ts: Connection quality tracking
 * - camera-manager.ts: Camera controls
 *
 * All original functionality is preserved through delegation.
 */

import { voiceConnectionManager } from './voice/connection-manager'

// Re-export the main voice manager instance
export const voiceManager = voiceConnectionManager

// Type exports for backwards compatibility
export type { VoiceUser, VoiceChannelData, VoiceSettings, QualityStatus } from './voice/types'
