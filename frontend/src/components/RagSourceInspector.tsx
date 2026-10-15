'use client'

import { useState } from 'react'
import {
  X, BookOpen, ExternalLink, Copy, Check, FileText,
  Search, Sparkles, Layers, ShieldCheck, ChevronRight
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatFileSize } from '@/lib/fileProcessor'
import toast from 'react-hot-toast'

export function RagSourceInspector() {
  const { inspectingChunks, inspectingMessageId, closeRagInspector } = useAppStore()
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [searchFilter, setSearchFilter] = useState('')

  if (!inspectingChunks || inspectingChunks.length === 0) return null

  const filteredChunks = inspectingChunks.filter(
    (c) =>
      c.documentName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.content.toLowerCase().includes(searchFilter.toLowerCase())
  )

  const maxScore = Math.max(...inspectingChunks.map((c) => c.score || 0))
  const highestMatchPct = Math.round(maxScore * 100)

  async function handleCopyChunk(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      toast.success('Excerpt copied to clipboard', { duration: 1800 })
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div className="rag-inspector-backdrop" onClick={closeRagInspector}>
      <div
        className="rag-inspector-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="rag-inspector-header">
          <div className="rag-inspector-header-left">
            <div className="rag-inspector-icon">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="rag-inspector-title">
                <span>Grounded Knowledge Sources</span>
                <span className="rag-match-pill">{highestMatchPct}% Top Match</span>
              </div>
              <p className="rag-inspector-subtitle">
                {inspectingChunks.length} verified excerpt{inspectingChunks.length > 1 ? 's' : ''} retrieved from your documents to ground this answer
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeRagInspector}
            title="Close inspector"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search bar inside inspector if multiple chunks */}
        {inspectingChunks.length > 2 && (
          <div className="rag-inspector-search-row">
            <Search size={14} className="rag-search-icon" />
            <input
              type="text"
              placeholder="Filter retrieved excerpts..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="rag-search-input"
            />
            {searchFilter && (
              <button
                type="button"
                className="rag-clear-btn"
                onClick={() => setSearchFilter('')}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Chunks List */}
        <div className="rag-inspector-body">
          {filteredChunks.map((chunk, index) => {
            const scorePct = Math.round(chunk.score * 100)
            const isTop = index === 0

            return (
              <div
                key={chunk.id || index}
                className={`rag-chunk-card ${isTop ? 'top-match' : ''}`}
              >
                <div className="rag-chunk-header">
                  <div className="rag-chunk-meta">
                    <span className="rag-chunk-source">
                      <FileText size={13} />
                      <strong title={chunk.documentName}>{chunk.documentName}</strong>
                    </span>
                    <span className="rag-chunk-index">
                      Chunk #{chunk.chunkIndex + 1}
                    </span>
                    {isTop && (
                      <span className="rag-top-badge">
                        <Sparkles size={11} /> Top Rank
                      </span>
                    )}
                  </div>

                  <div className="rag-chunk-actions">
                    <div className="rag-score-meter">
                      <div className="rag-score-label">
                        <span>Relevance</span>
                        <strong>{scorePct}%</strong>
                      </div>
                      <div className="rag-score-bar-bg">
                        <div
                          className="rag-score-bar-fill"
                          style={{
                            width: `${Math.min(100, Math.max(10, scorePct))}%`,
                            background:
                              scorePct >= 80
                                ? 'linear-gradient(90deg, #34a853, #4285f4)'
                                : scorePct >= 50
                                ? 'linear-gradient(90deg, #fbbc05, #ff6d00)'
                                : 'var(--border-strong)'
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rag-copy-btn"
                      onClick={() => handleCopyChunk(chunk.content, index)}
                      title="Copy excerpt"
                    >
                      {copiedIndex === index ? <Check size={13} className="text-green" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Matched keywords if available */}
                {chunk.matchedTerms && chunk.matchedTerms.length > 0 && (
                  <div className="rag-terms-row">
                    <span className="rag-terms-label">Keywords:</span>
                    {chunk.matchedTerms.slice(0, 5).map((term, tIdx) => (
                      <span key={tIdx} className="rag-term-tag">
                        {term}
                      </span>
                    ))}
                  </div>
                )}

                {/* Excerpt Content */}
                <div className="rag-chunk-content">
                  <pre>{chunk.content}</pre>
                </div>

                <div className="rag-chunk-footer">
                  <span>~{chunk.tokenCount} tokens</span>
                  <span>•</span>
                  <span>{chunk.content.length} characters</span>
                </div>
              </div>
            )
          })}

          {filteredChunks.length === 0 && (
            <div className="rag-empty-state">
              <Search size={28} />
              <p>No excerpts matched &ldquo;{searchFilter}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="rag-inspector-footer">
          <div className="rag-footer-info">
            <ShieldCheck size={15} className="text-green" />
            <span>Strict Hallucination Prevention • Response grounded directly in excerpts</span>
          </div>
        </div>
      </div>
    </div>
  )
}
