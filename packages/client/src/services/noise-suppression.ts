/**
 * Noise Suppression Processor
 *
 * Provides a framework for integrating various noise suppression technologies
 * including RNNoise, Krisp, and built-in WebRTC noise suppression.
 */

export type NoiseSuppressionMethod = 'none' | 'webrtc' | 'rnnoise' | 'krisp' | 'noise-gate'

export interface NoiseSuppressionConfig {
  method: NoiseSuppressionMethod
  intensity: number // 0-100, how aggressive the suppression is
  noiseGateThreshold: number // 0-100, volume threshold for noise gate
  attackTime: number // ms, how quickly to apply suppression
  releaseTime: number // ms, how quickly to release suppression
  enabled: boolean
}

export interface NoiseSuppressionStats {
  method: NoiseSuppressionMethod
  enabled: boolean
  processingLatency: number // ms
  noiseReduction: number // dB
  cpuUsage: number // percentage
  lastProcessedAt: number
}

class NoiseGateProcessor {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private gainNode: GainNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null

  private config: NoiseSuppressionConfig
  private isActive = false
  private currentGain = 1.0

  constructor(config: NoiseSuppressionConfig) {
    this.config = { ...config }
  }

  async initialize(stream: MediaStream): Promise<MediaStream> {
    if (!this.config.enabled || this.config.method !== 'noise-gate') {
      return stream
    }

    try {
      this.context = new AudioContext()
      this.analyser = this.context.createAnalyser()
      this.gainNode = this.context.createGain()
      this.source = this.context.createMediaStreamSource(stream)

      // Set up analyser for volume detection
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.3

      // Create script processor for real-time processing
      this.processor = this.context.createScriptProcessor(1024, 1, 1)

      // Connect the audio graph
      this.source.connect(this.analyser)
      this.source.connect(this.gainNode)
      this.processor.connect(this.context.destination)

      // Connect the gain node to destination for output
      this.gainNode.connect(this.context.destination)

      // Set up processing callback
      this.processor.onaudioprocess = this.processAudio.bind(this)

      // For now, return the original stream since we can't easily create a new MediaStream
      // from Web Audio API nodes in this implementation
      this.isActive = true
      console.log('[NoiseGate] Initialized noise gate processor')

      return stream
    } catch (error) {
      console.error('[NoiseGate] Failed to initialize:', error)
      return stream
    }
  }

  private processAudio(event: AudioProcessingEvent) {
    if (!this.analyser || !this.gainNode) return

    const inputBuffer = event.inputBuffer
    const outputBuffer = event.outputBuffer

    // Get volume level
    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)

    // Calculate RMS volume
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i]
    }
    const rms = Math.sqrt(sum / bufferLength)
    const volumePercent = (rms / 255) * 100

    // Apply noise gate
    const threshold = this.config.noiseGateThreshold
    const targetGain = volumePercent > threshold ? 1.0 : 0.0

    // Smooth gain changes to prevent clicking
    const smoothingFactor = 0.1
    this.currentGain += (targetGain - this.currentGain) * smoothingFactor

    // Apply gain
    this.gainNode.gain.value = this.currentGain

    // Copy input to output (gain is applied via gainNode)
    for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
      const inputData = inputBuffer.getChannelData(channel)
      const outputData = outputBuffer.getChannelData(channel)

      for (let i = 0; i < inputBuffer.length; i++) {
        outputData[i] = inputData[i]
      }
    }
  }

  updateConfig(config: Partial<NoiseSuppressionConfig>) {
    this.config = { ...this.config, ...config }
  }

  destroy() {
    this.isActive = false

    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.gainNode) {
      this.gainNode.disconnect()
      this.gainNode = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.context && this.context.state !== 'closed') {
      this.context.close()
      this.context = null
    }
  }

  isEnabled(): boolean {
    return this.isActive
  }

  getStats(): NoiseSuppressionStats {
    return {
      method: 'noise-gate',
      enabled: this.isActive,
      processingLatency: 10, // Estimated
      noiseReduction: Math.min(this.config.intensity * 0.5, 20), // Estimated dB
      cpuUsage: 5, // Estimated
      lastProcessedAt: Date.now(),
    }
  }
}

class RNNoiseProcessor {
  // Placeholder for RNNoise integration
  // In a real implementation, this would load the RNNoise WebAssembly module

  private config: NoiseSuppressionConfig
  private isActive = false

  constructor(config: NoiseSuppressionConfig) {
    this.config = { ...config }
  }

  async initialize(stream: MediaStream): Promise<MediaStream> {
    if (!this.config.enabled || this.config.method !== 'rnnoise') {
      return stream
    }

    // TODO: Load RNNoise WASM module and set up audio processing
    console.warn('[RNNoise] RNNoise integration not implemented yet, using passthrough')
    this.isActive = false
    return stream
  }

  updateConfig(config: Partial<NoiseSuppressionConfig>) {
    this.config = { ...this.config, ...config }
  }

  destroy() {
    this.isActive = false
    // TODO: Clean up RNNoise resources
  }

  isEnabled(): boolean {
    return this.isActive
  }

