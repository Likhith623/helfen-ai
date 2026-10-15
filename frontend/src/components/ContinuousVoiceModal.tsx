'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Mic, MicOff, PhoneOff, Volume2, VolumeX, Sparkles,
  X, Check, AlertCircle, MessageSquare, RefreshCw
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { VoiceWaveformOrb } from '@/components/VoiceWaveformOrb'
import { VoiceActivityDetector } from '@/lib/vadAnalyzer'
import { LiveVoiceRecognizer } from '@/lib/deepgramStt'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export function ContinuousVoiceModal() {
  const {
    isContinuousVoiceActive, stopContinuousVoice,
    voiceModeStatus, setVoiceModeStatus,
    voiceUserTranscript, setVoiceUserTranscript,
    voiceAiTranscript, setVoiceAiTranscript,
    voiceVolumeLevel, setVoiceVolumeLevel,
    voiceIsMuted, toggleVoiceMute,
    selectedModel, activeConversationId, setActiveConversationId,
    addMessage, updateMessage, addConversation, isTemporaryChat,
    ragModeEnabled, knowledgeDocuments
  } = useAppStore()

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showCaptions, setShowCaptions] = useState(true)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const vadRef = useRef<VoiceActivityDetector | null>(null)
  const recognizerRef = useRef<LiveVoiceRecognizer | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const isSpeakingRef = useRef<boolean>(false)
  const activePromptRef = useRef<string>('')

  // Keep ref sync of voice state for event listeners
  const statusRef = useRef(voiceModeStatus)
  useEffect(() => {
    statusRef.current = voiceModeStatus
    isSpeakingRef.current = voiceModeStatus === 'speaking'
  }, [voiceModeStatus])

  const mutedRef = useRef(voiceIsMuted)
  useEffect(() => {
    mutedRef.current = voiceIsMuted
  }, [voiceIsMuted])

  /* Stop audio playback helper */
  const stopAiSpeech = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
    }
  }, [])

  /* Send user prompt to LLM and trigger Cartesia TTS */
  const processUserPrompt = useCallback(
    async (spokenText: string) => {
      const cleanPrompt = spokenText.trim()
      if (!cleanPrompt) {
        setVoiceModeStatus('listening')
        startListeningTurn()
        return
      }

      setVoiceModeStatus('thinking')
      setVoiceUserTranscript(cleanPrompt)
      setVoiceAiTranscript('')

      // 1. Add user message to chat thread
      let convId = activeConversationId
      const userMsgId = crypto.randomUUID()
      addMessage({
        id: userMsgId,
        conversation_id: convId || 'temp',
        role: 'user',
        content: cleanPrompt,
        created_at: new Date().toISOString()
      })

      if (convId && !isTemporaryChat) {
        supabase
          .from('messages')
          .insert({
            id: userMsgId,
            conversation_id: convId,
            role: 'user',
            content: cleanPrompt
          })
          .then()
      }

      // 2. Prepare AI assistant message placeholder
      const aiMsgId = crypto.randomUUID()
      addMessage({
        id: aiMsgId,
        conversation_id: convId || 'temp',
        role: 'assistant',
        content: '',
        model: selectedModel,
        created_at: new Date().toISOString()
      })

      // 3. Call backend chat API
      try {
        const res = await fetch('http://localhost:8080/api/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            messages: [{ role: 'user', content: cleanPrompt }],
            model: selectedModel,
            isTemporary: isTemporaryChat
          })
        })

        if (!res.ok) throw new Error('Chat API failure')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No streaming body')

        const decoder = new TextDecoder()
        let fullAiText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          for (const line of chunk.split('\n').filter(Boolean)) {
            if (line.startsWith('data:')) {
              const jsonStr = line.slice(5).trim()
              if (!jsonStr) continue
              try {
                const parsed = JSON.parse(jsonStr)
                if (parsed.content) {
                  fullAiText += parsed.content
                  updateMessage(aiMsgId, { content: fullAiText })
                  setVoiceAiTranscript(fullAiText)
                }
              } catch {}
            }
          }
        }

        if (convId && !isTemporaryChat && fullAiText) {
          supabase
            .from('messages')
            .insert({
              id: aiMsgId,
              conversation_id: convId,
              role: 'assistant',
              content: fullAiText,
              model: selectedModel
            })
            .then()
        }

        // 4. Stream and speak response via Cartesia TTS
        if (fullAiText.trim()) {
          await playCartesiaTts(fullAiText)
        } else {
          setVoiceModeStatus('listening')
          startListeningTurn()
        }
      } catch (err) {
        console.error('Voice loop error:', err)
        setVoiceAiTranscript('Sorry, I encountered an issue while generating a response.')
        setVoiceModeStatus('listening')
        startListeningTurn()
      }
    },
    [activeConversationId, isTemporaryChat, selectedModel, addMessage, updateMessage]
  )

  /* Play Cartesia audio and auto-transition when done */
  const playCartesiaTts = useCallback(
    async (textToSpeak: string) => {
      setVoiceModeStatus('speaking')
      stopAiSpeech()

      try {
        const ttsRes = await fetch('http://localhost:8080/api/v1/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSpeak })
        })

        if (!ttsRes.ok) throw new Error('Cartesia TTS failed')

        const audioBlob = await ttsRes.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        currentAudioRef.current = audio

        audio.onended = () => {
          stopAiSpeech()
          if (statusRef.current === 'speaking') {
            setVoiceModeStatus('listening')
            startListeningTurn()
          }
        }

        audio.onerror = () => {
          stopAiSpeech()
          setVoiceModeStatus('listening')
          startListeningTurn()
        }

        await audio.play()
      } catch (err) {
        console.error('Cartesia playback error:', err)
        setVoiceModeStatus('listening')
        startListeningTurn()
      }
    },
    [stopAiSpeech]
  )

  /* Turn completion: user finished speaking */
  const handleUserFinishedSpeaking = useCallback(async () => {
    if (statusRef.current !== 'listening' || mutedRef.current) return

    const recognizer = recognizerRef.current
    if (!recognizer) return

    const finalTranscript = await recognizer.stop()
    if (finalTranscript.trim()) {
      processUserPrompt(finalTranscript)
    } else {
      // If nothing recognized, resume listening
      startListeningTurn()
    }
  }, [processUserPrompt])

  /* Start a user listening turn */
  const startListeningTurn = useCallback(async () => {
    if (!mediaStreamRef.current || mutedRef.current) return

    setVoiceModeStatus('listening')
    setVoiceUserTranscript('')

    if (recognizerRef.current) {
      await recognizerRef.current.stop()
    }

    const recognizer = new LiveVoiceRecognizer(
      (interim) => {
        setVoiceUserTranscript(interim)
      },
      (final) => {
        setVoiceUserTranscript(final)
      }
    )
    recognizerRef.current = recognizer
    await recognizer.start(mediaStreamRef.current)
  }, [setVoiceModeStatus, setVoiceUserTranscript])

  /* Initialize Audio MediaStream & VAD when modal opens */
  useEffect(() => {
    if (!isContinuousVoiceActive) return

    let isMounted = true

    async function initVoice() {
      try {
        setErrorMsg(null)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        mediaStreamRef.current = stream

        // Initialize VAD Analyzer
        const vad = new VoiceActivityDetector({
          speechThreshold: 0.022,
          silenceDurationMs: 1400,
          onSpeechStart: () => {
            // Interruption: If Helfen is speaking and user starts talking, interrupt AI!
            if (statusRef.current === 'speaking') {
              stopAiSpeech()
              setVoiceModeStatus('listening')
              startListeningTurn()
            }
          },
          onSpeechEnd: () => {
            handleUserFinishedSpeaking()
          },
          onVolumeChange: (vol) => {
            setVoiceVolumeLevel(vol)
          }
        })

        vadRef.current = vad
        vad.start(stream)

        // Start initial listening turn
        startListeningTurn()
      } catch (err: any) {
        console.error('Microphone access denied:', err)
        setErrorMsg('Microphone access required. Please allow mic permissions in your browser.')
      }
    }

    initVoice()

    return () => {
      isMounted = false
      stopAiSpeech()
      if (vadRef.current) {
        vadRef.current.stop()
        vadRef.current = null
      }
      if (recognizerRef.current) {
        recognizerRef.current.stop()
        recognizerRef.current = null
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }
    }
  }, [isContinuousVoiceActive, handleUserFinishedSpeaking, startListeningTurn, stopAiSpeech, setVoiceVolumeLevel, setVoiceModeStatus])

  if (!isContinuousVoiceActive) return null

  return (
    <div className="voice-modal-backdrop">
      <div className="voice-modal-shell">
        {/* Top Header */}
        <div className="voice-modal-topbar">
          <div className="voice-model-badge">
            <Sparkles size={14} className="text-blue" />
            <span>Helfen Voice • {selectedModel}</span>
          </div>

          <button
            type="button"
            className="voice-close-icon-btn"
            onClick={stopContinuousVoice}
            title="End voice conversation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Central Visualizer Orb */}
        <div className="voice-center-stage">
          <VoiceWaveformOrb
            status={voiceModeStatus}
            volumeLevel={voiceIsMuted ? 0 : voiceVolumeLevel}
            frequencyData={vadRef.current?.frequencyData}
            size={300}
          />

          {/* Status Label Pill */}
          <div className={`voice-status-pill ${voiceModeStatus}`}>
            <span className="voice-status-dot" />
            <span>
              {voiceIsMuted
                ? 'Microphone Muted'
                : voiceModeStatus === 'listening'
                ? 'Listening...'
                : voiceModeStatus === 'thinking'
                ? 'Thinking...'
                : 'Helfen Speaking...'}
            </span>
          </div>

          {/* Error notice if permissions failed */}
          {errorMsg && (
            <div className="voice-error-card">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live Captions Subtitles */}
          {showCaptions && (
            <div className="voice-captions-box">
              {voiceModeStatus === 'speaking' && voiceAiTranscript && (
                <p className="voice-caption-ai">
                  <strong>Helfen:</strong> {voiceAiTranscript}
                </p>
              )}
              {voiceModeStatus !== 'speaking' && voiceUserTranscript && (
                <p className="voice-caption-user">
                  <strong>You:</strong> {voiceUserTranscript}
                </p>
              )}
              {!voiceUserTranscript && !voiceAiTranscript && (
                <p className="voice-caption-placeholder">
                  Speak naturally. Helfen will reply and listen automatically.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="voice-bottom-controls">
          {/* Captions Toggle */}
          <button
            type="button"
            className={`voice-action-circle ${showCaptions ? 'active' : ''}`}
            onClick={() => setShowCaptions(!showCaptions)}
            title={showCaptions ? 'Hide captions' : 'Show captions'}
          >
            <MessageSquare size={20} />
          </button>

          {/* Interrupt / Stop Speaking */}
          {voiceModeStatus === 'speaking' && (
            <button
              type="button"
              className="voice-action-circle interrupt"
              onClick={() => {
                stopAiSpeech()
                setVoiceModeStatus('listening')
                startListeningTurn()
              }}
              title="Interrupt and speak"
            >
              <RefreshCw size={20} />
            </button>
          )}

          {/* Mute Mic Toggle */}
          <button
            type="button"
            className={`voice-action-circle mute ${voiceIsMuted ? 'muted' : ''}`}
            onClick={() => {
              toggleVoiceMute()
              if (!voiceIsMuted) {
                toast('Microphone muted', { icon: '🔇' })
              } else {
                toast('Microphone unmuted', { icon: '🎙️' })
                startListeningTurn()
              }
            }}
            title={voiceIsMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {voiceIsMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* End Call Button */}
          <button
            type="button"
            className="voice-action-circle end-call"
            onClick={stopContinuousVoice}
            title="End voice session"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  )
}
