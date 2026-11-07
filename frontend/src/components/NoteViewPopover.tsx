'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { StickyNote, Trash2, Edit3, MessageSquarePlus, X, Check, Clock, Palette } from 'lucide-react'
import type { InlineAnnotation } from '@/store/appStore'
import { HIGHLIGHT_COLORS, type HighlightColor } from './InlineSelectionPopup'

interface Props {
  annotation: InlineAnnotation
  anchorRect: { x: number; y: number; width?: number; height?: number }
  onUpdate: (annotationId: string, noteText: string, color: HighlightColor) => void
  onDelete: (messageId: string, annotationId: string) => void
  onAskAi: (text: string) => void
  onClose: () => void
}

export function NoteViewPopover({
  annotation,
  anchorRect,
  onUpdate,
  onDelete,
  onAskAi,
  onClose,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState(annotation.note || '')
  const [editedColor, setEditedColor] = useState<HighlightColor>(
    (annotation.color as HighlightColor) || 'yellow'
  )
  const [mounted, setMounted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [isEditing])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) setIsEditing(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, onClose])

  if (!mounted) return null

  // Calculate popover coordinates so it appears anchored to the clicked word
  const popoverWidth = 340
  const padding = 16
  let left = anchorRect.x + (anchorRect.width || 0) / 2 - popoverWidth / 2
  if (left < padding) left = padding
  if (left + popoverWidth > window.innerWidth - padding) {
    left = window.innerWidth - popoverWidth - padding
  }

  let top = anchorRect.y + (anchorRect.height || 24) + 8
  // If too close to bottom of window, show above
  if (top + 260 > window.innerHeight) {
    top = Math.max(padding, anchorRect.y - 240)
  }

  const currentColorInfo = HIGHLIGHT_COLORS.find((c) => c.id === (annotation.color || 'yellow')) || HIGHLIGHT_COLORS[0]
  const editingColorInfo = HIGHLIGHT_COLORS.find((c) => c.id === editedColor) || HIGHLIGHT_COLORS[0]

  const formattedDate = annotation.created_at
    ? new Date(annotation.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  const handleSaveEdit = () => {
    onUpdate(annotation.id, editedText.trim(), editedColor)
    setIsEditing(false)
  }

  const handleDelete = () => {
    onDelete(annotation.message_id, annotation.id)
    onClose()
  }

  return createPortal(
    <>
      <div className="note-popover-backdrop" onClick={onClose} />
      <div
        className="note-popover-card glass-modal"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isEditing ? (
          <>
            {/* Header */}
            <div className="note-popover-header">
              <div className="note-popover-title-row">
                <span
                  className="note-color-badge-dot"
                  style={{ backgroundColor: currentColorInfo.hex }}
                />
                <span className="note-popover-word-title" title={annotation.selected_text}>
                  &ldquo;{annotation.selected_text}&rdquo;
                </span>
              </div>
              <button
                type="button"
                className="note-popover-close-btn"
                onClick={onClose}
                title="Close"
              >
                <X size={14} />
              </button>
            </div>

            {/* Note Body */}
            <div
              className="note-popover-body"
              style={{
                borderLeft: `3px solid ${currentColorInfo.border}`,
                backgroundColor: currentColorInfo.bg,
              }}
            >
              {annotation.note ? (
                <p className="note-popover-text">{annotation.note}</p>
              ) : (
                <p className="note-popover-text-placeholder">(No note text attached &mdash; click Edit to add your thoughts)</p>
              )}
            </div>

            {/* Meta row */}
            <div className="note-popover-meta">
              {formattedDate && (
                <div className="note-meta-date">
                  <Clock size={11} />
                  <span>{formattedDate}</span>
                </div>
              )}
              <span className="note-meta-color-label" style={{ color: currentColorInfo.border }}>
                {currentColorInfo.label} highlight
              </span>
            </div>

            {/* Action Buttons */}
            <div className="note-popover-actions">
              <button
                type="button"
                className="note-btn-danger"
                onClick={handleDelete}
                title="Delete this note and remove highlight"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>

              <div className="note-actions-right">
                <button
                  type="button"
                  className="note-btn-secondary"
                  onClick={() => {
                    onAskAi(annotation.selected_text)
                    onClose()
                  }}
                  title="Ask AI about this highlighted text"
                >
                  <MessageSquarePlus size={13} />
                  <span>Ask AI</span>
                </button>

                <button
                  type="button"
                  className="note-btn-primary"
                  onClick={() => setIsEditing(true)}
                  title="Edit note"
                >
                  <Edit3 size={13} />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Edit Mode */
          <div className="note-popover-edit-mode">
            <div className="note-popover-header">
              <div className="note-popover-title-row">
                <Edit3 size={14} style={{ color: editingColorInfo.border }} />
                <span className="note-popover-word-title">Edit Note</span>
              </div>
              <button
                type="button"
                className="note-popover-close-btn"
                onClick={() => setIsEditing(false)}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className="selection-note-textarea"
              rows={3}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder="Edit your note... (⌘+Enter to save)"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveEdit()
                }
              }}
            />

            <div className="selection-note-toolbar">
              <div className="selection-note-colors" title="Change highlight color">
                <Palette size={13} className="text-secondary" />
                {HIGHLIGHT_COLORS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    className={`selection-color-dot ${editedColor === col.id ? 'active' : ''}`}
                    style={{ backgroundColor: col.hex }}
                    onClick={() => setEditedColor(col.id)}
                    title={col.label}
                  >
                    {editedColor === col.id && <Check size={10} className="check-icon" />}
                  </button>
                ))}
              </div>

              <div className="selection-note-actions">
                <button
                  type="button"
                  className="selection-note-cancel"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="selection-note-save"
                  onClick={handleSaveEdit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