  getStats(): NoiseSuppressionStats {
    return {
      method: 'rnnoise',
      enabled: this.isActive,
      processingLatency: 15,
      noiseReduction: this.isActive ? 15 : 0,
      cpuUsage: this.isActive ? 15 : 0,
      lastProcessedAt: Date.now(),
    }
  }
}

class KrispProcessor {
  // Placeholder for Krisp integration
  // In a real implementation, this would integrate with Krisp SDK

  private config: NoiseSuppressionConfig
  private isActive = false

  constructor(config: NoiseSuppressionConfig) {
    this.config = { ...config }
  }

  async initialize(stream: MediaStream): Promise<MediaStream> {
    if (!this.config.enabled || this.config.method !== 'krisp') {
      return stream
    }

    // TODO: Initialize Krisp SDK and set up audio processing
    console.warn('[Krisp] Krisp integration not implemented yet, using passthrough')
    this.isActive = false
    return stream
  }

  updateConfig(config: Partial<NoiseSuppressionConfig>) {
    this.config = { ...this.config, ...config }
  }

  destroy() {
    this.isActive = false
    // TODO: Clean up Krisp resources
  }

  isEnabled(): boolean {
    return this.isActive
  }

  getStats(): NoiseSuppressionStats {
    return {
      method: 'krisp',
      enabled: this.isActive,
      processingLatency: 12,
      noiseReduction: this.isActive ? 20 : 0,
      cpuUsage: this.isActive ? 20 : 0,
      lastProcessedAt: Date.now(),
    }
  }
}

/**
 * Main Noise Suppression Processor
 * Routes to appropriate implementation based on method
 */
export class NoiseSuppressionProcessor {
  private processors = new Map<NoiseSuppressionMethod, any>()
  private currentMethod: NoiseSuppressionMethod = 'none'
  private currentConfig: NoiseSuppressionConfig
  private currentStream: MediaStream | null = null

  constructor(config: NoiseSuppressionConfig) {
    this.currentConfig = { ...config }

    // Initialize all processor types
    this.processors.set('noise-gate', new NoiseGateProcessor(config))
    this.processors.set('rnnoise', new RNNoiseProcessor(config))
    this.processors.set('krisp', new KrispProcessor(config))
  }

  async initialize(stream: MediaStream): Promise<MediaStream> {
    this.currentStream = stream

    if (!this.currentConfig.enabled || this.currentConfig.method === 'none') {
      return stream
    }

    if (this.currentConfig.method === 'webrtc') {
      // WebRTC noise suppression is handled via audio constraints
      return stream
    }

    const processor = this.processors.get(this.currentConfig.method)
    if (processor) {
      const processedStream = await processor.initialize(stream)
      this.currentMethod = this.currentConfig.method
      return processedStream
    }

    console.warn(`[NoiseSuppression] Unknown method: ${this.currentConfig.method}`)
    return stream
  }

  updateConfig(config: Partial<NoiseSuppressionConfig>) {
    this.currentConfig = { ...this.currentConfig, ...config }

    // Update all processors
    this.processors.forEach((processor) => {
      processor.updateConfig(this.currentConfig)
    })

    // Reinitialize if method changed and we have a stream
    if (config.method && config.method !== this.currentMethod && this.currentStream) {
      this.reinitialize()
    }
  }

  private async reinitialize() {
    if (!this.currentStream) return

    // Clean up current processor
    if (this.currentMethod !== 'none' && this.currentMethod !== 'webrtc') {
      const oldProcessor = this.processors.get(this.currentMethod)
      if (oldProcessor) {
        oldProcessor.destroy()
      }
    }

    // Reinitialize with new method
    const newStream = await this.initialize(this.currentStream)
    this.currentStream = newStream
  }

  destroy() {
    this.processors.forEach((processor) => {
      processor.destroy()
    })
    this.processors.clear()
    this.currentStream = null
    this.currentMethod = 'none'
  }

  getStats(): NoiseSuppressionStats {
    if (this.currentMethod === 'none') {
      return {
        method: 'none',
        enabled: false,
        processingLatency: 0,
        noiseReduction: 0,
        cpuUsage: 0,
        lastProcessedAt: 0,
      }
    }

    if (this.currentMethod === 'webrtc') {
      return {
        method: 'webrtc',
        enabled: true,
        processingLatency: 5,
        noiseReduction: 10,
        cpuUsage: 2,
        lastProcessedAt: Date.now(),
      }
    }

    const processor = this.processors.get(this.currentMethod)
    return processor ? processor.getStats() : this.getStats()
  }

  isEnabled(): boolean {
    return this.currentConfig.enabled && this.currentMethod !== 'none'
  }

  getCurrentMethod(): NoiseSuppressionMethod {
    return this.currentMethod
  }

  getSupportedMethods(): NoiseSuppressionMethod[] {
    return ['none', 'webrtc', 'noise-gate', 'rnnoise', 'krisp']
  }
}

// Factory function for creating noise suppression processors
export function createNoiseSuppressionProcessor(
  config: NoiseSuppressionConfig
): NoiseSuppressionProcessor {
  return new NoiseSuppressionProcessor(config)
}

// Default configuration
export const defaultNoiseSuppressionConfig: NoiseSuppressionConfig = {
  method: 'webrtc',
  intensity: 50,
  noiseGateThreshold: 20,
  attackTime: 10,
  releaseTime: 100,
  enabled: true,
}
