import React, { useState, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  PhoneOff,
  Camera,
  CameraOff,
  ChevronDown,
} from 'lucide-react'
import { useVoiceStore } from '../stores/voice'
import { voiceManager } from '../services/voice-manager'
import { soundManager } from '../services/sound-manager'
import { useVoiceSettingsStore } from '../stores/voice-settings'
import type { Channel } from '../services/api'

interface VoiceControlsProps {
  channel: Channel
}

const VoiceControls: React.FC<VoiceControlsProps> = ({ channel }) => {
  const {
    connectedChannelId,
    isMuted,
    isDeafened,
    isConnecting,
    connectionError,
    localVideoEnabled,
  } = useVoiceStore()
  const [showCameraPreview, setShowCameraPreview] = useState(false)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const voiceSettings = useVoiceSettingsStore((state) => state.settings)

  const isConnected = connectedChannelId === channel.id

  const handleToggleMute = () => {
    voiceManager.toggleMute()
    soundManager.playMuteToggle()
  }

  const handleToggleDeafen = () => {
    voiceManager.toggleDeafen()
    soundManager.playDeafenToggle()
  }

  const handleDisconnect = () => {
    voiceManager.leaveVoiceChannel()
  }

  const handleToggleCamera = async () => {
    if (localVideoEnabled) {
      try {
        await voiceManager.disableCamera()
      } catch (err) {
        console.error('Failed to disable camera:', err)
      }
    } else {
      setShowCameraPreview(true)
    }
  }

  // Load video devices when modal opens
  useEffect(() => {
    if (showCameraPreview) {
      loadVideoDevices()
    }
  }, [showCameraPreview])

  // Set preview video stream
  useEffect(() => {
    if (previewVideoRef.current && previewStream) {
      previewVideoRef.current.srcObject = previewStream
    }
  }, [previewStream])

  // Cleanup preview stream when modal closes
  useEffect(() => {
    if (!showCameraPreview && previewStream) {
      previewStream.getTracks().forEach((track) => track.stop())
      setPreviewStream(null)
    }
  }, [showCameraPreview])

  const loadVideoDevices = async () => {
    try {
      const devices = await voiceManager.getAvailableVideoDevices()
      setAvailableDevices(devices)

      const currentDevice = voiceSettings.video.deviceId
      if (currentDevice && devices.some((d) => d.deviceId === currentDevice)) {
        setSelectedDevice(currentDevice)
      } else if (devices.length > 0) {
        setSelectedDevice(devices[0].deviceId)
      }
    } catch (err) {
      console.error('Failed to load video devices:', err)
      setError('Failed to load camera devices. Please check permissions.')
    }
  }

  const startPreview = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop())
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setPreviewStream(stream)
      setError(null)
    } catch (err) {
      console.error('Failed to start preview:', err)
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera permissions.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera.')
        } else if (err.name === 'NotReadableError') {
          setError('Camera is in use by another application.')
        } else {
          setError('Failed to access camera.')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDevice(deviceId)
    if (previewStream) {
      await startPreview()
    }
  }

  const handleEnableCamera = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (selectedDevice !== voiceSettings.video.deviceId) {
        useVoiceSettingsStore.getState().updateVideoSettings({ deviceId: selectedDevice })
      }

      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop())
        setPreviewStream(null)
      }

      await voiceManager.enableCamera()
      setShowCameraPreview(false)
    } catch (err) {
      console.error('Failed to enable camera:', err)
      setError(err instanceof Error ? err.message : 'Failed to enable camera')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isConnected && !isConnecting) {
    return null
  }

  return (
    <div className="border-t-2 border-grey-800 bg-grey-950 animate-slide-down">
      {/* Connection Status */}
      {isConnecting && (
        <div className="p-2 bg-grey-900 border-b-2 border-grey-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin"></div>
            <span className="text-grey-300 text-xs">Connecting...</span>
          </div>
        </div>
      )}

      {connectionError && (
        <div className="p-2 bg-red-900 border-b-2 border-red-700">
          <p className="text-white text-xs">{connectionError}</p>
        </div>
      )}

      <div className="p-3">
        {/* Voice Controls */}
        <div className="flex gap-2">
          <button
            onClick={handleToggleMute}
            className={`flex-1 p-2.5 border-2 font-bold text-xs transition-all duration-100 ${
              isMuted
                ? 'bg-red-900 border-red-700 text-white hover:bg-red-800'
                : 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <div className="flex items-center justify-center gap-1.5">
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'Muted' : 'Mute'}</span>
            </div>
          </button>

          <button
            onClick={handleToggleDeafen}
            className={`flex-1 p-2.5 border-2 font-bold text-xs transition-all duration-100 ${
              isDeafened
                ? 'bg-red-900 border-red-700 text-white hover:bg-red-800'
                : 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            <div className="flex items-center justify-center gap-1.5">
              {isDeafened ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Headphones className="w-3.5 h-3.5" />
              )}
              <span>{isDeafened ? 'Deafened' : 'Deafen'}</span>
            </div>
          </button>

          <button
            onClick={handleToggleCamera}
            className={`flex-1 p-2.5 border-2 font-bold text-xs transition-all duration-100 ${
              localVideoEnabled
                ? 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
                : 'bg-grey-850 border-grey-700 text-white hover:bg-grey-800 hover:border-white'
            }`}
            title={localVideoEnabled ? 'Disable Camera' : 'Enable Camera'}
          >
            <div className="flex items-center justify-center gap-1.5">
              {localVideoEnabled ? (
                <CameraOff className="w-3.5 h-3.5" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <span>{localVideoEnabled ? 'Camera' : 'Camera'}</span>
            </div>
          </button>

          <button
            onClick={handleDisconnect}
            className="p-2.5 bg-red-900 border-2 border-red-700 text-white hover:bg-red-800 hover:border-red-500 transition-all duration-100"
            title="Disconnect"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Camera Preview Modal */}
      {showCameraPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-grey-900 border-2 border-white w-[600px] max-h-[80vh] flex flex-col animate-slide-up">
            <div className="border-b-2 border-grey-800 p-4 flex items-center justify-between">
              <h3 className="font-bold text-white text-lg uppercase tracking-wider">
                Camera Setup
              </h3>
              <button
                onClick={() => setShowCameraPreview(false)}
                className="p-1 text-grey-400 hover:text-white transition-colors"
                disabled={isLoading}
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-grey-950 border-2 border-grey-700 aspect-video flex items-center justify-center overflow-hidden">
                {previewStream ? (
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="text-center p-6">
                    <Camera className="w-16 h-16 text-grey-600 mx-auto mb-4" />
                    <p className="text-grey-400 mb-4">Click "Start Preview" to see your camera</p>
                    {!isLoading && (
                      <button
                        onClick={startPreview}
                        className="px-4 py-2 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-bold"
                      >
                        Start Preview
                      </button>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-900 border-2 border-red-700 p-4 animate-slide-down">
                  <p className="text-white text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-grey-300 text-sm font-bold mb-2">Camera Device</label>
                <div className="relative">
                  <select
                    value={selectedDevice}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="w-full bg-grey-850 border-2 border-grey-700 px-4 py-2 text-white appearance-none cursor-pointer hover:border-grey-600 transition-colors pr-10"
                    disabled={isLoading}
                  >
                    {availableDevices.length === 0 ? (
                      <option value="">No cameras found</option>
                    ) : (
                      availableDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-grey-400 pointer-events-none" />
                </div>
              </div>

              <div className="bg-grey-850 border-2 border-grey-700 p-4">
                <p className="text-grey-300 text-sm mb-2">
                  <span className="font-bold">Resolution:</span> {voiceSettings.video.resolution}
                </p>
                <p className="text-grey-300 text-sm">
                  <span className="font-bold">Frame Rate:</span> {voiceSettings.video.frameRate} FPS
                </p>
                <p className="text-grey-500 text-xs mt-2">
                  Quality may be adjusted automatically based on connection
                </p>
              </div>
            </div>

            <div className="border-t-2 border-grey-800 p-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCameraPreview(false)}
                className="px-4 py-2 bg-grey-850 text-white border-2 border-grey-700 hover:border-white transition-colors font-bold"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleEnableCamera}
                className="px-4 py-2 bg-white text-black border-2 border-white hover:bg-grey-100 transition-colors font-bold flex items-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin"></div>
                    <span>Enabling...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Enable Camera</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VoiceControls
