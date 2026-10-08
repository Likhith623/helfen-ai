'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Image as ImageIcon, Mic, StopCircle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'

export function ChatInput() {
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { 
    isStreaming, 
    setIsStreaming, 
    addMessage, 
    activeConversationId,
    setActiveConversationId,
    messages,
    selectedModel,
    isTemporaryChat,
    setStreamingMessageId,
    updateMessage,
    addConversation
  } = useAppStore()

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!input.trim() || isStreaming) return

    const content = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '24px'

    let convId = activeConversationId

    // Create new conversation if needed
    if (!convId && !isTemporaryChat) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('conversations').insert({
          user_id: user.id,
          title: content.slice(0, 40) + (content.length > 40 ? '...' : ''),
          model: selectedModel,
          is_temporary: false
        }).select().single()
        
        if (data) {
          convId = data.id
          addConversation(data as any)
          setActiveConversationId(data.id)
        }
      } else {
        // Fallback to temp if not logged in
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

    // Save to DB
    if (convId && !isTemporaryChat) {
      supabase.from('messages').insert({
        id: userMsgId,
        conversation_id: convId,
        role: 'user',
        content
      }).then()
    }

    const aiMsgId = crypto.randomUUID()
    const aiMsg = {
      id: aiMsgId,
      conversation_id: convId || 'temp',
      role: 'assistant' as const,
      content: '',
      model: selectedModel,
      created_at: new Date().toISOString()
    }
    
    addMessage(aiMsg)
    setStreamingMessageId(aiMsgId)
    setIsStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          messages: [...messages, userMsg],
          model: selectedModel,
          isTemporary: isTemporaryChat
        })
      })

      if (!res.ok) throw new Error('Failed to fetch response')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            if (data.content) {
              fullContent += data.content
              updateMessage(aiMsgId, { content: fullContent })
            }
          }
        }
      }

      // Save AI message to DB
      if (convId && !isTemporaryChat) {
        supabase.from('messages').insert({
          id: aiMsgId,
          conversation_id: convId,
          role: 'assistant',
          content: fullContent,
          model: selectedModel
        }).then()
      }

    } catch (error) {
      console.error(error)
      updateMessage(aiMsgId, { content: 'Sorry, I encountered an error.' })
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
    <div className="input-area fade-in">
      <div className="input-wrapper">
        <form onSubmit={handleSubmit} className="input-container">
          <button type="button" className="icon-btn" title="Upload image">
            <ImageIcon size={20} />
          </button>
          
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Helfen AI anything..."
            rows={1}
            disabled={isStreaming}
          />
          
          <div className="input-actions">
            {isRecording ? (
              <div className="voice-recording">
                <div className="voice-pulse" />
                Listening...
                <button 
                  type="button" 
                  className="icon-btn" 
                  style={{ width: 24, height: 24, color: 'var(--accent-red)' }}
                  onClick={() => setIsRecording(false)}
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
                <Mic size={20} />
              </button>
            )}
            
            <button 
              type="submit" 
              className={`send-btn ${input.trim() && !isStreaming ? 'active' : ''}`}
              disabled={!input.trim() || isStreaming}
              title="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
        <div className="input-hint">
          Helfen AI can make mistakes. Check important info. Select text to ask inline questions.
        </div>
      </div>
    </div>
  )
}
