'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAppStore, type Message } from '@/store/appStore'
import { generateConversationPdf } from '@/lib/pdfGenerator'
import { formatFileSize } from '@/lib/fileProcessor'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import {
  Sparkles, GitFork, ArrowLeft, Download, User, Calendar,
  Code2, FileText, Check, ExternalLink, ShieldCheck, Share2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface SharedChatData {
  id: string
  conversation_id: string | null
  title: string
  model: string
  is_anonymous: boolean
  creator_name: string | null
  messages: Message[]
  views_count: number
  created_at: string
}

function SharedChatContent() {
  const params = useParams()
  const router = useRouter()
  const shareId = params?.id as string

  const [chat, setChat] = useState<SharedChatData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  useEffect(() => {
    if (!shareId) return

    async function loadSharedChat() {
      setLoading(true)
      try {
        // 1. Try fetching from Supabase shared_chats
        const { data, error: sbError } = await supabase
          .from('shared_chats')
          .select('*')
          .eq('id', shareId)
          .single()

        if (!sbError && data) {
          setChat(data as any)
          // Increment views count non-blockingly
          supabase
            .from('shared_chats')
            .update({ views_count: (data.views_count || 0) + 1 })
            .eq('id', shareId)
            .then()
          setLoading(false)
          return
        }

        // 2. Fallback to localStorage (for offline/local dev or before migration)
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem(`helfen_share_${shareId}`)
          if (cached) {
            setChat(JSON.parse(cached))
            setLoading(false)
            return
          }
        }

        setError('This shared conversation could not be found or has expired.')
      } catch (err: any) {
        console.error('Error loading shared chat:', err)
        setError('Failed to load shared conversation.')
      } finally {
        setLoading(false)
      }
    }

    loadSharedChat()
  }, [shareId])

  function handleContinueInHelfen() {
    if (!chat) return

    const store = useAppStore.getState()

    // 1. Set continuation context so new messages remember this entire thread
    const formattedContext = chat.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n')

    store.startNewChatWithContinuation(
      chat.conversation_id || chat.id,
      chat.title
    )
    store.setContinuationParent(
      chat.conversation_id || chat.id,
      chat.title,
      chat.messages.length,
      `Context forked from shared conversation "${chat.title}":\n\n${formattedContext}`
    )

    // 2. Load the shared messages into the workspace
    store.setMessages(chat.messages)

    toast.success('Chat forked into your workspace! You can now continue chatting.', {
      icon: '🔗',
      duration: 3500
    })

    router.push('/')
  }

  async function handleExportPdf() {
    if (!chat || isExportingPdf) return
    setIsExportingPdf(true)
    try {
      await generateConversationPdf(chat.messages, {
        title: chat.title,
        model: chat.model,
        createdAt: chat.created_at
      })
      toast.success('PDF downloaded!')
    } catch (err) {
      console.error('Failed to export PDF:', err)
      toast.error('Failed to generate PDF')
    } finally {
      setIsExportingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="shared-loading-screen">
        <div className="voice-pulse" style={{ width: 44, height: 44 }} />
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Loading shared conversation...
        </span>
      </div>
    )
  }

  if (error || !chat) {
    return (
      <div className="shared-loading-screen">
        <div className="shared-error-card">
          <Share2 size={36} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
          <h2>Conversation Unavailable</h2>
          <p>{error || 'This link may be invalid or the conversation was removed.'}</p>
          <Link href="/" className="btn-primary" style={{ marginTop: 12, display: 'inline-flex', textDecoration: 'none' }}>
            <ArrowLeft size={15} style={{ marginRight: 6 }} />
            Return to Helfen Home
          </Link>
        </div>
      </div>
    )
  }

  const dateFormatted = new Date(chat.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  return (
    <div className="shared-page-container">
      {/* Top Navbar */}
      <header className="shared-page-header">
        <div className="shared-header-left">
          <Link href="/" className="shared-brand-link" title="Go to Helfen AI">
            <div className="message-avatar ai" style={{ width: 28, height: 28 }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <path d="M14 3L25 9V19L14 25L3 19V9L14 3Z" fill="url(#grad-share)" />
                <defs>
                  <linearGradient id="grad-share" x1="3" y1="3" x2="25" y2="25">
                    <stop stopColor="#4285f4" />
                    <stop offset="0.5" stopColor="#9c27b0" />
                    <stop offset="1" stopColor="#fbbc05" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="shared-brand-name">Helfen.AI</span>
          </Link>
          <span className="shared-badge">Public Snapshot</span>
        </div>

        <div className="shared-header-actions">
          <button
            type="button"
            className="shared-header-btn outline"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            title="Download PDF"
          >
            <Download size={15} />
            <span>{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
          </button>

          <button
            type="button"
            className="shared-header-btn primary"
            onClick={handleContinueInHelfen}
            title="Fork and continue in your own chat"
          >
            <GitFork size={15} />
            <span>Continue in Helfen</span>
          </button>
        </div>
      </header>

      {/* Hero Thread Info */}
      <section className="shared-hero-banner">
        <div className="shared-hero-inner">
          <h1 className="shared-title">{chat.title}</h1>
          <div className="shared-meta-row">
            <span className="shared-model-pill">{chat.model}</span>
            <span className="shared-meta-item">
              <Calendar size={13} />
              <span>{dateFormatted}</span>
            </span>
            <span className="shared-meta-item">
              <User size={13} />
              <span>
                {chat.is_anonymous || !chat.creator_name
                  ? 'Anonymous Creator'
                  : `Shared by ${chat.creator_name}`}
              </span>
            </span>
            <span className="shared-meta-item">
              <span>{chat.messages.length} messages</span>
            </span>
          </div>
        </div>
      </section>

      {/* Messages Thread */}
      <main className="shared-thread-main">
        <div className="shared-thread-inner">
          {chat.messages.map((msg, index) => (
            <div key={msg.id || index} className={`message-wrapper ${msg.role} fade-in`}>
              {msg.role === 'assistant' && (
                <div className="message-header">
                  <div className="message-avatar ai">
                    <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                      <path d="M14 3L25 9V19L14 25L3 19V9L14 3Z" fill="url(#grad-share-msg)" />
                      <defs>
                        <linearGradient id="grad-share-msg" x1="3" y1="3" x2="25" y2="25">
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
                <div className="user-bubble">
                  {/* Attachments if any */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="message-attachments-container">
                      {msg.attachments.map((att) => (
                        <div key={att.id} className={`message-doc-card ${att.type}`}>
                          <div className="message-doc-icon">
                            {att.type === 'code' ? <Code2 size={16} /> : <FileText size={16} />}
                          </div>
                          <div className="message-doc-info">
                            <span className="message-doc-name">{att.name}</span>
                            <span className="message-doc-size">{formatFileSize(att.size)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="user-text-content">{msg.content}</div>
                </div>
              ) : (
                <div className="assistant-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ))}

          {/* Bottom Call to Action Card */}
          <div className="shared-bottom-cta">
            <div className="shared-bottom-cta-text">
              <h3>Want to ask follow-up questions?</h3>
              <p>Fork this chat into your Helfen AI workspace to continue the thread with full context.</p>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}
              onClick={handleContinueInHelfen}
            >
              <GitFork size={16} />
              <span>Continue in Helfen</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function SharedChatPage() {
  return (
    <Suspense
      fallback={
        <div className="shared-page-container">
          <header className="shared-nav-header">
            <div className="shared-nav-inner">
              <Link href="/" className="shared-logo">
                <span className="logo-icon"><Sparkles size={18} /></span>
                <span className="logo-text">Helfen AI</span>
              </Link>
            </div>
          </header>
          <div className="shared-loading-state">
            <div className="shared-spinner" />
            <p>Loading shared conversation...</p>
          </div>
        </div>
      }
    >
      <SharedChatContent />
    </Suspense>
  )
}
