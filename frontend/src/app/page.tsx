'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { MessageList } from '@/components/MessageList'
import { ChatInput } from '@/components/ChatInput'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import {
  Menu, Sun, Moon, Volume2, VolumeX, History,
  ChevronDown, Code, PenTool, Lightbulb, GraduationCap, Sparkles
} from 'lucide-react'

export default function Home() {
  const {
    theme, toggleTheme, sidebarOpen, setSidebarOpen,
    activeConversationId, setMessages, messages,
    selectedModel, setSelectedModel, voiceEnabled, setVoiceEnabled,
    isTemporaryChat
  } = useAppStore()

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true })

      if (data) {
        // Also fetch annotations
        const { data: annData } = await supabase
          .from('inline_annotations')
          .select('*, inline_messages(*)')
          .eq('conversation_id', activeConversationId)

        if (annData) {
          const annMap: Record<string, any[]> = {}
          for (const ann of annData) {
            if (!annMap[ann.message_id]) annMap[ann.message_id] = []
            // Sort messages
            if (ann.inline_messages) {
              ann.inline_messages.sort((a: any, b: any) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
            }
            annMap[ann.message_id].push({ ...ann, messages: ann.inline_messages })
          }
          
          for (const msgId in annMap) {
            useAppStore.getState().setAnnotations(msgId, annMap[msgId])
          }
        }

        setMessages(data as any)
      }
    }
    loadMessages()

    // Realtime subscription
    const sub = supabase.channel(`messages:${activeConversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConversationId}`
      }, payload => {
        // Only add if not already locally added (avoids duplicates for own messages)
        const currentMsgs = useAppStore.getState().messages
        if (!currentMsgs.find(m => m.id === payload.new.id)) {
          useAppStore.getState().addMessage(payload.new as any)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [activeConversationId])

  return (
    <div className="app-container">
      <Sidebar />

      <main className="chat-area">
        <header className="topbar fade-in">
          <div className="topbar-left">
            {!sidebarOpen && (
              <button 
                className="sidebar-menu-btn" 
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
            )}
            
            <div className="model-selector">
              Helfen AI
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </div>

            {isTemporaryChat && (
              <div className="temporary-badge">
                <History size={14} />
                Temporary chat
              </div>
            )}
          </div>

          <div className="topbar-right">
            <button 
              className="icon-btn" 
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title={voiceEnabled ? "Voice output enabled" : "Voice output disabled"}
            >
              {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="user-avatar" title="Account settings">
              L
            </div>
          </div>
        </header>

        {messages.length === 0 ? (
          <div className="welcome-screen fade-in">
            <div className="gemini-logo welcome-logo">
              <Sparkles className="text-white" size={32} />
            </div>
            <h1 className="welcome-title">Hello, Likhith</h1>
            <p className="welcome-subtitle">
              Select any text in my answers to ask specific questions, hear it spoken, or translate it.
            </p>

            <div className="suggestions-grid">
              <div className="suggestion-card">
                <div className="suggestion-icon" style={{ background: 'rgba(234, 67, 53, 0.1)', color: '#ea4335' }}>
                  <PenTool size={18} />
                </div>
                <div className="suggestion-text">
                  Help me draft an email to a recruiter for a software engineering role
                </div>
              </div>
              <div className="suggestion-card">
                <div className="suggestion-icon" style={{ background: 'rgba(52, 168, 83, 0.1)', color: '#34a853' }}>
                  <Code size={18} />
                </div>
                <div className="suggestion-text">
                  Explain how React Server Components work under the hood
                </div>
              </div>
              <div className="suggestion-card">
                <div className="suggestion-icon" style={{ background: 'rgba(251, 188, 5, 0.1)', color: '#fbbc05' }}>
                  <Lightbulb size={18} />
                </div>
                <div className="suggestion-text">
                  Brainstorm 5 unique features for a language learning app
                </div>
              </div>
              <div className="suggestion-card">
                <div className="suggestion-icon" style={{ background: 'rgba(66, 133, 244, 0.1)', color: '#4285f4' }}>
                  <GraduationCap size={18} />
                </div>
                <div className="suggestion-text">
                  Explain quantum computing to a high school student
                </div>
              </div>
            </div>
          </div>
        ) : (
          <MessageList />
        )}

        <ChatInput />
      </main>
    </div>
  )
}
