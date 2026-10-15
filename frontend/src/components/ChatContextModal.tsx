'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, X, MessageSquare, Check, Sparkles,
  Clock, ArrowRight, Trash2, Pin, ChevronRight
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getConversationContextData } from '@/lib/supabase'
import toast from 'react-hot-toast'

export function ChatContextModal() {
  const {
    isContextModalOpen,
    setIsContextModalOpen,
    conversations,
    continuationParentId,
    setContinuationParent,
    clearContinuationParent
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
      const data = await getConversationContextData(convId)
      setContinuationParent(
        convId,
        title,
        data.messagesCount,
        data.formattedContext
      )
      toast.success(`Context linked: "${title}"`, {
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
      setContinuationParent(convId, title, 0, null)
      setIsContextModalOpen(false)
    } finally {
      setLoadingId(null)
    }
  }

  const handleClear = () => {
    clearContinuationParent()
    toast('Context unlinked — new chat will start fresh', {
      icon: '✨',
      style: {
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)'
      }
    })
  }

  return createPortal(
    <div
      className="context-modal-backdrop"
      onClick={() => setIsContextModalOpen(false)}
    >
      <div
        className="context-modal-container glass-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-modal-title"
      >
        {/* Glow halo */}
        <div className="context-modal-glow" />

        {/* Header */}
        <div className="context-modal-header">
          <div className="context-modal-header-info">
            <div className="context-modal-badge">
              <Sparkles size={13} className="sparkle-icon" />
              <span>Conversation Continuation</span>
            </div>
            <h2 id="context-modal-title" className="context-modal-title">
              Select Context Chat
            </h2>
            <p className="context-modal-subtitle">
              Choose an existing chat so its full memory, details, and discussion
              seamlessly carry over into this new chat.
            </p>
          </div>
          <button
            className="context-modal-close-btn"
            onClick={() => setIsContextModalOpen(false)}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Active Context Indicator */}
        {continuationParentId && (
          <div className="context-modal-current">
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
        <div className="context-modal-search">
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
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Chat List */}
        <div className="context-modal-list">
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
            context, Helfen AI recalls earlier decisions, instructions, and facts
            without filling up the new chat’s history.
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
