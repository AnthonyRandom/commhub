/**
 * Audio Device Manager
 *
 * Comprehensive audio device management with hot-plug detection,
 * device testing, automatic switching, and cross-platform support.
 */

export interface AudioDevice {
  deviceId: string
  label: string
  groupId: string
  kind: 'audioinput' | 'audiooutput'
  isDefault: boolean
  isPreferred: boolean
  lastTested?: Date
  testResults?: DeviceTestResults
}

export interface DeviceTestResults {
  volume: number // 0-100
  noise: number // 0-100 (lower is better)
  latency: number // ms
  quality: 'excellent' | 'good' | 'poor' | 'failed'
  timestamp: Date
}

export interface DeviceChangeEvent {
  type: 'added' | 'removed' | 'changed'
  device: AudioDevice
  previousDevices: AudioDevice[]
}

export type DeviceChangeCallback = (event: DeviceChangeEvent) => void

export class AudioDeviceManager {
  private devices: Map<string, AudioDevice> = new Map()
  private deviceChangeListeners: DeviceChangeCallback[] = []
  private deviceMonitorInterval: number | null = null
  private currentInputDevice: AudioDevice | null = null
  private currentOutputDevice: AudioDevice | null = null
  private isInitialized = false
  private lastDeviceChangeTime = 0

  // Device monitoring
  private readonly MONITOR_INTERVAL = 2000 // Check every 2 seconds
  private readonly DEVICE_CHANGE_THROTTLE = 1000 // Throttle device changes to 1 second
  private readonly TEST_TIMEOUT = 5000 // 5 seconds to test a device

  constructor() {
    this.initialize()
  }

