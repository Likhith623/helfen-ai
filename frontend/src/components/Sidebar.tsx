'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { supabase, getConversationContextData } from '@/lib/supabase'
import { resolveChatContextAndSummary } from '@/lib/chatContextService'
import {
  Menu, Plus, MessageSquare, Search, Sparkles,
  Image, Video, BookOpen, Timer, Settings,
  MoreHorizontal, Pin, Trash2, NotebookPen, Link2, LogIn, FileText, Share2
} from 'lucide-react'
import { AccountPopover } from '@/components/AccountPopover'
import { generateConversationPdf } from '@/lib/pdfGenerator'
import toast from 'react-hot-toast'

export function Sidebar() {
  const {
    sidebarOpen, setSidebarOpen,
    activeConversationId, setActiveConversationId,
    conversations, setConversations, addConversation, removeConversation,
    updateConversation, isTemporaryChat, setIsTemporaryChat, setMessages,
    startNewChatWithContinuation, setContinuationParent, continuationParentId,
    currentUser, userProfile, setIsAuthModalOpen, openShareModal,
    setIsKnowledgeBaseOpen, setIsTemplateManagerOpen, setIsContextModalOpen,
    clearContinuationParent
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadConversations() }, [currentUser])

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
    if (!user) {
      setConversations([])
      return
    }
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
    clearContinuationParent()
    toast.success('Started a fresh conversation')
  }

  function handleToggleTemporaryChat() {
    if (isTemporaryChat) {
      setIsTemporaryChat(false)
      setMessages([])
      toast.success('Exited temporary chat')
    } else {
      setIsTemporaryChat(true)
      setActiveConversationId(null)
      setMessages([])
      clearContinuationParent()
      toast.success('Temporary chat active (not saved to history)')
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

  async function handleContinueChat(convId: string, title: string) {
    setActiveMenu(null)
    startNewChatWithContinuation(convId, title)
    try {
      const resolved = await resolveChatContextAndSummary(convId, title)
      setContinuationParent(
        convId,
        title,
        resolved.messageCount,
        resolved.formattedContext,
        resolved.summaryResult
      )
    } catch (err) {
      console.error('Failed to load continuation context data:', err)
      const data = await getConversationContextData(convId)
      setContinuationParent(convId, title, data.messagesCount, data.formattedContext)
    }
    toast.success(`Context linked: "${title}"`, {
      icon: '🔗',
      style: {
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)'
      }
    })
  }

  async function handleExportChatPdf(convId: string, title: string) {
    setActiveMenu(null)
    const toastId = toast.loading(`Preparing PDF for "${title}"...`)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })

      if (error || !data || data.length === 0) {
        toast.error('No messages found to export', { id: toastId })
        return
      }

      await generateConversationPdf(data, {
        title,
      })
      toast.success('PDF exported successfully!', { id: toastId })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      toast.error('Failed to generate PDF', { id: toastId })
    }
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
          <div className="sidebar-brand-icon">
            <Sparkles size={14} color="white" />
          </div>
          <span className="sidebar-brand-name">Helfen AI</span>
        </div>
        <button
          className="sidebar-icon-btn"
          title="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        >
          <Menu size={18} />
        </button>
      </div>

      {/* ── WORKING FEATURES & NAVIGATION ── */}
      <div className="sidebar-nav-group">
        <button
          className={`sidebar-nav-item ${!activeConversationId && !isTemporaryChat ? 'active' : ''}`}
          onClick={newChat}
          title="Start a new chat"
        >
          <Plus size={18} />
          <span className="item-label">New chat</span>
        </button>

        <button
          className="sidebar-nav-item"
          onClick={() => setIsKnowledgeBaseOpen(true)}
          title="Open RAG Knowledge Base"
        >
          <BookOpen size={18} />
          <span className="item-label">Knowledge Base</span>
        </button>

        <button
          className="sidebar-nav-item"
          onClick={() => setIsTemplateManagerOpen(true)}
          title="Prompt Templates & Slash Commands"
        >
          <Sparkles size={18} />
          <span className="item-label">Prompt Templates</span>
        </button>

        <button
          className="sidebar-nav-item"
          onClick={() => setIsContextModalOpen(true)}
          title="Link previous chat context & deep summary"
        >
          <Link2 size={18} />
          <span className="item-label">Link Chat Context</span>
        </button>

        <button
          className={`sidebar-nav-item ${isTemporaryChat ? 'temporary-active' : ''}`}
          onClick={handleToggleTemporaryChat}
          title={isTemporaryChat ? 'Exit temporary chat' : 'Start temporary unsaved chat'}
        >
          <Timer size={18} />
          <span className="item-label">
            {isTemporaryChat ? 'Temporary Chat (Active)' : 'Temporary chat'}
          </span>
          {isTemporaryChat && (
            <span
              className="sidebar-temp-exit-pill"
              onClick={(e) => {
                e.stopPropagation()
                handleToggleTemporaryChat()
              }}
              title="Click to exit temporary chat"
            >
              Exit
            </span>
          )}
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
                    isLinkedContext={continuationParentId === conv.id}
                    onClick={() => { setActiveConversationId(conv.id); setIsTemporaryChat(false) }}
                    onDelete={() => deleteConversation(conv.id)}
                    onPin={() => pinConversation(conv.id, conv.is_pinned)}
                    onContinue={() => handleContinueChat(conv.id, conv.title)}
                    onExportPdf={() => handleExportChatPdf(conv.id, conv.title)}
                    onShare={() => { setActiveMenu(null); openShareModal(conv.id, conv.title) }}
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
      <div className="sidebar-footer" style={{ position: 'relative' }}>
        {currentUser ? (
          <>
            <button
              className="sidebar-user"
              onClick={() => setIsAccountOpen(!isAccountOpen)}
              title="Account & Settings"
            >
              <div className="sidebar-user-avatar">
                {userProfile?.full_name?.charAt(0).toUpperCase() ||
                  currentUser.email?.charAt(0).toUpperCase() ||
                  'U'}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">
                  {userProfile?.full_name || currentUser.email?.split('@')[0] || 'User'}
                </div>
                <div className="sidebar-user-plan">Pro</div>
              </div>
              <Settings size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
            <AccountPopover
              isOpen={isAccountOpen}
              onClose={() => setIsAccountOpen(false)}
            />
          </>
        ) : (
          <div className="sidebar-signin-card">
            <div className="sidebar-signin-card-text">
              <strong>Sign in to Helfen</strong>
              <div>Save your conversations and continue them anytime.</div>
            </div>
            <button
              type="button"
              className="sidebar-signin-btn"
              onClick={() => setIsAuthModalOpen(true, 'signin')}
            >
              <LogIn size={14} />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

function ConvItem({
  conv, active, isLinkedContext, onClick, onDelete, onPin, onContinue, onExportPdf, onShare, activeMenu, setActiveMenu, menuRef
}: {
  conv: { id: string; title: string; is_pinned: boolean }
  active: boolean
  isLinkedContext?: boolean
  onClick: () => void
  onDelete: () => void
  onPin: () => void
  onContinue: () => void
  onExportPdf: () => void
  onShare: () => void
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
      {isLinkedContext && (
        <span className="sidebar-linked-pill" title="Linked context for active chat">
          <Link2 size={11} />
        </span>
      )}
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
            <button className="dropdown-item" onClick={onContinue}>
              <Link2 size={13} />Continue in new chat
            </button>
            <button className="dropdown-item" onClick={onExportPdf}>
              <FileText size={13} />Export as PDF
            </button>
            <button className="dropdown-item" onClick={onShare}>
              <Share2 size={13} />Share chat
            </button>
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
