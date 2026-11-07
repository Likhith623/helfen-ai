'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { InlineSelectionPopup, type HighlightColor } from './InlineSelectionPopup'
import { InlineChatPopup } from './InlineChatPopup'
import { NoteViewPopover } from './NoteViewPopover'
import type { InlineAnnotation } from '@/store/appStore'
import {
  Copy, ThumbsUp, ThumbsDown, RotateCcw, Volume2, Check,
  VolumeX, MessageSquarePlus, FileText, Code2, Download, X,
  BookOpen, Link2, ChevronDown, Sparkles, StickyNote
} from 'lucide-react'
import { generateResponsePdf } from '@/lib/pdfGenerator'
import { formatFileSize } from '@/lib/fileProcessor'
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
  const {
    messages, isStreaming, streamingMessageId, annotations,
    voiceEnabled, conversations, openRagInspector
  } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [inlineChat, setInlineChat] = useState<InlineChatState | null>(null)
  const [activeNote, setActiveNote] = useState<{
    annotation: InlineAnnotation
    anchorRect: { x: number; y: number; width?: number; height?: number }
  } | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null)
  const [expandedContextIds, setExpandedContextIds] = useState<Record<string, boolean>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const toggleContextExpand = (msgId: string) => {
    setExpandedContextIds((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Do not clear or reset selection when clicking inside any popup/card/modal
      if ((e.target as Element)?.closest?.('.selection-popup, .note-popover-card, .inline-chat-popup, .selection-note-card, .image-lightbox-backdrop')) {
        return
      }

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null)
        return
      }

      const selectedText = sel.toString().trim()
      if (selectedText.length < 2) return

      // Find which message was selected
      const range = sel.getRangeAt(0)
      let node: Node | null = range.commonAncestorContainer
      while (node && !(node as Element).hasAttribute?.('data-message-id')) {
        node = node.parentNode
      }
      const messageId = (node as Element)?.getAttribute?.('data-message-id')
      if (!messageId) return

      const rect = range.getBoundingClientRect()

      // Calculate offsets within the message
      const startOffset = getTextOffset(range.startContainer, range.startOffset, node as Element)
      const endOffset = startOffset + selectedText.length

      setSelection({
        text: selectedText,
        range,
        x: rect.left + rect.width / 2,
        y: rect.top, // Viewport-relative coordinates for fixed positioning
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

    const activeConvId = useAppStore.getState().activeConversationId || ''

    if (activeConvId && activeConvId.length === 36) {
      try {
        supabase.from('inline_annotations').insert({
          id: ann.id,
          message_id: ann.message_id,
          conversation_id: activeConvId,
          selected_text: ann.selected_text,
          start_offset: ann.start_offset,
          end_offset: ann.end_offset,
          annotation_type: 'question',
          is_resolved: false,
        }).then()
      } catch (err) {
        console.error('Failed to save annotation to Supabase:', err)
      }
    }

    // Find element Y position for the annotation
    const msgEl = document.querySelector(`[data-message-id="${selection.messageId}"]`)
    const msgRect = msgEl?.getBoundingClientRect()
    const anchorY = msgRect ? msgRect.bottom + window.scrollY + 16 : selection.y + 40

    setInlineChat({ annotation: ann, messageId: selection.messageId, anchorY })
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  async function handleTakeNote(noteText: string, color: HighlightColor) {
    if (!selection) return
    const messageId = selection.messageId
    const activeConvId = useAppStore.getState().activeConversationId || ''

    const newAnnotation: InlineAnnotation = {
      id: crypto.randomUUID(),
      message_id: messageId,
      conversation_id: activeConvId,
      selected_text: selection.text,
      start_offset: selection.startOffset,
      end_offset: selection.endOffset,
      annotation_type: 'note',
      note: noteText,
      color: color,
      is_resolved: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    useAppStore.getState().addAnnotation(messageId, newAnnotation)

    if (activeConvId && activeConvId.length === 36) {
      try {
        supabase.from('inline_annotations').insert({
          id: newAnnotation.id,
          message_id: newAnnotation.message_id,
          conversation_id: activeConvId,
          selected_text: newAnnotation.selected_text,
          start_offset: newAnnotation.start_offset,
          end_offset: newAnnotation.end_offset,
          annotation_type: 'note',
          note: newAnnotation.note,
          color: newAnnotation.color,
          is_resolved: false,
        }).then()
      } catch (err) {
        console.error('Failed to save note to Supabase:', err)
      }
    }

    setSelection(null)
    window.getSelection()?.removeAllRanges()
    toast.success('Note attached to highlight!', {
      icon: '📝',
      style: {
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)'
      }
    })
  }

  function openExistingNote(ann: InlineAnnotation, targetEl: HTMLElement) {
    const rect = targetEl.getBoundingClientRect()
    setActiveNote({
      annotation: ann,
      anchorRect: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    })
  }

  async function handleUpdateNote(annotationId: string, noteText: string, color: HighlightColor) {
    useAppStore.getState().updateAnnotation(annotationId, {
      note: noteText,
      color: color,
      updated_at: new Date().toISOString(),
    })

    try {
      await supabase
        .from('inline_annotations')
        .update({
          note: noteText,
          color: color,
          updated_at: new Date().toISOString(),
        })
        .eq('id', annotationId)
    } catch (err) {
      console.error('Failed to update note in Supabase:', err)
    }

    toast.success('Note updated!')
  }

  async function handleDeleteNote(messageId: string, annotationId: string) {
    useAppStore.getState().deleteAnnotation(messageId, annotationId)

    try {
      await supabase
        .from('inline_annotations')
        .delete()
        .eq('id', annotationId)
    } catch (err) {
      console.error('Failed to delete note from Supabase:', err)
    }

    toast.success('Note deleted and unhighlighted')
  }

  function handleAskAiFromNote(selectedText: string) {
    if (!activeNote) return
    const messageId = activeNote.annotation.message_id
    const ann: InlineAnnotation = {
      id: crypto.randomUUID(),
      message_id: messageId,
      conversation_id: useAppStore.getState().activeConversationId || '',
      selected_text: selectedText,
      start_offset: 0,
      end_offset: selectedText.length,
      annotation_type: 'question',
      is_resolved: false,
      created_at: new Date().toISOString(),
      messages: [],
    }

    useAppStore.getState().addAnnotation(messageId, ann)

    const msgEl = document.querySelector(`[data-message-id="${messageId}"]`)
    const msgRect = msgEl?.getBoundingClientRect()
    const anchorY = msgRect ? msgRect.bottom + window.scrollY + 16 : 200

    setInlineChat({ annotation: ann, messageId, anchorY })
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

  async function handleGeneratePdf(msg: any, promptMsg?: any) {
    setGeneratingPdfId(msg.id)
    try {
      const activeConv = conversations.find((c) => c.id === msg.conversation_id)
      const promptText = promptMsg?.content?.trim()
      const derivedTitle =
        activeConv?.title && activeConv.title !== 'New Chat'
          ? activeConv.title
          : promptText
            ? promptText.slice(0, 50) + (promptText.length > 50 ? '...' : '')
            : 'Helfen AI Response'

      await generateResponsePdf(msg.content, {
        title: derivedTitle,
        prompt: promptText,
        model: msg.model || 'llama3.2:3b',
        createdAt: msg.created_at
      })
      toast.success('PDF generated and downloaded!', {
        icon: '📄'
      })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdfId(null)
    }
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
        {messages.map((msg, idx) => {
          const msgAnnotations = annotations[msg.id] || []

          return (
            <div key={msg.id} className={`message-wrapper ${msg.role} fade-in`}>
              {msg.role === 'user' ? (
                <div className="user-bubble" data-message-id={msg.id}>
                  {/* Attached files and images */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="message-attachments-container">
                      {msg.attachments.map((att) => {
                        if (att.type === 'image' && (att.dataUrl || att.base64)) {
                          const src = att.dataUrl || `data:${att.mimeType || 'image/jpeg'};base64,${att.base64}`
                          return (
                            <div
                              key={att.id}
                              className="message-image-card"
                              onClick={() => setSelectedImage({ url: src, name: att.name })}
                              title="Click to view full image"
                            >
                              <img src={src} alt={att.name} className="message-attached-image" />
                              <div className="message-image-overlay">
                                <span className="message-image-name">{att.name}</span>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div key={att.id} className={`message-doc-card ${att.type}`}>
                            <div className="message-doc-icon">
                              {att.type === 'code' ? <Code2 size={16} /> : <FileText size={16} />}
                            </div>
                            <div className="message-doc-info">
                              <span className="message-doc-name" title={att.name}>{att.name}</span>
                              <span className="message-doc-size">{formatFileSize(att.size)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Fallback for raw base64 images without attachments array */}
                  {(!msg.attachments || msg.attachments.length === 0) && msg.images && msg.images.length > 0 && (
                    <div className="message-attachments-container">
                      {msg.images.map((imgBase64, imgIdx) => {
                        const src = `data:image/jpeg;base64,${imgBase64}`
                        return (
                          <div
                            key={imgIdx}
                            className="message-image-card"
                            onClick={() => setSelectedImage({ url: src, name: `Image ${imgIdx + 1}` })}
                            title="Click to view full image"
                          >
                            <img src={src} alt={`Image ${imgIdx + 1}`} className="message-attached-image" />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {msg.content && (
                    <div className="user-text-content">
                      {msgAnnotations.length > 0 ? (
                        <AnnotatedContent
                          content={msg.content}
                          messageId={msg.id}
                          annotations={msgAnnotations}
                          onAnnotationClick={openExistingAnnotation}
                          onNoteClick={openExistingNote}
                        />
                      ) : (
                        msg.content
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="assistant-content"
                  data-message-id={msg.id}
                >
                  {/* Linked Chat Context & Deep Summary Card */}
                  {msg.role === 'assistant' && msg.referencedContext && (
                    <div className="referenced-context-card-wrapper">
                      <div
                        className={`referenced-context-pill ${expandedContextIds[msg.id] ? 'is-expanded' : ''}`}
                        onClick={() => toggleContextExpand(msg.id)}
                        title="Click to view full summary, key decisions, and facts from this linked conversation"
                      >
                        <div className="referenced-context-pill-left">
                          <Link2 size={13} className="text-blue" />
                          <span className="context-pill-label">Context Linked:</span>
                          <strong className="context-pill-title">"{msg.referencedContext.title}"</strong>
                          {msg.referencedContext.messageCount ? (
                            <span className="context-pill-count">
                              ({msg.referencedContext.messageCount} msgs)
                            </span>
                          ) : null}
                        </div>
                        <div className="referenced-context-pill-right">
                          <span className="context-pill-action">
                            {expandedContextIds[msg.id] ? 'Hide Summary' : 'View Deep Summary'}
                          </span>
                          <ChevronDown
                            size={14}
                            style={{
                              transform: expandedContextIds[msg.id] ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.2s ease'
                            }}
                          />
                        </div>
                      </div>

                      {expandedContextIds[msg.id] && (
                        <div className="referenced-context-expanded-drawer fade-in">
                          {/* Executive Summary */}
                          {msg.referencedContext.executiveSummary && (
                            <div className="context-drawer-section">
                              <div className="context-drawer-header">
                                <Sparkles size={13} className="text-yellow" />
                                <span>Executive Summary</span>
                              </div>
                              <p className="context-drawer-text">{msg.referencedContext.executiveSummary}</p>
                            </div>
                          )}

                          {/* Key Decisions */}
                          {msg.referencedContext.keyDecisions && msg.referencedContext.keyDecisions.length > 0 && (
                            <div className="context-drawer-section">
                              <div className="context-drawer-header">
                                <Check size={13} className="text-green" />
                                <span>Key Decisions & Takeaways</span>
                              </div>
                              <ul className="context-drawer-list">
                                {msg.referencedContext.keyDecisions.map((dec, i) => (
                                  <li key={i}>{dec}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Salient Topics */}
                          {msg.referencedContext.salientTopics && msg.referencedContext.salientTopics.length > 0 && (
                            <div className="context-drawer-section">
                              <div className="context-drawer-header">
                                <BookOpen size={13} className="text-blue" />
                                <span>Core Topics & Context Keys</span>
                              </div>
                              <div className="context-drawer-tags">
                                {msg.referencedContext.salientTopics.map((top, i) => (
                                  <span key={i} className="context-topic-tag">{top}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.id === streamingMessageId && isStreaming && !msg.content ? (
                    <div className="claude-gemini-loader fade-in">
                      <div className="streaming-dots">
                        <span /><span /><span />
                      </div>
                    </div>
                  ) : (
                    <>
                      <AnnotatedContent
                        content={msg.content}
                        messageId={msg.id}
                        annotations={msgAnnotations}
                        onAnnotationClick={openExistingAnnotation}
                        onNoteClick={openExistingNote}
                      />
                      {msg.id === streamingMessageId && isStreaming && (
                        <span className="streaming-cursor" />
                      )}
                    </>
                  )}

                  {/* RAG Grounded Sources Citation Pill */}
                  {msg.role === 'assistant' && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                    <div className="rag-citation-badge-wrap">
                      <button
                        type="button"
                        className="rag-citation-badge"
                        onClick={() => openRagInspector(msg.id, msg.retrievedChunks!)}
                        title="View verified source excerpts that grounded this response"
                      >
                        <BookOpen size={13} className="text-blue" />
                        <span className="rag-badge-title">
                          Grounded in {msg.retrievedChunks.length} Source{msg.retrievedChunks.length > 1 ? 's' : ''}
                        </span>
                        <span className="rag-badge-score">
                          {Math.round(Math.max(...msg.retrievedChunks.map((c) => c.score || 0)) * 100)}% match
                        </span>
                      </button>
                    </div>
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

                      {/* Generate a PDF button */}
                      <button
                        className={`action-btn generate-pdf-btn ${generatingPdfId === msg.id ? 'loading' : ''}`}
                        onClick={() => {
                          const promptMsg = idx > 0 ? messages.slice(0, idx).reverse().find(m => m.role === 'user') : undefined
                          handleGeneratePdf(msg, promptMsg)
                        }}
                        title="Generate a PDF of this response"
                        disabled={generatingPdfId === msg.id}
                      >
                        {generatingPdfId === msg.id ? (
                          <div className="pdf-btn-spinner" />
                        ) : (
                          <>
                            <FileText size={13} />
                            <span>Generate a PDF</span>
                          </>
                        )}
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
          onTakeNote={handleTakeNote}
          onClose={() => setSelection(null)}
        />
      )}

      {/* Note view and edit popover */}
      {activeNote && (
        <NoteViewPopover
          annotation={activeNote.annotation}
          anchorRect={activeNote.anchorRect}
          onUpdate={handleUpdateNote}
          onDelete={handleDeleteNote}
          onAskAi={handleAskAiFromNote}
          onClose={() => setActiveNote(null)}
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

      {/* Lightbox Image Preview Modal */}
      {selectedImage && (
        <div className="image-lightbox-backdrop" onClick={() => setSelectedImage(null)}>
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="image-lightbox-header">
              <span className="image-lightbox-title">{selectedImage.name}</span>
              <div className="image-lightbox-actions">
                <a
                  href={selectedImage.url}
                  download={selectedImage.name}
                  className="image-lightbox-btn"
                  title="Download image"
                >
                  <Download size={16} />
                </a>
                <button
                  type="button"
                  className="image-lightbox-btn"
                  onClick={() => setSelectedImage(null)}
                  title="Close preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="image-lightbox-body">
              <img src={selectedImage.url} alt={selectedImage.name} className="image-lightbox-img" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Safely injects note and question anchor links into Markdown without breaking syntax
function injectAnnotationsIntoMarkdown(content: string, annotations: InlineAnnotation[]): string {
  if (!annotations || annotations.length === 0) return content
  const valid = annotations.filter((a) => a && a.selected_text && a.selected_text.trim().length > 0)
  if (valid.length === 0) return content

  type Match = { ann: InlineAnnotation; index: number; length: number }
  const matches: Match[] = []

  for (const ann of valid) {
    const target = ann.selected_text
    let foundIndex = -1

    // 1. Direct slice test
    if (content.slice(ann.start_offset, ann.start_offset + target.length) === target) {
      foundIndex = ann.start_offset
    } else {
      // 2. All occurrences of target
      const indices: number[] = []
      let pos = 0
      while (pos < content.length) {
        const idx = content.indexOf(target, pos)
        if (idx === -1) break
        indices.push(idx)
        pos = idx + 1
      }

      if (indices.length > 0) {
        // Choose closest to ann.start_offset
        let closest = indices[0]
        let minDiff = Math.abs(closest - ann.start_offset)
        for (let i = 1; i < indices.length; i++) {
          const diff = Math.abs(indices[i] - ann.start_offset)
          if (diff < minDiff) {
            minDiff = diff
            closest = indices[i]
          }
        }
        foundIndex = closest
      } else {
        // 3. Case-insensitive fallback
        const lowerContent = content.toLowerCase()
        const lowerTarget = target.toLowerCase()
        const lowerIdx = lowerContent.indexOf(lowerTarget)
        if (lowerIdx !== -1) {
          foundIndex = lowerIdx
        }
      }
    }

    if (foundIndex !== -1) {
      matches.push({
        ann,
        index: foundIndex,
        length: target.length,
      })
    }
  }

  // Sort descending by index so replacing doesn't shift earlier indices
  matches.sort((a, b) => b.index - a.index)

  let result = content
  let lastOccupiedStart = Infinity

  for (const m of matches) {
    const matchEnd = m.index + m.length
    if (matchEnd > lastOccupiedStart) continue // skip overlaps

    const prefix = m.ann.annotation_type === 'note' ? 'note' : 'annotation'
    const before = result.slice(0, m.index)
    const text = result.slice(m.index, matchEnd)
    const after = result.slice(matchEnd)

    result = `${before}[${text}](#${prefix}:${m.ann.id})${after}`
    lastOccupiedStart = m.index
  }

  return result
}

// Renders message content with annotation highlights and note markers
function AnnotatedContent({
  content,
  messageId,
  annotations,
  onAnnotationClick,
  onNoteClick,
}: {
  content: string
  messageId: string
  annotations: InlineAnnotation[]
  onAnnotationClick: (ann: InlineAnnotation) => void
  onNoteClick: (ann: InlineAnnotation, targetEl: HTMLElement) => void
}) {
  if (annotations.length === 0) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    )
  }

  const mdString = injectAnnotationsIntoMarkdown(content, annotations)

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, href, children, ...props }) => {
          if (href?.startsWith('#note:')) {
            const annId = href.split(':')[1]
            const ann = annotations.find((a) => a.id === annId)
            if (ann) {
              const color = ann.color || 'yellow'
              return (
                <mark
                  className={`annotated-note note-color-${color}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onNoteClick(ann, e.currentTarget)
                  }}
                  title={ann.note ? `Note: "${ann.note}"` : `Note highlight on "${ann.selected_text}"`}
                >
                  {children}
                  <span className="note-indicator-icon" title="View note">
                    <StickyNote size={12} className="inline-note-pin" />
                  </span>
                </mark>
              )
            }
          }

          if (href?.startsWith('#annotation:')) {
            const annId = href.split(':')[1]
            const ann = annotations.find((a) => a.id === annId)
            if (ann) {
              return (
                <span
                  className="annotated-text"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onAnnotationClick(ann)
                  }}
                  title="Click to view sub-chat"
                >
                  {children}
                  <span className="annotation-indicator">
                    {(ann.messages?.length || 0) > 0 ? ann.messages!.length : '?'}
                  </span>
                </span>
              )
            }
          }

          return (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          )
        },
      }}
    >
      {mdString}
    </ReactMarkdown>
  )
}
