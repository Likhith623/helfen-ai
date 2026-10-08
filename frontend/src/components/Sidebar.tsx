'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import {
  Plus, MessageSquare, Clock, Pin, Archive, Search,
  Settings, HelpCircle, ChevronDown, Trash2, Edit3,
  MoreHorizontal, Sparkles, BookOpen, Timer
} from 'lucide-react'
import toast from 'react-hot-toast'

export function Sidebar() {
  const {
    sidebarOpen, activeConversationId, setActiveConversationId,
    conversations, setConversations, addConversation, removeConversation,
    updateConversation, isTemporaryChat, setIsTemporaryChat, theme
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [groupedConvs, setGroupedConvs] = useState<Record<string, typeof conversations>>({})
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    // Group conversations by date
    const groups: Record<string, typeof conversations> = {}
    const now = new Date()
    const filtered = conversations.filter((c) =>
      !c.is_archived &&
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    for (const conv of filtered) {
      const date = new Date(conv.updated_at)
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
      let group = 'Older'
      if (diffDays === 0) group = 'Today'
      else if (diffDays === 1) group = 'Yesterday'
      else if (diffDays < 7) group = 'Previous 7 days'
      else if (diffDays < 30) group = 'Previous 30 days'

      if (!groups[group]) groups[group] = []
      groups[group].push(conv)
    }
    setGroupedConvs(groups)
  }, [conversations, searchQuery])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_temporary', false)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (data) setConversations(data as typeof conversations)
  }

  async function createNewChat() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Allow anonymous / guest mode
      setActiveConversationId(null)
      return
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'New Chat',
        model: 'llama3.2:3b',
        is_temporary: false,
      })
      .select()
      .single()

    if (data) {
      addConversation(data as typeof conversations[0])
      setActiveConversationId(data.id)
    }
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

  const groupOrder = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older']

  if (!sidebarOpen) return null

  return (
    <aside className="sidebar fade-in">
      {/* Header */}
      <div className="sidebar-header">
        <button
          className="sidebar-menu-btn"
          onClick={() => useAppStore.getState().setSidebarOpen(false)}
          title="Close sidebar"
        >
          <MessageSquare size={20} />
        </button>
        <button className="sidebar-menu-btn" title="Search">
          <Search size={18} />
        </button>
      </div>

      {/* New Chat Button */}
      <button className="sidebar-new-chat" onClick={createNewChat}>
        <Plus size={18} />
        <span>New chat</span>
      </button>

      {/* Temporary Chat */}
      <button
        className="sidebar-nav-item"
        onClick={() => {
          setIsTemporaryChat(true)
          setActiveConversationId(null)
        }}
        style={{ margin: '4px 8px', width: 'calc(100% - 16px)' }}
      >
        <Timer size={18} />
        <span className="item-title">Temporary chat</span>
      </button>

      {/* Explore / Gems */}
      <div className="sidebar-divider" />
      
      <button className="sidebar-nav-item" style={{ margin: '0 8px', width: 'calc(100% - 16px)' }}>
        <Sparkles size={18} />
        <span className="item-title">Explore Helfen AI</span>
      </button>

      <div className="sidebar-divider" />

      {/* Search */}
      <div style={{ padding: '8px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)',
          padding: '6px 12px', border: '1px solid transparent'
        }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search chats"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 13, width: '100%',
              fontFamily: 'var(--font-inter)'
            }}
          />
        </div>
      </div>

      {/* Pinned */}
      {conversations.filter(c => c.is_pinned).length > 0 && (
        <>
          <div className="sidebar-section-title">Pinned</div>
          <div className="sidebar-nav">
            {conversations.filter(c => c.is_pinned).map(conv => (
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
          <div className="sidebar-divider" />
        </>
      )}

      {/* Conversations by group */}
      <div className="sidebar-conversations">
        {groupOrder.map(group => (
          groupedConvs[group] && groupedConvs[group].length > 0 ? (
            <div key={group}>
              <div className="sidebar-section-title">{group}</div>
              <div className="sidebar-nav">
                {groupedConvs[group].map(conv => (
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
        ))}

        {Object.keys(groupedConvs).length === 0 && searchQuery && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 16px', fontSize: 13 }}>
            No chats found
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-nav-item" style={{ width: '100%' }}>
          <Settings size={18} />
          <span className="item-title">Settings</span>
        </button>
        <button className="sidebar-nav-item" style={{ width: '100%' }}>
          <HelpCircle size={18} />
          <span className="item-title">Help</span>
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
    <div className={`sidebar-nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <MessageSquare size={16} style={{ flexShrink: 0 }} />
      <span className="item-title">{conv.title}</span>
      <div className="item-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="icon-btn"
          style={{ width: 24, height: 24 }}
          onClick={(e) => {
            e.stopPropagation()
            setActiveMenu(activeMenu === conv.id ? null : conv.id)
          }}
        >
          <MoreHorizontal size={14} />
        </button>
        {activeMenu === conv.id && (
          <div
            ref={menuRef}
            className="dropdown"
            style={{ position: 'absolute', right: 8, top: '100%', minWidth: 160 }}
          >
            <button className="dropdown-item" onClick={onPin}>
              <Pin size={14} />
              {conv.is_pinned ? 'Unpin' : 'Pin chat'}
            </button>
            <div className="dropdown-divider" />
            <button className="dropdown-item danger" onClick={onDelete}>
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
