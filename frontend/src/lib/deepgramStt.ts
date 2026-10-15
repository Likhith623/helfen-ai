const DEEPGRAM_API_KEY =
  process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || '0cdffc07282e93e2f88beab8da45c066c850b3bc'

export interface TranscriptionResult {
  transcript: string
  confidence?: number
  wordsCount?: number
}

/**
 * Transcribe an audio Blob using Deepgram Nova-2 STT with backend proxy fallback
 */
export async function transcribeWithDeepgram(audioBlob: Blob): Promise<string> {
  if (!audioBlob || audioBlob.size === 0) return ''

  // 1. Try direct Deepgram Nova-2 REST API
  try {
    const res = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': audioBlob.type || 'audio/webm'
        },
        body: audioBlob
      }
    )

    if (res.ok) {
      const data = await res.json()
      const transcript =
        data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || ''
      if (transcript) return transcript
    }
  } catch (err) {
    console.warn('Direct Deepgram request failed, trying backend proxy:', err)
  }

  // 2. Fallback to Spring Boot Backend /api/v1/stt proxy
  try {
    const res = await fetch('http://localhost:8080/api/v1/stt', {
      method: 'POST',
      headers: {
        'Content-Type': audioBlob.type || 'audio/webm'
      },
      body: audioBlob
    })

    if (res.ok) {
      const data = await res.json()
      if (data?.transcript) {
        return data.transcript.trim()
      }
    }
  } catch (err) {
    console.error('Backend STT proxy error:', err)
  }

  return ''
}

/**
 * Live Continuous Speech-to-Text Manager
 * Combines MediaRecorder for Deepgram + Web Speech API for real-time live interim feedback
 */
export class LiveVoiceRecognizer {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private recognition: any = null
  private isRunning = false
  private stream: MediaStream | null = null

  public interimText = ''
  public finalText = ''

  constructor(
    private onInterim?: (text: string) => void,
    private onFinal?: (text: string) => void
  ) {}

  public async start(stream: MediaStream): Promise<void> {
    if (this.isRunning) return
    this.stream = stream
    this.audioChunks = []
    this.interimText = ''
    this.finalText = ''
    this.isRunning = true

    // 1. Start MediaRecorder for Deepgram audio capture
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      this.mediaRecorder = new MediaRecorder(stream, { mimeType })
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data)
        }
      }
      this.mediaRecorder.start(200) // Collect 200ms audio slices
    } catch (err) {
      console.warn('MediaRecorder init warning:', err)
    }

    // 2. Initialize Browser Web Speech API for instant zero-latency visual feedback
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition()
        this.recognition.continuous = true
        this.recognition.interimResults = true
        this.recognition.lang = 'en-US'

        this.recognition.onresult = (event: any) => {
          let currentInterim = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              this.finalText += ' ' + transcript
            } else {
              currentInterim += transcript
            }
          }
          this.interimText = currentInterim
          const combined = (this.finalText + ' ' + currentInterim).trim()
          if (this.onInterim) this.onInterim(combined)
        }

        this.recognition.onerror = (e: any) => {
          // Non-fatal, Deepgram MediaRecorder will handle final transcription
          console.warn('WebSpeech interim error:', e?.error)
        }

        this.recognition.start()
      } catch (e) {
        console.warn('WebSpeech API failed to start:', e)
      }
    }
  }

  public async stop(): Promise<string> {
    if (!this.isRunning) return this.finalText.trim()
    this.isRunning = false

    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {}
      this.recognition = null
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        const result = (this.finalText + ' ' + this.interimText).trim()
        if (this.onFinal) this.onFinal(result)
        resolve(result)
        return
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm'
        })

        // Transcribe full recorded utterance through Deepgram Nova-2
        let deepgramTranscript = ''
        if (audioBlob.size > 2000) {
          try {
            deepgramTranscript = await transcribeWithDeepgram(audioBlob)
          } catch (err) {
            console.error('Deepgram transcription error:', err)
          }
        }

        // Use Deepgram if available, otherwise fallback to WebSpeech transcript
        const chosen = deepgramTranscript || (this.finalText + ' ' + this.interimText).trim()
        if (this.onFinal) this.onFinal(chosen)
        resolve(chosen)
      }

      try {
        this.mediaRecorder.stop()
      } catch {
        resolve((this.finalText + ' ' + this.interimText).trim())
      }
    })
  }
}
