'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { MessageList } from '@/components/MessageList'
import { ChatInput } from '@/components/ChatInput'
import { AuthModal } from '@/components/AuthModal'
import { PromptTemplateModal } from '@/components/PromptTemplateModal'
import { ShareModal } from '@/components/ShareModal'
import { KnowledgeBaseModal } from '@/components/KnowledgeBaseModal'
import { RagSourceInspector } from '@/components/RagSourceInspector'
import { ContinuousVoiceModal } from '@/components/ContinuousVoiceModal'
import { AccountPopover } from '@/components/AccountPopover'
import { useAppStore } from '@/store/appStore'
import { supabase, getConversationContextData } from '@/lib/supabase'
import { resolveChatContextAndSummary } from '@/lib/chatContextService'
import {
  Sun, Moon, Volume2, VolumeX, History,
  Download, Edit, Sparkles, Menu, Link2, LogIn, FileText, Share2,
  BookOpen, Mic, Code2, X
} from 'lucide-react'
import { generateConversationPdf } from '@/lib/pdfGenerator'
import toast from 'react-hot-toast'

const SUGGESTIONS = [
  { icon: '✏️', label: 'Design a book cover for my life story' },
  { icon: '🌿', label: 'Explain how photosynthesis works' },
  { icon: '🪑', label: 'Restore an old wooden table' },
]

