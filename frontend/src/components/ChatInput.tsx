'use client'
 
import { useState, useRef, useEffect } from 'react'
import {
  Send, Mic, StopCircle, ChevronDown, Plus, Link2, X,
  FileText, Code2, Loader2
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { supabase, getConversationContextData } from '@/lib/supabase'
import { ChatContextModal } from '@/components/ChatContextModal'
import { processUploadedFile, formatAttachmentsContext, formatFileSize } from '@/lib/fileProcessor'
import toast from 'react-hot-toast'

export function ChatInput() {
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isStreaming, setIsStreaming,
    addMessage, activeConversationId, setActiveConversationId,
    messages, selectedModel, isTemporaryChat, setSelectedModel,
    setStreamingMessageId, updateMessage, addConversation,
    continuationParentId, continuationParentTitle, continuationMessagesCount,
    continuationContextText, clearContinuationParent, setIsContextModalOpen,
    pendingAttachments, addPendingAttachment, removePendingAttachment, clearPendingAttachments
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

  /* File upload and processing handlers */
  async function handleFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return
    setIsProcessingFiles(true)
    const fileList = Array.from(files)

    for (const file of fileList) {
      try {
        const attachment = await processUploadedFile(file)
        addPendingAttachment(attachment)
        toast.success(`Attached "${file.name}"`, {
          icon: attachment.type === 'image' ? '🖼️' : attachment.type === 'code' ? '💻' : '📄',
          duration: 2500,
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)'
          }
        })
      } catch (err) {
        console.error('File processing error:', err)
        toast.error(`Failed to process ${file.name}`)
      }
    }
    setIsProcessingFiles(false)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      handleFiles(e.target.files)
      e.target.value = ''
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const content = input.trim()
    if ((!content && pendingAttachments.length === 0) || isStreaming) return

    const currentAttachments = [...pendingAttachments]
    clearPendingAttachments()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '24px'

    const { formattedContext: docsContext, images: extractedImages } =
      formatAttachmentsContext(currentAttachments)

    let finalPromptContent = content
    if (docsContext) {
      finalPromptContent = content
        ? `${docsContext}\n\n${content}`
        : `${docsContext}\n\nPlease analyze the attached document(s) and provide a comprehensive summary with key takeaways.`
    } else if (!content && extractedImages.length > 0) {
      finalPromptContent = 'Please inspect and describe this image in detail.'
    }

    let convId = activeConversationId
    let resolvedContext = continuationContextText

    // If context text hasn't been loaded yet, fetch it now
    if (continuationParentId && !resolvedContext) {
      try {
        const ctxData = await getConversationContextData(continuationParentId)
        resolvedContext = ctxData.formattedContext
      } catch (err) {
        console.error('Failed to load continuation context data:', err)
      }
    }

    /* Create conversation in DB if needed */
    if (!convId && !isTemporaryChat) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const titleText = content || (currentAttachments.length > 0 ? `Analysis: ${currentAttachments[0].name}` : 'New Chat')
        const title = titleText.slice(0, 40) + (titleText.length > 40 ? '…' : '')
        const insertPayload: any = {
          user_id: user.id,
          title,
          model: selectedModel,
          is_temporary: false,
        }
        if (continuationParentId) {
          insertPayload.parent_conversation_id = continuationParentId
        }

        // Try inserting with parent_conversation_id first
        let { data, error } = await supabase
          .from('conversations')
          .insert(insertPayload)
          .select()
          .single()

        // Graceful fallback if the user has not run the database migration yet
        if (error && continuationParentId) {
          console.warn('Database column parent_conversation_id not found, falling back without column:', error.message)
          delete insertPayload.parent_conversation_id
          const fallback = await supabase
            .from('conversations')
            .insert(insertPayload)
            .select()
            .single()
          data = fallback.data
        }

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
      content: content || (currentAttachments.length > 0 ? `Attached ${currentAttachments.length} file(s)` : ''),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      images: extractedImages.length > 0 ? extractedImages : undefined,
      created_at: new Date().toISOString()
    }
    addMessage(userMsg)

    if (convId && !isTemporaryChat) {
      const payload: any = {
        id: userMsgId,
        conversation_id: convId,
        role: 'user',
        content: userMsg.content,
      }
      if (currentAttachments.length > 0) {
        payload.attachments = currentAttachments
      }
      supabase.from('messages').insert(payload).then(({ error }) => {
        if (error && currentAttachments.length > 0) {
          delete payload.attachments
          supabase.from('messages').insert(payload).then()
        }
      })
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
          parentConversationId: continuationParentId || null,
          continuationContext: resolvedContext || null,
          messages: [
            ...messages.map((m) => ({
              role: m.role,
              content: m.content,
              images: m.images || null
            })),
            {
              role: 'user',
              content: finalPromptContent,
              images: extractedImages.length > 0 ? extractedImages : null
            }
          ],
          images: extractedImages.length > 0 ? extractedImages : null,
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

        {/* Multi-modal pending attachments strip */}
        {pendingAttachments.length > 0 && (
          <div className="pending-attachments-bar">
            {pendingAttachments.map((att) => (
              <div key={att.id} className={`pending-attachment-card ${att.type}`}>
                {att.type === 'image' && att.dataUrl ? (
                  <div className="attachment-thumb-wrapper">
                    <img src={att.dataUrl} alt={att.name} className="attachment-thumb-img" />
                  </div>
                ) : (
                  <div className={`attachment-doc-icon ${att.type}`}>
                    {att.type === 'code' ? <Code2 size={16} /> : <FileText size={16} />}
                  </div>
                )}
                <div className="attachment-details">
                  <span className="attachment-name" title={att.name}>
                    {att.name}
                  </span>
                  <span className="attachment-meta">
                    {formatFileSize(att.size)}
                    {att.tokenCount ? ` • ~${att.tokenCount} tokens` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="attachment-remove-btn"
                  onClick={() => removePendingAttachment(att.id)}
                  title="Remove attachment"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {pendingAttachments.length > 1 && (
              <button
                type="button"
                className="clear-attachments-btn"
                onClick={clearPendingAttachments}
                title="Remove all attachments"
              >
                Clear all
              </button>
            )}
            {isProcessingFiles && (
              <div className="attachment-processing-badge">
                <Loader2 size={13} className="spin-icon" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        )}

        {/* Glowing coloured border on focus */}
        <div className={`input-glow-wrapper ${isDragging ? 'drag-active' : ''}`}>
          <form onSubmit={handleSubmit}>
            <div
              className="input-box"
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
              }}
            >
              {/* Hidden file input for documents & images */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md,.json,.csv,.py,.js,.ts,.tsx,.jsx,.html,.css,.java,.sql,.sh,.yml,.yaml,.xml"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              {/* Plus / attach button */}
              <button
                type="button"
                className="icon-btn"
                title="Attach files or images"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFiles}
                style={{ flexShrink: 0, marginBottom: 0 }}
              >
                {isProcessingFiles ? <Loader2 size={18} className="spin-icon" /> : <Plus size={18} />}
              </button>

              <textarea
                ref={textareaRef}
                className="chat-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isDragging ? 'Drop files here to analyze...' : 'Ask Helfen AI, attach files or images'}
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
                  className={`send-btn ${(input.trim() || pendingAttachments.length > 0) && !isStreaming ? 'active' : ''}`}
                  disabled={(!input.trim() && pendingAttachments.length === 0) || isStreaming}
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
