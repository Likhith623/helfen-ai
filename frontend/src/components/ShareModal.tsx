'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import {
  Share2, X, Copy, Check, ExternalLink, Globe, Shield, MessageSquare
} from 'lucide-react'
import toast from 'react-hot-toast'

export function ShareModal() {
  const {
    isShareModalOpen,
    closeShareModal,
    shareModalConvId,
    shareModalConvTitle,
    messages,
    activeConversationId,
    selectedModel,
    currentUser,
    userProfile
  } = useAppStore()

  const [isAnonymous, setIsAnonymous] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isShareModalOpen) return null

  async function handleCreateShareLink() {
    setIsGenerating(true)
    try {
      let convMessages = messages
      // If sharing a conversation other than the active one, fetch its messages
      if (shareModalConvId && shareModalConvId !== activeConversationId) {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', shareModalConvId)
          .order('created_at', { ascending: true })

        if (!error && data) {
          convMessages = data as any
        }
      }

      if (!convMessages || convMessages.length === 0) {
        toast.error('Cannot share an empty conversation')
        setIsGenerating(false)
        return
      }

      // Generate clean unique share ID
      const shareId = 'sh-' + crypto.randomUUID().slice(0, 12)
      const creatorName = isAnonymous
        ? null
        : userProfile?.full_name || currentUser?.email?.split('@')[0] || 'Helfen User'

      const payload = {
        id: shareId,
        conversation_id: shareModalConvId || null,
        user_id: currentUser?.id || null,
        title: shareModalConvTitle || 'Shared Conversation',
        model: selectedModel || 'llama3.2:3b',
        is_anonymous: isAnonymous,
        creator_name: creatorName,
        messages: convMessages,
        views_count: 0,
        created_at: new Date().toISOString()
      }

      // Try inserting into Supabase shared_chats
      const { error } = await supabase.from('shared_chats').insert(payload)

      // Always save a copy to localStorage for seamless local testing & fallback
      if (typeof window !== 'undefined') {
        localStorage.setItem(`helfen_share_${shareId}`, JSON.stringify(payload))
      }

      if (error) {
        console.warn('Supabase shared_chats insert note:', error.message)
      }

      const generatedUrl = `${window.location.origin}/share/${shareId}`
      setShareUrl(generatedUrl)
      toast.success('Public link generated!')
    } catch (err) {
      console.error('Failed to create share link:', err)
      toast.error('Failed to generate share link')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success('Link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop" onClick={closeShareModal}>
      <div className="share-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="share-modal-header">
          <div className="share-modal-title-group">
            <div className="share-modal-icon">
              <Share2 size={18} />
            </div>
            <div>
              <h2 className="share-modal-title">Share Conversation</h2>
              <p className="share-modal-subtitle">
                Create a public, read-only link anyone can view and fork
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeShareModal}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conversation details */}
        <div className="share-modal-body">
          <div className="share-preview-card">
            <div className="share-preview-icon">
              <MessageSquare size={16} />
            </div>
            <div className="share-preview-info">
              <span className="share-preview-title">
                {shareModalConvTitle || 'Conversation'}
              </span>
              <span className="share-preview-meta">
                {messages.length} message(s) • {selectedModel || 'llama3.2:3b'}
              </span>
            </div>
          </div>

          {/* Privacy controls */}
          <div className="share-options-group">
            <label className="share-option-row">
              <div className="share-option-text">
                <div className="share-option-title">
                  <Shield size={14} />
                  <span>Share Anonymously</span>
                </div>
                <div className="share-option-desc">
                  Hide your name and account info from the shared chat page
                </div>
              </div>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => {
                  setIsAnonymous(e.target.checked)
                  setShareUrl(null) // reset generated link if privacy changed
                }}
                className="share-checkbox"
              />
            </label>
          </div>

          {/* Share link box */}
          {shareUrl ? (
            <div className="share-result-box">
              <div className="share-result-label">
                <Globe size={13} />
                <span>Anyone with this link can view this chat</span>
              </div>
              <div className="share-url-container">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="share-url-input"
                />
                <button
                  type="button"
                  className="share-copy-btn"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="share-action-links">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="share-open-link"
                >
                  <ExternalLink size={13} />
                  <span>Open public view</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="share-generate-actions">
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', padding: '10px 16px', fontSize: 13 }}
                onClick={handleCreateShareLink}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating Public Link...' : 'Create Public Share Link'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
