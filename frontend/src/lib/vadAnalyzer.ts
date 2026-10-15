export interface VadConfig {
  speechThreshold?: number // RMS threshold to count as speech (default: 0.025)
  silenceDurationMs?: number // How long silence must persist before turn completes (default: 1400ms)
  minSpeechDurationMs?: number // Minimum speech duration to prevent false triggers (default: 400ms)
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onVolumeChange?: (volume: number) => void
}

export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private animationId: number | null = null

  private isSpeaking = false
  private speechStartTime = 0
  private lastSpeechTime = 0
  private silenceDurationMs: number
  private speechThreshold: number
  private minSpeechDurationMs: number

  private onSpeechStart?: () => void
  private onSpeechEnd?: () => void
  private onVolumeChange?: (volume: number) => void

  public frequencyData: Uint8Array = new Uint8Array(64)

  constructor(config: VadConfig = {}) {
    this.speechThreshold = config.speechThreshold ?? 0.022
    this.silenceDurationMs = config.silenceDurationMs ?? 1400
    this.minSpeechDurationMs = config.minSpeechDurationMs ?? 350
    this.onSpeechStart = config.onSpeechStart
    this.onSpeechEnd = config.onSpeechEnd
    this.onVolumeChange = config.onVolumeChange
  }

  public start(stream: MediaStream): void {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    this.audioContext = new AudioContextClass()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 128
    this.analyser.smoothingTimeConstant = 0.8

    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)

    this.source = this.audioContext.createMediaStreamSource(stream)
    this.source.connect(this.analyser)

    this.isSpeaking = false
    this.speechStartTime = 0
    this.lastSpeechTime = 0

    this.analyze()
  }

  private analyze = (): void => {
    if (!this.analyser) return

    const timeDomainData = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(timeDomainData)
    this.analyser.getByteFrequencyData(this.frequencyData)

    // Calculate Root Mean Square (RMS) volume level
    let sumSquares = 0
    for (let i = 0; i < timeDomainData.length; i++) {
      sumSquares += timeDomainData[i] * timeDomainData[i]
    }
    const rms = Math.sqrt(sumSquares / timeDomainData.length)
    const normalizedVolume = Math.min(1.0, rms * 5.0)

    if (this.onVolumeChange) {
      this.onVolumeChange(normalizedVolume)
    }

    const now = Date.now()

    if (rms > this.speechThreshold) {
      this.lastSpeechTime = now

      if (!this.isSpeaking) {
        if (this.speechStartTime === 0) {
          this.speechStartTime = now
        } else if (now - this.speechStartTime >= this.minSpeechDurationMs) {
          this.isSpeaking = true
          if (this.onSpeechStart) {
            this.onSpeechStart()
          }
        }
      }
    } else {
      this.speechStartTime = 0

      // If user was speaking and silence has lasted longer than silenceDurationMs -> trigger turn completion
      if (this.isSpeaking && this.lastSpeechTime > 0) {
        if (now - this.lastSpeechTime >= this.silenceDurationMs) {
          this.isSpeaking = false
          this.lastSpeechTime = 0
          if (this.onSpeechEnd) {
            this.onSpeechEnd()
          }
        }
      }
    }

    this.animationId = requestAnimationFrame(this.analyze)
  }

  public stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    if (this.source) {
      try {
        this.source.disconnect()
      } catch {}
      this.source = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close()
      } catch {}
      this.audioContext = null
    }

    this.isSpeaking = false
  }
}
