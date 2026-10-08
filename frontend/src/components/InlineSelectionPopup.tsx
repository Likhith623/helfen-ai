'use client'

import { useEffect, useState } from 'react'
import { MessageSquarePlus, BookOpen, ExternalLink, X } from 'lucide-react'

interface Props {
  x: number
  y: number
  text: string
  onAsk: () => void
  onClose: () => void
}

export function InlineSelectionPopup({ x, y, text, onAsk, onClose }: Props) {
  const [position, setPosition] = useState({ x, y })

  useEffect(() => {
    // Adjust position to stay within viewport
    const popupWidth = 280
    const padding = 20
    let adjX = x - popupWidth / 2
    let adjY = y - 60

    if (adjX < padding) adjX = padding
    if (adjX + popupWidth > window.innerWidth - padding) {
      adjX = window.innerWidth - popupWidth - padding
    }
    if (adjY < padding) adjY = y + 30 // Show below if no space above

    setPosition({ x: adjX, y: adjY })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [x, y, onClose])

  return (
    <>
      <div 
        style={{
          position: 'fixed', inset: 0, zIndex: 999, cursor: 'default'
        }}
        onClick={onClose}
      />
      <div
        className="selection-popup"
        style={{
          left: position.x,
          top: position.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="selection-popup-btn primary" onClick={onAsk}>
          <MessageSquarePlus size={14} />
          Ask about this
        </button>
        <button className="selection-popup-btn secondary" onClick={() => {
            window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank')
            onClose()
        }}>
          <BookOpen size={14} />
          Search
        </button>
      </div>
    </>
  )
}
