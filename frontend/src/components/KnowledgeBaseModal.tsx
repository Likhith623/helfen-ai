'use client'

import { useState, useRef } from 'react'
import {
  X, Database, UploadCloud, Trash2, Search, FileText,
  Code2, Check, Sparkles, Layers, Sliders, AlertCircle
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatFileSize, processUploadedFile } from '@/lib/fileProcessor'
import { chunkText, searchRagChunks, syncDocumentToSupabase, type IndexedDocument } from '@/lib/ragEngine'
import toast from 'react-hot-toast'

export function KnowledgeBaseModal() {
  const {
    isKnowledgeBaseOpen, setIsKnowledgeBaseOpen,
    knowledgeDocuments, addKnowledgeDocument, removeKnowledgeDocument, clearKnowledgeBase,
    ragModeEnabled, toggleRagMode
  } = useAppStore()

  const [testQuery, setTestQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isKnowledgeBaseOpen) return null

  // Flatten all chunks across all indexed documents
  const allChunks = knowledgeDocuments.flatMap((doc) => doc.chunks)
  const totalTokens = allChunks.reduce((sum, c) => sum + c.tokenCount, 0)

  // Live test retrieval if testQuery is typed
  const testResults = testQuery.trim()
    ? searchRagChunks(testQuery, allChunks, 3, 0.05)
    : []

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setIsUploading(true)

    for (const file of Array.from(files)) {
      try {
        const att = await processUploadedFile(file)
        if (att.type === 'image') {
          toast.error('Image files are processed by Vision, not text RAG')
          continue
        }

        const textContent = att.text || ''
        if (!textContent.trim()) {
          toast.error(`No readable text found in ${file.name}`)
          continue
        }

        const docId = crypto.randomUUID()
        const chunks = chunkText(docId, file.name, textContent)

        const indexedDoc: IndexedDocument = {
          id: docId,
          name: file.name,
          fileType: att.type,
          size: file.size,
          totalChunks: chunks.length,
          chunks,
          indexedAt: new Date().toISOString()
        }

        addKnowledgeDocument(indexedDoc)
        syncDocumentToSupabase(indexedDoc).catch(console.error)

        toast.success(`Indexed "${file.name}" (${chunks.length} chunks)`)
      } catch (err) {
        console.error('Failed to index file:', err)
        toast.error(`Error indexing ${file.name}`)
      }
    }

    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="kb-modal-backdrop" onClick={() => setIsKnowledgeBaseOpen(false)}>
      <div
        className="kb-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="kb-modal-header">
          <div className="kb-modal-header-left">
            <div className="kb-modal-icon-badge">
              <Database size={18} />
            </div>
            <div>
              <div className="kb-modal-title-row">
                <span className="kb-modal-title">RAG Knowledge Base</span>
                <button
                  type="button"
                  className={`kb-rag-toggle ${ragModeEnabled ? 'active' : ''}`}
                  onClick={toggleRagMode}
                  title="Toggle RAG Retrieval"
                >
                  <span className="kb-toggle-dot" />
                  <span>{ragModeEnabled ? 'RAG Active' : 'RAG Disabled'}</span>
                </button>
              </div>
              <p className="kb-modal-subtitle">
                Index documents, PDFs, and codebases into semantic vector chunks for grounded answers
              </p>
            </div>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setIsKnowledgeBaseOpen(false)}
            title="Close Knowledge Base"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats Row */}
        <div className="kb-stats-row">
          <div className="kb-stat-box">
            <span className="kb-stat-num">{knowledgeDocuments.length}</span>
            <span className="kb-stat-label">Documents</span>
          </div>
          <div className="kb-stat-box">
            <span className="kb-stat-num">{allChunks.length}</span>
            <span className="kb-stat-label">Vector Chunks</span>
          </div>
          <div className="kb-stat-box">
            <span className="kb-stat-num">~{totalTokens.toLocaleString()}</span>
            <span className="kb-stat-label">Total Tokens</span>
          </div>
          <div className="kb-stat-box">
            <span className="kb-stat-num">Hybrid</span>
            <span className="kb-stat-label">Dense + BM25</span>
          </div>
        </div>

        {/* Upload Action */}
        <div className="kb-upload-bar">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.json,.csv,.py,.js,.ts,.tsx,.java,.html,.css,.sql,.sh,.yml,.xml"
            onChange={(e) => handleFileUpload(e.target.files)}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 13 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <UploadCloud size={16} />
            <span>{isUploading ? 'Chunking & Indexing...' : 'Add Documents to Knowledge Base'}</span>
          </button>

          {knowledgeDocuments.length > 0 && (
            <button
              type="button"
              className="kb-clear-btn"
              onClick={() => {
                if (confirm('Clear all indexed documents from this session?')) {
                  clearKnowledgeBase()
                  toast.success('Knowledge base cleared')
                }
              }}
            >
              <Trash2 size={13} />
              <span>Clear Knowledge Base</span>
            </button>
          )}
        </div>

        <div className="kb-modal-body">
          {/* Live Retrieval Tester */}
          {allChunks.length > 0 && (
            <div className="kb-tester-card">
              <div className="kb-tester-header">
                <Sparkles size={14} className="text-blue" />
                <span>Test Live Semantic Retrieval:</span>
              </div>
              <div className="kb-tester-input-wrap">
                <Search size={14} className="kb-tester-icon" />
                <input
                  type="text"
                  placeholder="Type a sample question to see matched chunks & relevance..."
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  className="kb-tester-input"
                />
              </div>

              {testQuery.trim() && (
                <div className="kb-tester-results">
                  {testResults.length > 0 ? (
                    testResults.map((chunk, idx) => (
                      <div key={idx} className="kb-test-chunk">
                        <div className="kb-test-chunk-header">
                          <span><strong>{chunk.documentName}</strong> (Chunk #{chunk.chunkIndex + 1})</span>
                          <span className="kb-match-tag">{Math.round(chunk.score * 100)}% match</span>
                        </div>
                        <p className="kb-test-chunk-text">{chunk.content.slice(0, 180)}…</p>
                      </div>
                    ))
                  ) : (
                    <p className="kb-no-match">No chunks matched this query with sufficient relevance.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Documents List */}
          <div className="kb-docs-list">
            <h4 className="kb-section-heading">Indexed Documents ({knowledgeDocuments.length})</h4>

            {knowledgeDocuments.length === 0 ? (
              <div className="kb-empty-box">
                <Database size={32} />
                <p>No documents indexed yet.</p>
                <span>Upload PDFs, Markdown notes, or source files to ground Helfen AI in your own knowledge.</span>
              </div>
            ) : (
              knowledgeDocuments.map((doc) => (
                <div key={doc.id} className="kb-doc-card">
                  <div className="kb-doc-info">
                    <div className="kb-doc-icon">
                      {doc.fileType === 'code' ? <Code2 size={16} /> : <FileText size={16} />}
                    </div>
                    <div>
                      <div className="kb-doc-name" title={doc.name}>{doc.name}</div>
                      <div className="kb-doc-meta">
                        <span>{formatFileSize(doc.size)}</span>
                        <span>•</span>
                        <span>{doc.totalChunks} chunks</span>
                        <span>•</span>
                        <span>{new Date(doc.indexedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="kb-delete-doc-btn"
                    onClick={() => {
                      removeKnowledgeDocument(doc.id)
                      toast.success(`Removed "${doc.name}"`)
                    }}
                    title="Remove document"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
