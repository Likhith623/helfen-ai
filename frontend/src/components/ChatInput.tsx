'use client'
 
import { useState, useRef, useEffect } from 'react'
import { Send, Mic, StopCircle, ChevronDown, Plus, Link2, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import { ChatContextModal } from '@/components/ChatContextModal'

export function ChatInput() {
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    isStreaming, setIsStreaming,
    addMessage, activeConversationId, setActiveConversationId,
    messages, selectedModel, isTemporaryChat,
    setStreamingMessageId, updateMessage, addConversation,
    continuationParentId, continuationParentTitle, continuationMessagesCount,
    clearContinuationParent, setIsContextModalOpen
  } = useAppStore()

  /* Auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '24px'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  /* Let suggestion chips set textarea value via DOM event */
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const handler = (e: Event) => setInput((e.target as HTMLTextAreaElement).value)
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!input.trim() || isStreaming) return

    const content = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '24px'

    let convId = activeConversationId

    /* Create conversation in DB if needed */
    if (!convId && !isTemporaryChat) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('conversations').insert({
          user_id: user.id,
          title: content.slice(0, 40) + (content.length > 40 ? '…' : ''),
          model: selectedModel,
          is_temporary: false
        }).select().single()
        if (data) {
          convId = data.id
          addConversation(data as any)
          setActiveConversationId(data.id)
        }
      } else {
        useAppStore.getState().setIsTemporaryChat(true)
      }
    }

    const userMsgId = crypto.randomUUID()
    const userMsg = {
      id: userMsgId,
      conversation_id: convId || 'temp',
      role: 'user' as const,
      content,
      created_at: new Date().toISOString()
    }
    addMessage(userMsg)

    if (convId && !isTemporaryChat) {
      supabase.from('messages').insert({
        id: userMsgId, conversation_id: convId, role: 'user', content
      }).then()
    }

    const aiMsgId = crypto.randomUUID()
    addMessage({
      id: aiMsgId,
      conversation_id: convId || 'temp',
      role: 'assistant' as const,
      content: '',
      model: selectedModel,
      created_at: new Date().toISOString()
    })
    setStreamingMessageId(aiMsgId)
    setIsStreaming(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const res = await fetch('http://localhost:8080/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          conversationId: convId,
          messages: [...messages, userMsg],
          model: selectedModel,
          isTemporary: isTemporaryChat
        })
      })

      if (!res.ok) throw new Error('API error')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let fullContent = ''

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
                fullContent += parsed.content
                updateMessage(aiMsgId, { content: fullContent })
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      if (convId && !isTemporaryChat) {
        supabase.from('messages').insert({
          id: aiMsgId, conversation_id: convId,
          role: 'assistant', content: fullContent, model: selectedModel
        }).then()
      }
    } catch (err) {
      console.error(err)
      updateMessage(aiMsgId, { content: 'Sorry, something went wrong. Please try again.' })
    } finally {
      setIsStreaming(false)
      setStreamingMessageId(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="input-area">
      <div className="input-area-inner">
        {/* Attached continuation context banner */}
        {continuationParentId && (
          <div className="attached-context-banner">
            <div
              className="attached-context-left"
              onClick={() => setIsContextModalOpen(true)}
              title="Click to view or change linked context chat"
            >
              <div className="attached-context-pulse" />
              <div className="attached-context-text">
                <span className="attached-context-tag">Continuing:</span>
                <span className="attached-context-title">
                  {continuationParentTitle || 'Previous Chat'}
                </span>
                {continuationMessagesCount > 0 && (
                  <span className="attached-context-count">
                    ({continuationMessagesCount} msgs)
                  </span>
                )}
              </div>
            </div>
            <div className="attached-context-right">
              <button
                type="button"
                className="attached-context-change-btn"
                onClick={() => setIsContextModalOpen(true)}
              >
                Change
              </button>
              <button
                type="button"
                className="attached-context-close-btn"
                onClick={clearContinuationParent}
                title="Remove linked context"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Glowing coloured border on focus */}
        <div className="input-glow-wrapper">
          <form onSubmit={handleSubmit}>
            <div className="input-box">
              {/* Plus / attach button */}
              <button type="button" className="icon-btn" title="Attach" style={{ flexShrink: 0, marginBottom: 0 }}>
                <Plus size={18} />
              </button>

              <textarea
                ref={textareaRef}
                className="chat-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Helfen AI"
                rows={1}
                disabled={isStreaming}
              />

              <div className="input-actions">
                {/* Context link button inside the search / prompt box */}
                <button
                  type="button"
                  className={`context-link-btn ${continuationParentId ? 'has-context' : ''}`}
                  onClick={() => setIsContextModalOpen(true)}
                  title={
                    continuationParentId
                      ? `Continuing from: "${continuationParentTitle}". Click to change.`
                      : 'Choose an earlier chat to use as context for this conversation'
                  }
                >
                  <Link2 size={13} />
                  <span>
                    {continuationParentId
                      ? continuationParentTitle
                        ? continuationParentTitle.slice(0, 14) + (continuationParentTitle.length > 14 ? '…' : '')
                        : 'Context Linked'
                      : 'Context'}
                  </span>
                </button>

                {/* Model pill — like Gemini's "Flash ▾" */}
                <button type="button" className="model-pill" title="Change model">
                  Flash <ChevronDown size={13} />
                </button>

                {/* Mic */}
                {isRecording ? (
                  <div className="voice-recording">
                    <div className="voice-pulse" />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setIsRecording(false)}
                      style={{ width: 32, height: 32 }}
                    >
                      <StopCircle size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="icon-btn"
                    title="Use microphone"
                    onClick={() => setIsRecording(true)}
                    disabled={isStreaming}
                  >
                    <Mic size={18} />
                  </button>
                )}

                {/* Send */}
                <button
                  type="submit"
                  className={`send-btn ${input.trim() && !isStreaming ? 'active' : ''}`}
                  disabled={!input.trim() || isStreaming}
                  title="Send"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="input-hint">
          Helfen AI can make mistakes. Select text in any response to ask inline questions.
        </div>
      </div>

      {/* Continuation Chat Selection Modal */}
      <ChatContextModal />
    </div>
  )
}
