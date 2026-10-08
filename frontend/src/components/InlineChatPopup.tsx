'use client'

import { useState, useRef, useEffect, useEffect as useIsomorphicLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Play, Sparkles } from 'lucide-react'
import type { InlineAnnotation, InlineMessage } from '@/store/appStore'
import { useAppStore } from '@/store/appStore'
import ReactMarkdown from 'react-markdown'
import { supabase } from '@/lib/supabase'

interface Props {
  annotation: InlineAnnotation
  anchorY: number
  onClose: () => void
}

export function InlineChatPopup({ annotation, anchorY, onClose }: Props) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<InlineMessage[]>(annotation.messages || [])
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { updateAnnotation, selectedModel } = useAppStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    inputRef.current?.focus()
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    const userMsg: InlineMessage = {
      id: crypto.randomUUID(),
      annotation_id: annotation.id,
      role: 'user',
      content: input,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    // Save to Supabase in background
    supabase.from('inline_messages').insert({
      id: userMsg.id,
      annotation_id: userMsg.annotation_id,
      role: 'user',
      content: userMsg.content
    }).then()

    const aiMsgId = crypto.randomUUID()
    const aiMsg: InlineMessage = {
      id: aiMsgId,
      annotation_id: annotation.id,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, aiMsg])

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const res = await fetch('http://localhost:8080/api/v1/inline-chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          selectedText: annotation.selected_text,
          question: userMsg.content,
          conversationId: annotation.conversation_id,
          model: selectedModel
        })
      })

      if (!res.ok) throw new Error('Failed to fetch')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonStr = line.slice(5).trim()
            if (!jsonStr) continue
            try {
              const data = JSON.parse(jsonStr)
              if (data.content) {
                fullContent += data.content
                setMessages(prev => prev.map(m => 
                  m.id === aiMsgId ? { ...m, content: fullContent } : m
                ))
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      // Save AI message to Supabase
      supabase.from('inline_messages').insert({
        id: aiMsgId,
        annotation_id: annotation.id,
        role: 'assistant',
        content: fullContent
      }).then()

      // Update local store
      updateAnnotation(annotation.id, {
        messages: [...messages, userMsg, { ...aiMsg, content: fullContent }]
      })

    } catch (error) {
      console.error(error)
      setMessages(prev => prev.map(m => 
        m.id === aiMsgId ? { ...m, content: 'Sorry, I encountered an error answering that.' } : m
      ))
    } finally {
      setIsStreaming(false)
    }
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return createPortal(
    <>

      <div 
        className="inline-chat-overlay"
        onClick={onClose}
      />
      <div 
        className="inline-chat-popup glass-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="inline-chat-header">
          <Sparkles size={16} className="gemini-gradient-text" style={{ flexShrink: 0 }} />
          <div className="inline-selected-preview">
            Discussing: <strong>"{annotation.selected_text}"</strong>
          </div>
          <button 
            className="icon-btn" 
            style={{ width: 28, height: 28, flexShrink: 0 }} 
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div className="inline-chat-messages">
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
              Ask me anything about this selection
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`inline-message ${msg.role}`}>
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <div style={{ fontSize: 13 }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
          {isStreaming && (
            <div className="inline-message assistant">
              <div className="streaming-dots">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="inline-chat-input">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isStreaming}
          />
          <button 
            type="submit" 
            className={`send-btn ${input.trim() && !isStreaming ? 'active' : ''}`}
            disabled={!input.trim() || isStreaming}
            style={{ width: 32, height: 32 }}
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </>,
    document.body
  )
}
