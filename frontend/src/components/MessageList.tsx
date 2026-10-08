'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { InlineSelectionPopup } from './InlineSelectionPopup'
import { InlineChatPopup } from './InlineChatPopup'
import type { InlineAnnotation } from '@/store/appStore'
import {
  Copy, ThumbsUp, ThumbsDown, RotateCcw, Volume2, Check,
  VolumeX, MessageSquarePlus
} from 'lucide-react'
import toast from 'react-hot-toast'

interface SelectionState {
  text: string
  range: Range
  x: number
  y: number
  messageId: string
  startOffset: number
  endOffset: number
}

interface InlineChatState {
  annotation: InlineAnnotation
  messageId: string
  anchorY: number
}

export function MessageList() {
  const { messages, isStreaming, streamingMessageId, annotations, voiceEnabled } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [inlineChat, setInlineChat] = useState<InlineChatState | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null)
        return
      }

      const selectedText = sel.toString().trim()
      if (selectedText.length < 3) return

      // Find which message was selected
      const range = sel.getRangeAt(0)
      let node: Node | null = range.commonAncestorContainer
      while (node && !(node as Element).hasAttribute?.('data-message-id')) {
        node = node.parentNode
      }
      const messageId = (node as Element)?.getAttribute?.('data-message-id')
      if (!messageId) return

      const rect = range.getBoundingClientRect()
      const scrollY = window.scrollY || document.documentElement.scrollTop

      // Calculate offsets within the message
      const startOffset = getTextOffset(range.startContainer, range.startOffset, node as Element)
      const endOffset = startOffset + selectedText.length

      setSelection({
        text: selectedText,
        range,
        x: rect.left + rect.width / 2,
        y: rect.top + scrollY,
        messageId,
        startOffset,
        endOffset,
      })
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  function getTextOffset(container: Node, offset: number, root: Element): number {
    let total = 0
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      if (walker.currentNode === container) {
        return total + offset
      }
      total += walker.currentNode.textContent?.length || 0
    }
    return total
  }

  function handleAskAboutSelection() {
    if (!selection) return
    const ann: InlineAnnotation = {
      id: crypto.randomUUID(),
      message_id: selection.messageId,
      conversation_id: useAppStore.getState().activeConversationId || '',
      selected_text: selection.text,
      start_offset: selection.startOffset,
      end_offset: selection.endOffset,
      annotation_type: 'question',
      is_resolved: false,
      created_at: new Date().toISOString(),
      messages: [],
    }

    useAppStore.getState().addAnnotation(selection.messageId, ann)

    // Find element Y position for the annotation
    const msgEl = document.querySelector(`[data-message-id="${selection.messageId}"]`)
    const msgRect = msgEl?.getBoundingClientRect()
    const anchorY = msgRect ? msgRect.bottom + window.scrollY + 16 : selection.y + 40

    setInlineChat({ annotation: ann, messageId: selection.messageId, anchorY })
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  async function playTTS(messageId: string, content: string) {
    if (!voiceEnabled) return
    if (playingId === messageId) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    setPlayingId(messageId)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const res = await fetch('http://localhost:8080/api/v1/tts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ text: content.slice(0, 800) }),
      })

      if (!res.ok) throw new Error('TTS failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }

      audioRef.current = new Audio(url)
      audioRef.current.play()
      audioRef.current.onended = () => setPlayingId(null)
    } catch {
      setPlayingId(null)
      toast.error('Voice not available')
    }
  }

  async function copyMessage(id: string, content: string) {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Copied!')
  }

  function openExistingAnnotation(ann: InlineAnnotation) {
    const msgEl = document.querySelector(`[data-message-id="${ann.message_id}"]`)
    const msgRect = msgEl?.getBoundingClientRect()
    const anchorY = msgRect ? msgRect.bottom + window.scrollY + 16 : 200
    setInlineChat({ annotation: ann, messageId: ann.message_id, anchorY })
  }

  return (
    <div className="messages-container" ref={containerRef}>
      <div className="messages-inner">
        {messages.map((msg) => {
          const msgAnnotations = annotations[msg.id] || []

          return (
            <div key={msg.id} className={`message-wrapper ${msg.role} fade-in`}>
              {msg.role === 'assistant' && (
                <div className="message-header">
                  <div className="message-avatar ai">
                    <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                      <path d="M14 3L25 9V19L14 25L3 19V9L14 3Z" fill="url(#grad)" />
                      <defs>
                        <linearGradient id="grad" x1="3" y1="3" x2="25" y2="25">
                          <stop stopColor="#4285f4" />
                          <stop offset="0.5" stopColor="#9c27b0" />
                          <stop offset="1" stopColor="#fbbc05" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <span className="message-role-label">Helfen AI</span>
                </div>
              )}

              {msg.role === 'user' ? (
                <div className="user-bubble">{msg.content}</div>
              ) : (
                <div
                  className="assistant-content"
                  data-message-id={msg.id}
                >
                  {msg.id === streamingMessageId && isStreaming && !msg.content ? (
                    <div className="streaming-dots">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <AnnotatedContent
                      content={msg.content}
                      messageId={msg.id}
                      annotations={msgAnnotations}
                      onAnnotationClick={openExistingAnnotation}
                    />
                  )}

                  {/* Message actions */}
                  {(!isStreaming || msg.id !== streamingMessageId) && msg.content && (
                    <div className="message-actions">
                      <button
                        className="action-btn"
                        onClick={() => copyMessage(msg.id, msg.content)}
                        title="Copy"
                      >
                        {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => playTTS(msg.id, msg.content)}
                        title={playingId === msg.id ? 'Stop' : 'Listen'}
                      >
                        {playingId === msg.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                      <button className="action-btn" title="Good response">
                        <ThumbsUp size={14} />
                      </button>
                      <button className="action-btn" title="Bad response">
                        <ThumbsDown size={14} />
                      </button>
                      <button className="action-btn" title="Retry">
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}


        <div ref={bottomRef} />
      </div>

      {/* Text selection popup */}
      {selection && (
        <InlineSelectionPopup
          x={selection.x}
          y={selection.y}
          text={selection.text}
          onAsk={handleAskAboutSelection}
          onClose={() => setSelection(null)}
        />
      )}

      {/* Inline chat glass popup */}
      {inlineChat && (
        <InlineChatPopup
          annotation={inlineChat.annotation}
          anchorY={inlineChat.anchorY}
          onClose={() => setInlineChat(null)}
        />
      )}
    </div>
  )
}

// Renders message content with annotation highlights
function AnnotatedContent({
  content, messageId, annotations, onAnnotationClick
}: {
  content: string
  messageId: string
  annotations: InlineAnnotation[]
  onAnnotationClick: (ann: InlineAnnotation) => void
}) {
  if (annotations.length === 0) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    )
  }

  // Build segments with highlights
  const segments: { text: string; annotation?: InlineAnnotation }[] = []
  let lastIdx = 0

  const sorted = [...annotations].sort((a, b) => a.start_offset - b.start_offset)

  for (const ann of sorted) {
    if (ann.start_offset > lastIdx) {
      segments.push({ text: content.slice(lastIdx, ann.start_offset) })
    }
    segments.push({ text: content.slice(ann.start_offset, ann.end_offset), annotation: ann })
    lastIdx = ann.end_offset
  }
  if (lastIdx < content.length) {
    segments.push({ text: content.slice(lastIdx) })
  }

  return (
    <div>
      {segments.map((seg, i) =>
        seg.annotation ? (
          <span
            key={i}
            className="annotated-text"
            onClick={() => onAnnotationClick(seg.annotation!)}
            title="Click to view sub-chat"
          >
            {seg.text}
            <span className="annotation-indicator">
              {(seg.annotation.messages?.length || 0) > 0
                ? seg.annotation.messages!.length
                : '?'}
            </span>
          </span>
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {seg.text}
          </ReactMarkdown>
        )
      )}
    </div>
  )
}