export default function Home() {
  const {
    theme, toggleTheme, sidebarOpen, setSidebarOpen,
    activeConversationId, setMessages, messages,
    voiceEnabled, setVoiceEnabled, isTemporaryChat, setIsTemporaryChat,
    setAnnotations, conversations, selectedModel,
    continuationParentId, continuationParentTitle,
    setIsContextModalOpen, startNewChatWithContinuation, setContinuationParent,
    currentUser, userProfile, setCurrentUser, setUserProfile, setIsAuthModalOpen,
    openShareModal
  } = useAppStore()

  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  /* Listen to Supabase Auth State */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser({ id: session.user.id, email: session.user.email })
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserProfile(data as any)
          })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser({ id: session.user.id, email: session.user.email })
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserProfile(data as any)
          })
      } else {
        setCurrentUser(null)
        setUserProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setCurrentUser, setUserProfile])

  /* Load messages for active conversation */
  useEffect(() => {
    if (!activeConversationId) { setMessages([]); return }

    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true })

      if (!data) return

      const { data: annData } = await supabase
        .from('inline_annotations')
        .select('*, inline_messages(*)')
        .eq('conversation_id', activeConversationId)

      if (annData) {
        const annMap: Record<string, any[]> = {}
        for (const ann of annData) {
          if (!annMap[ann.message_id]) annMap[ann.message_id] = []
          if (ann.inline_messages)
            ann.inline_messages.sort((a: any, b: any) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          annMap[ann.message_id].push({ ...ann, messages: ann.inline_messages })
        }
        for (const msgId in annMap) setAnnotations(msgId, annMap[msgId])
      }

      setMessages(data as any)
    }
    load()

    const sub = supabase.channel(`msgs:${activeConversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeConversationId}`
      }, payload => {
        const cur = useAppStore.getState().messages
        if (!cur.find(m => m.id === payload.new.id))
          useAppStore.getState().addMessage(payload.new as any)
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [activeConversationId])

  const isEmpty = messages.length === 0

  return (
    <div className="app-container">
      <Sidebar />

      <main className="chat-area">
        {/* ── TOP BAR ── */}
        <header className="topbar fade-in">
          <div className="topbar-left">
            {/* Hamburger — only visible when sidebar is collapsed */}
            {!sidebarOpen && (
              <button
                className="icon-btn"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            {isTemporaryChat && (
              <div className="topbar-temp-badge fade-in">
                <History size={13} style={{ color: '#f59e0b' }} />
                <span>Temporary chat</span>
                <button
                  type="button"
                  className="topbar-temp-exit-btn"
                  onClick={() => {
                    setIsTemporaryChat(false)
                    setMessages([])
                    toast.success('Exited temporary chat. Now in regular saved chat.')
                  }}
                  title="Exit temporary chat"
                >
                  <X size={12} />
                  <span>Exit</span>
                </button>
              </div>
            )}
          </div>

          <div className="topbar-right">
            {/* Active Model & Engine Status Indicator */}
            <div className="topbar-status-pill">
              <span className="status-indicator-dot" />
              <span className="status-label">
                {selectedModel === 'gemini-3.5-flash'
                  ? 'Gemini 3.5 Flash Active'
                  : 'Ollama & Gemini Ready'}
              </span>
            </div>

            <button
              className="icon-btn"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title={voiceEnabled ? 'Voice on' : 'Voice off'}
            >
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Export full conversation as PDF */}
            {messages.length > 0 && (
              <button
                className="icon-btn"
                title="Export conversation as PDF"
                disabled={isExportingPdf}
                onClick={async () => {
                  try {
                    setIsExportingPdf(true)
                    const activeConv = conversations.find(c => c.id === activeConversationId)
                    const title = activeConv?.title || 'Conversation Thread'
                    await generateConversationPdf(messages, {
                      title,
                      model: selectedModel,
                    })
                  } catch (err) {
                    console.error('Failed to export conversation PDF:', err)
                  } finally {
                    setIsExportingPdf(false)
                  }
                }}
              >
                <FileText size={18} />
              </button>
            )}

            {/* Share Chat */}
            {messages.length > 0 && (
              <button
                className="icon-btn"
                title="Share conversation"
                onClick={() => {
                  const activeConv = conversations.find((c) => c.id === activeConversationId)
                  const title = activeConv?.title || 'Shared Conversation'
                  openShareModal(activeConversationId || '', title)
                }}
              >
                <Share2 size={18} />
              </button>
            )}

            {/* Branch / Continue this chat in a new session */}
            {activeConversationId && (
              <button
                className="icon-btn"
                title="Branch / Continue this conversation in a new chat"
                onClick={async () => {
                  const activeConv = conversations.find(c => c.id === activeConversationId)
                  const title = activeConv?.title || 'Current Chat'
                  startNewChatWithContinuation(activeConversationId, title)
                  try {
                    const resolved = await resolveChatContextAndSummary(activeConversationId, title)
                    setContinuationParent(
                      activeConversationId,
                      title,
                      resolved.messageCount,
                      resolved.formattedContext,
                      resolved.summaryResult
                    )
                  } catch (err) {
                    console.error(err)
                    const data = await getConversationContextData(activeConversationId)
                    setContinuationParent(activeConversationId, title, data.messagesCount, data.formattedContext)
                  }
                }}
              >
                <Link2 size={18} />
              </button>
            )}

            <button className="icon-btn" title="New chat" onClick={() => {
              useAppStore.getState().setActiveConversationId(null)
              useAppStore.getState().setMessages([])
            }}>
              <Edit size={18} />
            </button>

            {currentUser ? (
              <div style={{ position: 'relative' }}>
                <button
                  className="user-avatar-btn"
                  title="Account & Profile"
                  onClick={() => setIsAccountOpen(!isAccountOpen)}
                >
                  {userProfile?.full_name?.charAt(0).toUpperCase() ||
                    currentUser.email?.charAt(0).toUpperCase() ||
                    'U'}
                </button>
                <AccountPopover
                  isOpen={isAccountOpen}
                  onClose={() => setIsAccountOpen(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                className="topbar-signin-btn"
                onClick={() => setIsAuthModalOpen(true, 'signin')}
                title="Sign in to your account"
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* ── WELCOME / MESSAGES ── */}
        {isEmpty ? (
          <div className="welcome-screen fade-in">
            {/* Ambient luminous glow backdrops */}
            <div className="welcome-glow" />
            <div className="welcome-glow-secondary" />

            <div className="welcome-hero-content">
              {/* Iridescent badge */}
              <div className="welcome-hero-badge">
                <Sparkles size={14} className="sparkle-gemini" />
                <span>Context-Aware Multi-Modal Intelligence</span>
              </div>

              <h1 className="welcome-heading">
                What would you like to <span className="text-gradient-aurora">explore</span> or <span className="text-gradient-cyan">continue</span>?
              </h1>
              <p className="welcome-subheading">
                Helfen AI seamlessly retains conversational memory across sessions, grounds answers in your documents with hybrid RAG, and conducts real-time neural voice dialogue.
              </p>

              {/* Context continuation banner / trigger */}
              {continuationParentId ? (
                <div
                  className="welcome-continuation-banner"
                  onClick={() => setIsContextModalOpen(true)}
                  title="Click to view or switch context chat"
                >
                  <div className="welcome-continuation-pulse" />
                  <div className="welcome-continuation-info">
                    <span className="banner-tag">Context Active:</span>
                    <strong className="banner-title">{continuationParentTitle || 'Previous Chat'}</strong>
                    <span className="banner-action">• Click to change</span>
                  </div>
                </div>
              ) : conversations.length > 0 ? (
                <button
                  type="button"
                  className="welcome-continuation-banner unlinked"
                  onClick={() => setIsContextModalOpen(true)}
                  title="Choose an earlier chat to use as context for this new session"
                >
                  <Link2 size={15} className="text-blue" />
                  <span>Link context from an earlier conversation</span>
                  <span className="banner-pill-badge">{conversations.length} available</span>
                </button>
              ) : null}

              {/* Interactive Showcase Grid */}
              <div className="welcome-showcase-grid">
                <div
                  className="showcase-card"
                  onClick={() => {
                    if (conversations.length > 0) {
                      setIsContextModalOpen(true)
                    } else {
                      const ta = document.querySelector<HTMLTextAreaElement>('.chat-textarea')
                      if (ta) {
                        ta.value = 'i want you to have a context of "New Chat"'
                        ta.dispatchEvent(new Event('input', { bubbles: true }))
                        ta.focus()
                      }
                    }
                  }}
                >
                  <div className="showcase-card-icon blue">
                    <Link2 size={20} />
                  </div>
                  <div className="showcase-card-body">
                    <h3>Chat Memory & Context Linking</h3>
                    <p>Inherit full decisions, parameters, and deep summaries from earlier discussions.</p>
                  </div>
                </div>

                <div
                  className="showcase-card"
                  onClick={() => useAppStore.getState().setIsKnowledgeBaseOpen(true)}
                >
                  <div className="showcase-card-icon purple">
                    <BookOpen size={20} />
                  </div>
                  <div className="showcase-card-body">
                    <h3>Hybrid RAG Knowledge Base</h3>
                    <p>Search and ground responses with vector embeddings, BM25 scoring & source citations.</p>
                  </div>
                </div>

                <div
                  className="showcase-card"
                  onClick={() => useAppStore.getState().startContinuousVoice()}
                >
                  <div className="showcase-card-icon green">
                    <Mic size={20} />
                  </div>
                  <div className="showcase-card-body">
                    <h3>Two-Way Neural Voice</h3>
                    <p>Hands-free continuous conversational turn-taking with live voice waveform.</p>
                  </div>
                </div>

                <div
                  className="showcase-card"
                  onClick={() => {
                    const ta = document.querySelector<HTMLTextAreaElement>('.chat-textarea')
                    if (ta) {
                      ta.value = '/diagram Show the architecture of a real-time reactive streaming system'
                      ta.dispatchEvent(new Event('input', { bubbles: true }))
                      ta.focus()
                    }
                  }}
                >
                  <div className="showcase-card-icon orange">
                    <Code2 size={20} />
                  </div>
                  <div className="showcase-card-body">
                    <h3>Code & System Architecture</h3>
                    <p>Interactive Mermaid diagrams, unit tests, and structural code refactoring.</p>
                  </div>
                </div>
              </div>

              {/* Quick suggestion chips */}
              <div className="welcome-suggestions-row">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    className="suggestion-chip-premium"
                    onClick={() => {
                      const ta = document.querySelector<HTMLTextAreaElement>('.chat-textarea')
                      if (ta) {
                        ta.value = s.label
                        ta.dispatchEvent(new Event('input', { bubbles: true }))
                        ta.focus()
                      }
                    }}
                  >
                    <span className="suggestion-chip-emoji">{s.icon}</span>
                    <span className="suggestion-chip-text">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <MessageList />
        )}

        {/* ── CHAT INPUT (always visible at bottom) ── */}
        <ChatInput />
      </main>

      {/* ── AUTHENTICATION MODAL ── */}
      <AuthModal />

      {/* ── PROMPT TEMPLATE & SLASH COMMANDS MODAL ── */}
      <PromptTemplateModal />

      {/* ── SHARE CHAT MODAL ── */}
      <ShareModal />

      {/* ── RAG KNOWLEDGE BASE MODAL ── */}
      <KnowledgeBaseModal />

      {/* ── RAG GROUNDED SOURCES INSPECTOR ── */}
      <RagSourceInspector />

      {/* ── CONTINUOUS TWO-WAY VOICE MODE ── */}
      <ContinuousVoiceModal />
    </div>
  )
}
