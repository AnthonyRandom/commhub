class SoundManager {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true

  /**
   * Initialize the sound manager
   */
  initialize() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
  }

  /**
   * Play a simple tone
   */
  private playTone(frequency: number, duration: number, volume: number = 0.3) {
    if (!this.enabled || !this.audioContext) return

    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      // Envelope for smooth sound
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + duration)
    } catch (error) {
      console.error('Failed to play sound:', error)
    }
  }

  /**
   * Play user joined sound - ascending notes
   */
  playUserJoined() {
    if (!this.audioContext) {
      this.initialize()
    }

    // Play two ascending tones
    this.playTone(523.25, 0.1, 0.2) // C5
    setTimeout(() => {
      this.playTone(659.25, 0.15, 0.2) // E5
    }, 80)
  }

  /**
   * Play user left sound - descending notes
   */
  playUserLeft() {
    if (!this.audioContext) {
      this.initialize()
    }

    // Play two descending tones
    this.playTone(659.25, 0.1, 0.2) // E5
    setTimeout(() => {
      this.playTone(523.25, 0.15, 0.2) // C5
    }, 80)
  }

  /**
   * Play mute toggle sound
   */
  playMuteToggle() {
    if (!this.audioContext) {
      this.initialize()
    }

    // Single short beep
    this.playTone(392, 0.08, 0.15) // G4
  }

  /**
   * Play deafen toggle sound
   */
  playDeafenToggle() {
    if (!this.audioContext) {
      this.initialize()
    }

    // Double beep
    this.playTone(293.66, 0.08, 0.15) // D4
    setTimeout(() => {
      this.playTone(293.66, 0.08, 0.15) // D4
    }, 100)
  }

  /**
   * Enable or disable sounds
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  /**
   * Check if sounds are enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }
}

// Export singleton instance
export const soundManager = new SoundManager()
export default soundManager
