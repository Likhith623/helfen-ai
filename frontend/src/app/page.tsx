'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { MessageList } from '@/components/MessageList'
import { ChatInput } from '@/components/ChatInput'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import {
  Sun, Moon, Volume2, VolumeX, History,
  Download, Edit, Sparkles, Menu
} from 'lucide-react'

const SUGGESTIONS = [
  { icon: '✏️', label: 'Design a book cover for my life story' },
  { icon: '🌿', label: 'Explain how photosynthesis works' },
  { icon: '🪑', label: 'Restore an old wooden table' },
]

export default function Home() {
  const {
    theme, toggleTheme, sidebarOpen, setSidebarOpen,
    activeConversationId, setMessages, messages,
    voiceEnabled, setVoiceEnabled, isTemporaryChat,
    setAnnotations
  } = useAppStore()

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
              <div className="topbar-badge">
                <History size={13} />
                Temporary chat
              </div>
            )}
          </div>

          <div className="topbar-right">
            <button className="get-app-btn" title="Get the app">
              <Download size={14} />
              Get app
            </button>

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

            <button className="icon-btn" title="New chat" onClick={() => {
              useAppStore.getState().setActiveConversationId(null)
              useAppStore.getState().setMessages([])
            }}>
              <Edit size={18} />
            </button>

            <button className="user-avatar-btn" title="Account">L</button>
          </div>
        </header>

        {/* ── WELCOME / MESSAGES ── */}
        {isEmpty ? (
          <div className="welcome-screen fade-in">
            {/* Colourful glow blobs */}
            <div className="welcome-glow" />
            <div className="welcome-glow-ring" />

            <h1 className="welcome-heading">Where should we start?</h1>

            {/* Input box rendered at bottom via absolute positioning */}

            {/* Suggestion chips */}
            <div className="welcome-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => {
                    const ta = document.querySelector<HTMLTextAreaElement>('.chat-textarea')
                    if (ta) {
                      ta.value = s.label
                      ta.dispatchEvent(new Event('input', { bubbles: true }))
                      ta.focus()
                    }
                  }}
                >
                  <span className="suggestion-chip-icon">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList />
        )}

        {/* ── CHAT INPUT (always visible at bottom) ── */}
        <ChatInput />
      </main>
    </div>
  )
}
