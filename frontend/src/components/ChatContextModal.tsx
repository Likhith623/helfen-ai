'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, X, MessageSquare, Check, Sparkles,
  Clock, ArrowRight, Trash2, Pin, ChevronRight
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getConversationContextData } from '@/lib/supabase'
import { resolveChatContextAndSummary } from '@/lib/chatContextService'
import toast from 'react-hot-toast'

export function ChatContextModal() {
  const {
    isContextModalOpen,
    setIsContextModalOpen,
    conversations,
    continuationParentId,
    setContinuationParent,
    clearContinuationParent,
    sidebarOpen
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isContextModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setSearchQuery('')
    }
  }, [isContextModalOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isContextModalOpen) {
        setIsContextModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isContextModalOpen, setIsContextModalOpen])

  if (!mounted || !isContextModalOpen) return null

  const filteredConversations = conversations.filter(
    (c) =>
      !c.is_archived &&
      c.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  )

  const handleSelectConversation = async (convId: string, title: string) => {
    setLoadingId(convId)
    try {
      const resolved = await resolveChatContextAndSummary(convId, title)
      setContinuationParent(
        convId,
        title,
        resolved.messageCount,
        resolved.formattedContext,
        resolved.summaryResult
      )
      toast.success(`Context linked: "${title}" (Deep Summary Ready)`, {
        icon: '🔗',
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)'
        }
      })
      setIsContextModalOpen(false)
    } catch (err) {
      console.error('Failed to select conversation context:', err)
      const data = await getConversationContextData(convId)
      setContinuationParent(convId, title, data.messagesCount, data.formattedContext)
      setIsContextModalOpen(false)
    } finally {
      setLoadingId(null)
    }
  }

  const handleClear = () => {
    clearContinuationParent()
    toast('Context unlinked — new chat will start fresh', {
      icon: '✨'
    })
  }

  return createPortal(
    <div
      className="context-modal-backdrop"
      onClick={() => setIsContextModalOpen(false)}
      style={{
        left: sidebarOpen ? '268px' : '0px',
        transition: 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div
        className="kb-modal-container context-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-modal-title"
      >
        {/* Header (Matching RAG Knowledge Base Design & Layout) */}
        <div className="kb-modal-header">
          <div className="kb-modal-header-left">
            <div
              className="kb-modal-icon-badge"
              style={{
                background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.2), rgba(156, 39, 176, 0.2))',
                borderColor: 'rgba(66, 133, 244, 0.35)',
                color: 'var(--blue)'
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div className="kb-modal-title-row">
                <span id="context-modal-title" className="kb-modal-title">
                  Conversation Continuation
                </span>
                <button
                  type="button"
                  className={`kb-rag-toggle ${continuationParentId ? 'active' : ''}`}
                  style={{ cursor: continuationParentId ? 'pointer' : 'default' }}
                  onClick={continuationParentId ? handleClear : undefined}
                  title={continuationParentId ? 'Click to clear linked context' : 'Context linking ready'}
                >
                  <span className="kb-toggle-dot" />
                  <span>{continuationParentId ? 'Context Linked' : 'Multi-Turn Ready'}</span>
                </button>
              </div>
              <p className="kb-modal-subtitle">
                Select an earlier conversation to seamlessly carry forward its full context, memory, and decisions
              </p>
            </div>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setIsContextModalOpen(false)}
            title="Close Continuation Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats Row (Matching RAG Modal 4-Card Summary Grid) */}
        <div className="kb-stats-row">
          <div className="kb-stat-box">
            <span className="kb-stat-num">{conversations.filter(c => !c.is_archived).length}</span>
            <span className="kb-stat-label">Saved Chats</span>
          </div>
          <div className="kb-stat-box">
            <span
              className="kb-stat-num"
              style={{
                color: continuationParentId ? '#34a853' : 'inherit',
                fontSize: continuationParentId ? '15px' : '17px'
              }}
            >
              {continuationParentId ? 'Linked' : 'None'}
            </span>
            <span className="kb-stat-label">Active Context</span>
          </div>
          <div className="kb-stat-box">
            <span className="kb-stat-num" style={{ fontSize: '15px' }}>Full Thread</span>
            <span className="kb-stat-label">Transfer Scope</span>
          </div>
          <div className="kb-stat-box">
            <span className="kb-stat-num" style={{ fontSize: '15px' }}>Deep Recall</span>
            <span className="kb-stat-label">Memory Mode</span>
          </div>
        </div>

        {/* Current Active Context Indicator */}
        {continuationParentId && (
          <div className="context-modal-current" style={{ margin: '14px 22px 0' }}>
            <div className="context-modal-current-content">
              <div className="context-modal-current-dot" />
              <div className="context-modal-current-text">
                <span className="current-label">Currently Continuing From:</span>
                <span className="current-title">
                  {conversations.find((c) => c.id === continuationParentId)?.title ||
                    'Selected Chat'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="context-modal-unlink-btn"
              onClick={handleClear}
              title="Remove linked context"
            >
              <Trash2 size={13} />
              <span>Unlink Context</span>
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div
          className="context-modal-search"
          style={{ margin: continuationParentId ? '12px 22px' : '16px 22px 12px' }}
        >
          <Search size={16} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="context-modal-search-input"
            placeholder="Search previous chats by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Section Heading */}
        <div style={{ padding: '0 22px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="kb-section-heading">
            {searchQuery
              ? `Search Results (${filteredConversations.length})`
              : `Available Conversations (${filteredConversations.length})`}
          </span>
        </div>

        {/* Chat List */}
        <div className="context-modal-list" style={{ padding: '0 22px 14px' }}>
          {filteredConversations.length === 0 ? (
            <div className="context-modal-empty">
              <MessageSquare size={32} style={{ opacity: 0.3 }} />
              <p>
                {searchQuery
                  ? 'No matching chats found for your search.'
                  : 'No previous conversations found yet.'}
              </p>
              <span className="context-modal-empty-hint">
                Start a conversation first, and you will be able to branch or
                continue it anytime here!
              </span>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === continuationParentId
              const isLoading = conv.id === loadingId
              const dateStr = new Date(conv.updated_at).toLocaleDateString(
                undefined,
                { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
              )

              return (
                <div
                  key={conv.id}
                  className={`context-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectConversation(conv.id, conv.title)}
                >
                  <div className="context-item-left">
                    <div
                      className={`context-item-icon ${
                        isSelected ? 'selected-icon' : ''
                      }`}
                    >
                      {conv.is_pinned ? (
                        <Pin size={16} />
                      ) : (
                        <MessageSquare size={16} />
                      )}
                    </div>
                    <div className="context-item-details">
                      <div className="context-item-title-row">
                        <span className="context-item-title">{conv.title}</span>
                        {isSelected && (
                          <span className="context-item-active-pill">
                            <Check size={11} /> Linked Context
                          </span>
                        )}
                      </div>
                      <div className="context-item-meta">
                        <span className="meta-time">
                          <Clock size={11} />
                          {dateStr}
                        </span>
                        <span className="meta-dot">•</span>
                        <span className="meta-model">{conv.model || 'llama3.2:3b'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="context-item-right">
                    {isLoading ? (
                      <div className="context-item-loading-spinner" />
                    ) : isSelected ? (
                      <span className="context-item-action is-active">Active</span>
                    ) : (
                      <button
                        className="context-item-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectConversation(conv.id, conv.title)
                        }}
                      >
                        <span>Select</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer info */}
        <div className="context-modal-footer">
          <div className="footer-tip">
            💡 <strong>Pro Tip:</strong> When a previous chat is linked as
            context, Helfen recalls earlier decisions, instructions, and facts
            without filling up the new chat’s history.
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
