'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import {
  Menu, Plus, MessageSquare, Search, Sparkles,
  Image, Video, BookOpen, Timer, Settings,
  MoreHorizontal, Pin, Trash2, NotebookPen
} from 'lucide-react'
import toast from 'react-hot-toast'

export function Sidebar() {
  const {
    sidebarOpen, setSidebarOpen,
    activeConversationId, setActiveConversationId,
    conversations, setConversations, addConversation, removeConversation,
    updateConversation, isTemporaryChat, setIsTemporaryChat, setMessages
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadConversations() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setActiveMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('conversations').select('*')
      .eq('user_id', user.id).eq('is_temporary', false)
      .order('updated_at', { ascending: false }).limit(100)
    if (data) setConversations(data as any)
  }

  async function newChat() {
    setActiveConversationId(null)
    setMessages([])
    setIsTemporaryChat(false)
  }

  async function deleteConversation(id: string) {
    await supabase.from('conversations').delete().eq('id', id)
    removeConversation(id)
    if (activeConversationId === id) setActiveConversationId(null)
    toast.success('Chat deleted')
    setActiveMenu(null)
  }

  async function pinConversation(id: string, pinned: boolean) {
    await supabase.from('conversations').update({ is_pinned: !pinned }).eq('id', id)
    updateConversation(id, { is_pinned: !pinned })
    setActiveMenu(null)
  }

  const filtered = conversations.filter(c =>
    !c.is_archived && c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group by date (safe for SSR)
  const groups: Record<string, typeof conversations> = {}
  const now = typeof window !== 'undefined' ? new Date() : new Date(0)
  for (const c of filtered) {
    const diff = Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / 86400000)
    const g = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday'
      : diff < 7 ? 'Previous 7 days' : diff < 30 ? 'Previous 30 days' : 'Older'
    if (!groups[g]) groups[g] = []
    groups[g].push(c)
  }
  const groupOrder = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older']

  if (!sidebarOpen) return null

  return (
    <aside className="sidebar fade-in">
      {/* ── HEADER ── */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          {/* Gemini-style colourful diamond icon */}
          <div className="sidebar-brand-icon">
            <Sparkles size={14} color="white" />
          </div>
          <span className="sidebar-brand-name">Helfen</span>
        </div>
        <button
          className="sidebar-icon-btn"
          title="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Chat / Spark tabs */}
      <div className="sidebar-tabs">
        <button className="sidebar-tab active">Chat</button>
        <button className="sidebar-tab">Spark <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>BETA</span></button>
      </div>

      {/* ── NAV ITEMS ── */}
      <div className="sidebar-nav-group">
        <button className="sidebar-nav-item active" onClick={newChat}>
          <Plus size={18} />
          <span className="item-label">New chat</span>
        </button>
        <button className="sidebar-nav-item">
          <Search size={18} />
          <span className="item-label">Search chats</span>
        </button>
        <button className="sidebar-nav-item">
          <Sparkles size={18} />
          <span className="item-label">Students</span>
        </button>
        <button className="sidebar-nav-item">
          <Image size={18} />
          <span className="item-label">Images</span>
        </button>
        <button className="sidebar-nav-item">
          <Video size={18} />
          <span className="item-label">Videos</span>
        </button>
        <button className="sidebar-nav-item">
          <BookOpen size={18} />
          <span className="item-label">Library</span>
        </button>
      </div>

      <div className="sidebar-divider" />

      {/* Notebooks */}
      <div className="sidebar-section">Notebooks</div>
      <div className="sidebar-nav-group">
        <button className="sidebar-nav-item">
          <Plus size={18} />
          <span className="item-label">New notebook</span>
        </button>
        <button
          className="sidebar-nav-item"
          onClick={() => { setIsTemporaryChat(true); setActiveConversationId(null) }}
        >
          <Timer size={18} />
          <span className="item-label">Temporary chat</span>
        </button>
      </div>

      <div className="sidebar-divider" />

      {/* Search */}
      <div style={{ padding: '4px 12px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)',
          padding: '7px 12px'
        }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search chats"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 13, width: '100%',
              fontFamily: 'var(--font)'
            }}
          />
        </div>
      </div>

      {/* ── RECENTS ── */}
      <div className="sidebar-section">Recents</div>
      <div className="sidebar-conversations">
        {groupOrder.map(group =>
          groups[group]?.length ? (
            <div key={group}>
              {group !== 'Today' && (
                <div className="sidebar-section" style={{ paddingTop: 8 }}>{group}</div>
              )}
              <div className="sidebar-nav-group" style={{ gap: 1 }}>
                {groups[group].map(conv => (
                  <ConvItem
                    key={conv.id}
                    conv={conv}
                    active={activeConversationId === conv.id}
                    onClick={() => { setActiveConversationId(conv.id); setIsTemporaryChat(false) }}
                    onDelete={() => deleteConversation(conv.id)}
                    onPin={() => pinConversation(conv.id, conv.is_pinned)}
                    activeMenu={activeMenu}
                    setActiveMenu={setActiveMenu}
                    menuRef={menuRef}
                  />
                ))}
              </div>
            </div>
          ) : null
        )}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px', fontSize: 13 }}>
            {searchQuery ? 'No chats found' : 'No chats yet'}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="sidebar-footer">
        <button className="sidebar-user">
          <div className="sidebar-user-avatar">L</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">Likhith Vasireddy</div>
            <div className="sidebar-user-plan">Pro</div>
          </div>
          <Settings size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </button>
      </div>
    </aside>
  )
}

function ConvItem({
  conv, active, onClick, onDelete, onPin, activeMenu, setActiveMenu, menuRef
}: {
  conv: { id: string; title: string; is_pinned: boolean }
  active: boolean
  onClick: () => void
  onDelete: () => void
  onPin: () => void
  activeMenu: string | null
  setActiveMenu: (id: string | null) => void
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      className={`sidebar-nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      style={{ position: 'relative' }}
    >
      <MessageSquare size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
      <span className="item-label">{conv.title}</span>
      <div className="item-actions" onClick={e => e.stopPropagation()}>
        {conv.is_pinned && <Pin size={12} style={{ color: 'var(--text-muted)' }} />}
        <button
          className="sidebar-icon-btn"
          style={{ width: 24, height: 24 }}
          onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === conv.id ? null : conv.id) }}
        >
          <MoreHorizontal size={13} />
        </button>
        {activeMenu === conv.id && (
          <div ref={menuRef} className="dropdown" style={{ right: 0, top: '100%' }}>
            <button className="dropdown-item" onClick={onPin}>
              <Pin size={13} />{conv.is_pinned ? 'Unpin' : 'Pin'}
            </button>
            <div className="dropdown-divider" />
            <button className="dropdown-item danger" onClick={onDelete}>
              <Trash2 size={13} />Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