  /**
   * Initialize the device manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Request initial permissions
      await this.requestPermissions()

      // Load initial devices
      await this.refreshDevices()

      // Set up device change monitoring
      this.setupDeviceMonitoring()

      // Load preferred devices from settings
      await this.loadPreferredDevices()

      this.isInitialized = true
      console.log('[AudioDeviceManager] Initialized successfully')
    } catch (error) {
      console.error('[AudioDeviceManager] Failed to initialize:', error)
    }
  }

  /**
   * Request microphone permissions
   */
  private async requestPermissions(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })
      // Stop the stream immediately - we just needed permissions
      stream.getTracks().forEach((track) => track.stop())
      console.log('[AudioDeviceManager] Microphone permissions granted')
    } catch (error) {
      console.warn('[AudioDeviceManager] Microphone permissions denied or failed:', error)
      throw error
    }
  }

  /**
   * Refresh the list of available audio devices
   */
  async refreshDevices(): Promise<void> {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices()
      const audioDevices = mediaDevices.filter(
        (device) => device.kind === 'audioinput' || device.kind === 'audiooutput'
      )

      const previousDevices = Array.from(this.devices.values())
      const newDevices = new Map<string, AudioDevice>()

      // Process each device
      for (const mediaDevice of audioDevices) {
        const device: AudioDevice = {
          deviceId: mediaDevice.deviceId,
          label: mediaDevice.label || `Unknown ${mediaDevice.kind}`,
          groupId: mediaDevice.groupId || '',
          kind: mediaDevice.kind as 'audioinput' | 'audiooutput',
          isDefault: false,
          isPreferred: false,
        }

        // Mark default devices
        if (mediaDevice.deviceId === 'default') {
          device.isDefault = true
          device.label = `Default ${device.kind === 'audioinput' ? 'Microphone' : 'Speaker'}`
        }

        // Preserve existing device data if it exists
        const existingDevice = this.devices.get(mediaDevice.deviceId)
        if (existingDevice) {
          device.isPreferred = existingDevice.isPreferred
          device.lastTested = existingDevice.lastTested
          device.testResults = existingDevice.testResults
        }

        newDevices.set(mediaDevice.deviceId, device)
      }

      // Detect added/removed devices
      this.detectDeviceChanges(previousDevices, Array.from(newDevices.values()))

      this.devices = newDevices
      console.log(`[AudioDeviceManager] Refreshed devices: ${this.devices.size} total`)
    } catch (error) {
      console.error('[AudioDeviceManager] Failed to refresh devices:', error)
    }
  }

  /**
   * Set up device change monitoring
   */
  private setupDeviceMonitoring(): void {
    // Use the modern devicechange event if available
    if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = () => {
        this.handleDeviceChange()
      }
    }

    // Fallback: periodic polling (less efficient but works on older browsers)
    if (!navigator.mediaDevices || navigator.mediaDevices.ondevicechange === undefined) {
      console.log('[AudioDeviceManager] Using fallback device polling')
      this.deviceMonitorInterval = window.setInterval(() => {
        this.handleDeviceChange()
      }, this.MONITOR_INTERVAL)
    }
  }

  /**
   * Handle device change events
   */
  private async handleDeviceChange(): Promise<void> {
    const now = Date.now()

    // Throttle device change notifications
    if (now - this.lastDeviceChangeTime < this.DEVICE_CHANGE_THROTTLE) {
      return
    }

    this.lastDeviceChangeTime = now

    await this.refreshDevices()

    // Auto-switch to preferred devices if current device was removed
    await this.handleDeviceRemoval()

    // Notify listeners
    this.notifyDeviceChangeListeners()
  }

  /**
   * Detect and notify about device changes
   */
  private detectDeviceChanges(previousDevices: AudioDevice[], currentDevices: AudioDevice[]): void {
    const previousIds = new Set(previousDevices.map((d) => d.deviceId))
    const currentIds = new Set(currentDevices.map((d) => d.deviceId))

    // Find added devices
    for (const device of currentDevices) {
      if (!previousIds.has(device.deviceId)) {
        this.notifyDeviceChange({
          type: 'added',
          device,
          previousDevices,
        })
      }
    }

    // Find removed devices
    for (const device of previousDevices) {
      if (!currentIds.has(device.deviceId)) {
        this.notifyDeviceChange({
          type: 'removed',
          device,
          previousDevices,
        })
      }
    }
  }

  /**
   * Handle device removal by switching to alternatives
   */
  private async handleDeviceRemoval(): Promise<void> {
    // Check if current input device is still available
    if (this.currentInputDevice && !this.devices.has(this.currentInputDevice.deviceId)) {
      console.log('[AudioDeviceManager] Current input device removed, finding alternative')
      const alternative = this.findBestAlternative('audioinput')
      if (alternative) {
        await this.setInputDevice(alternative.deviceId)
      }
    }

    // Check if current output device is still available
    if (this.currentOutputDevice && !this.devices.has(this.currentOutputDevice.deviceId)) {
      console.log('[AudioDeviceManager] Current output device removed, finding alternative')
      const alternative = this.findBestAlternative('audiooutput')
      if (alternative) {
        await this.setOutputDevice(alternative.deviceId)
      }
    }
  }

  /**
   * Find the best alternative device when current device is unavailable
   */
  private findBestAlternative(kind: 'audioinput' | 'audiooutput'): AudioDevice | null {
    const availableDevices = Array.from(this.devices.values()).filter(
      (device) => device.kind === kind
    )

    if (availableDevices.length === 0) return null

    // Prefer: Preferred device > Default device > First available
    return (
      availableDevices.find((d) => d.isPreferred) ||
      availableDevices.find((d) => d.isDefault) ||
      availableDevices[0]
    )
  }

  /**
   * Load preferred devices from settings
   */
  private async loadPreferredDevices(): Promise<void> {
    try {
      // This would integrate with the voice settings store
      // For now, we'll load from localStorage
      const savedPrefs = localStorage.getItem('commhub-audio-preferences')
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs)
        if (prefs.inputDeviceId) {
          await this.setPreferredDevice(prefs.inputDeviceId, true)
        }
        if (prefs.outputDeviceId) {
          await this.setPreferredDevice(prefs.outputDeviceId, true)
        }
      }
    } catch (error) {
      console.warn('[AudioDeviceManager] Failed to load device preferences:', error)
    }
  }

  /**
   * Set a device as preferred
   */
  async setPreferredDevice(deviceId: string, preferred: boolean): Promise<void> {
    const device = this.devices.get(deviceId)
    if (device) {
      device.isPreferred = preferred

      // Save preferences
      const prefs = {
        inputDeviceId: preferred && device.kind === 'audioinput' ? deviceId : undefined,
        outputDeviceId: preferred && device.kind === 'audiooutput' ? deviceId : undefined,
      }
      localStorage.setItem('commhub-audio-preferences', JSON.stringify(prefs))

      console.log(
        `[AudioDeviceManager] Set ${device.label} as ${preferred ? 'preferred' : 'not preferred'}`
      )
    }
  }

  /**
   * Set the active input device
   */
  async setInputDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId)
    if (!device || device.kind !== 'audioinput') {
      throw new Error(`Invalid input device: ${deviceId}`)
    }

    this.currentInputDevice = device
    console.log(`[AudioDeviceManager] Set input device: ${device.label}`)

    // Notify that the device changed
    this.notifyDeviceChange({
      type: 'changed',
      device,
      previousDevices: Array.from(this.devices.values()),
    })
  }

  /**
   * Set the active output device
   */
  async setOutputDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId)
    if (!device || device.kind !== 'audiooutput') {
      throw new Error(`Invalid output device: ${deviceId}`)
    }

    this.currentOutputDevice = device
    console.log(`[AudioDeviceManager] Set output device: ${device.label}`)

    // Note: HTML5 doesn't support programmatically changing output device
    // This would need to be handled by the operating system or browser settings
    // For now, we just track the preference

    // Notify that the device changed
    this.notifyDeviceChange({
      type: 'changed',
      device,
      previousDevices: Array.from(this.devices.values()),
    })
  }

  /**
   * Test an audio device for quality metrics
   */
  async testDevice(deviceId: string): Promise<DeviceTestResults> {
    const device = this.devices.get(deviceId)
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`)
    }

    console.log(`[AudioDeviceManager] Testing device: ${device.label}`)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      const results = await this.performDeviceTest(stream)
      stream.getTracks().forEach((track) => track.stop())

      // Update device with test results
      device.lastTested = new Date()
      device.testResults = results

      return results
    } catch (error) {
      console.error(`[AudioDeviceManager] Device test failed for ${device.label}:`, error)

      const failedResults: DeviceTestResults = {
        volume: 0,
        noise: 100,
        latency: 999,
        quality: 'failed',
        timestamp: new Date(),
      }

      device.lastTested = new Date()
      device.testResults = failedResults

      return failedResults
    }
  }

  /**
   * Perform actual device testing
   */
  private async performDeviceTest(stream: MediaStream): Promise<DeviceTestResults> {
    return new Promise((resolve) => {
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      let samples = 0
      let totalVolume = 0
      let totalNoise = 0
      const startTime = performance.now()

      const analyze = () => {
        analyser.getByteFrequencyData(dataArray)

        // Calculate volume (RMS)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i]
        }
        const rms = Math.sqrt(sum / bufferLength)
        const volume = (rms / 255) * 100

        // Estimate noise (variation in signal)
        let noise = 0
        for (let i = 1; i < bufferLength; i++) {
          noise += Math.abs(dataArray[i] - dataArray[i - 1])
        }
        noise = (noise / bufferLength) * 100

        totalVolume += volume
        totalNoise += noise
        samples++

        if (performance.now() - startTime < this.TEST_TIMEOUT) {
          requestAnimationFrame(analyze)
        } else {
          // Test complete
          const avgVolume = totalVolume / samples
          const avgNoise = totalNoise / samples
          const latency = performance.now() - startTime

          let quality: DeviceTestResults['quality'] = 'poor'
          if (avgVolume > 30 && avgNoise < 50) quality = 'excellent'
          else if (avgVolume > 20 && avgNoise < 70) quality = 'good'

          audioContext.close()

          resolve({
            volume: Math.round(avgVolume),
            noise: Math.round(avgNoise),
            latency: Math.round(latency),
            quality,
            timestamp: new Date(),
          })
        }
      }

      analyze()
    })
  }

  /**
   * Get all available devices
   */
  getDevices(): AudioDevice[] {
    return Array.from(this.devices.values())
  }

  /**
   * Get devices by type
   */
  getDevicesByType(kind: 'audioinput' | 'audiooutput'): AudioDevice[] {
    return Array.from(this.devices.values()).filter((device) => device.kind === kind)
  }

  /**
   * Get current input device
   */
  getCurrentInputDevice(): AudioDevice | null {
    return this.currentInputDevice
  }

  /**
   * Get current output device
   */
  getCurrentOutputDevice(): AudioDevice | null {
    return this.currentOutputDevice
  }

  /**
   * Get preferred devices
   */
  getPreferredDevices(): AudioDevice[] {
    return Array.from(this.devices.values()).filter((device) => device.isPreferred)
  }

  /**
   * Add device change listener
   */
  addDeviceChangeListener(callback: DeviceChangeCallback): () => void {
    // Prevent duplicate listeners
    if (this.deviceChangeListeners.includes(callback)) {
      console.warn('[AudioDeviceManager] Attempted to add duplicate device change listener')
      return () => {} // Return no-op unsubscribe function
    }

    this.deviceChangeListeners.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.deviceChangeListeners.indexOf(callback)
      if (index > -1) {
        this.deviceChangeListeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify device change listeners
   */
  private notifyDeviceChange(event: DeviceChangeEvent): void {
    this.deviceChangeListeners.forEach((callback) => {
      try {
        callback(event)
      } catch (error) {
        console.error('[AudioDeviceManager] Device change listener error:', error)
      }
    })
  }

  /**
   * Notify all listeners of current state
   */
  private notifyDeviceChangeListeners(): void {
    // This could be enhanced to send more detailed change events
    this.deviceChangeListeners.forEach((callback) => {
      // Send a general update event
      callback({
        type: 'changed',
        device:
          this.currentInputDevice ||
          this.currentOutputDevice ||
          Array.from(this.devices.values())[0],
        previousDevices: [],
      })
    })
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.deviceMonitorInterval) {
      clearInterval(this.deviceMonitorInterval)
      this.deviceMonitorInterval = null
    }

    this.devices.clear()
    this.deviceChangeListeners.length = 0
    this.currentInputDevice = null
    this.currentOutputDevice = null
    this.isInitialized = false

    console.log('[AudioDeviceManager] Destroyed')
  }
}

// Global instance
export const audioDeviceManager = new AudioDeviceManager()
