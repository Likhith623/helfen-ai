'use client'

import { useEffect, useState, useRef } from 'react'
import { MessageSquarePlus, BookOpen, StickyNote, X, Check, Sparkles } from 'lucide-react'

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'purple' | 'pink'

export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; hex: string; bg: string; border: string }[] = [
  { id: 'yellow', label: 'Yellow', hex: '#facc15', bg: 'rgba(250, 204, 21, 0.28)', border: '#eab308' },
  { id: 'green', label: 'Green', hex: '#4ade80', bg: 'rgba(74, 222, 128, 0.25)', border: '#22c55e' },
  { id: 'blue', label: 'Blue', hex: '#60a5fa', bg: 'rgba(96, 165, 250, 0.25)', border: '#3b82f6' },
  { id: 'purple', label: 'Purple', hex: '#c084fc', bg: 'rgba(192, 132, 252, 0.25)', border: '#a855f7' },
  { id: 'pink', label: 'Pink', hex: '#fb7185', bg: 'rgba(251, 113, 133, 0.25)', border: '#f43f5e' },
]

interface Props {
  x: number
  y: number
  text: string
  onAsk: () => void
  onTakeNote: (noteText: string, color: HighlightColor) => void
  onClose: () => void
}

export function InlineSelectionPopup({ x, y, text, onAsk, onTakeNote, onClose }: Props) {
  const [position, setPosition] = useState({ x, y })
  const [isTakingNote, setIsTakingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Adjust position to stay within viewport
    const popupWidth = isTakingNote ? 330 : 360
    const padding = 20
    let adjX = x - popupWidth / 2
    let adjY = isTakingNote ? y - 180 : y - 60

    if (adjX < padding) adjX = padding
    if (adjX + popupWidth > window.innerWidth - padding) {
      adjX = window.innerWidth - popupWidth - padding
    }
    if (adjY < padding) adjY = y + 30 // Show below if no space above

    setPosition({ x: adjX, y: adjY })
  }, [x, y, isTakingNote])

  useEffect(() => {
    if (isTakingNote) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [isTakingNote])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTakingNote) {
          setIsTakingNote(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isTakingNote, onClose])

  const handleSaveNote = () => {
    onTakeNote(noteText.trim(), selectedColor)
  }

  const truncatedWord = text.length > 28 ? text.slice(0, 25) + '...' : text

  return (
    <>
      <div 
        style={{
          position: 'fixed', inset: 0, zIndex: 999, cursor: 'default'
        }}
        onClick={onClose}
      />
      <div
        className={`selection-popup ${isTakingNote ? 'note-mode' : ''}`}
        style={{
          left: position.x,
          top: position.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isTakingNote ? (
          <>
            <button className="selection-popup-btn primary" onClick={onAsk} title="Ask AI about this text">
              <MessageSquarePlus size={14} />
              <span>Ask about this</span>
            </button>

            <button
              className="selection-popup-btn note-btn"
              onClick={() => setIsTakingNote(true)}
              title="Add a note and highlight this word"
            >
              <StickyNote size={14} className="text-yellow-400" />
              <span>Take Note</span>
            </button>

            <button
              className="selection-popup-btn secondary"
              onClick={() => {
                window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank')
                onClose()
              }}
              title="Search Google"
            >
              <BookOpen size={14} />
              <span>Search</span>
            </button>
          </>
        ) : (
          <div className="selection-note-card">
            <div className="selection-note-header">
              <div className="selection-note-title-wrap">
                <StickyNote size={14} style={{ color: HIGHLIGHT_COLORS.find(c => c.id === selectedColor)?.border }} />
                <span className="selection-note-title">
                  Note on <strong>&ldquo;{truncatedWord}&rdquo;</strong>
                </span>
              </div>
              <button
                type="button"
                className="selection-note-close"
                onClick={() => setIsTakingNote(false)}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className="selection-note-textarea"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your note here... (Press ⌘+Enter to save)"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveNote()
                }
              }}
            />

            <div className="selection-note-toolbar">
              <div className="selection-note-colors" title="Choose highlight marker color">
                <span className="selection-color-label">Color:</span>
                {HIGHLIGHT_COLORS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    className={`selection-color-dot ${selectedColor === col.id ? 'active' : ''}`}
                    style={{ backgroundColor: col.hex }}
                    onClick={() => setSelectedColor(col.id)}
                    title={col.label}
                  >
                    {selectedColor === col.id && <Check size={10} className="check-icon" />}
                  </button>
                ))}
              </div>

              <div className="selection-note-actions">
                <button
                  type="button"
                  className="selection-note-cancel"
                  onClick={() => setIsTakingNote(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="selection-note-save"
                  onClick={handleSaveNote}
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
