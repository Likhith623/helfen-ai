import { supabase } from '@/lib/supabase'

export interface RagChunk {
  id: string
  documentId: string
  documentName: string
  chunkIndex: number
  content: string
  tokenCount: number
  score: number
  matchedTerms?: string[]
  embedding?: number[]
}

export interface IndexedDocument {
  id: string
  name: string
  fileType: string
  size: number
  totalChunks: number
  chunks: RagChunk[]
  indexedAt: string
}

const STOP_WORDS = new Set([
  'the', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'with', 'on', 'at',
  'from', 'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over',
  'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose',
  'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more'
])

/**
 * Tokenize text into normalized searchable terms
 */
export function tokenize(text: string): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
}

/**
 * Intelligent semantic chunking with paragraph preservation & sliding-window overlap
 */
export function chunkText(
  documentId: string,
  documentName: string,
  text: string,
  targetChunkSize = 650,
  overlap = 120
): RagChunk[] {
  if (!text || !text.trim()) return []

  const normalized = text.replace(/\r\n/g, '\n')
  // Split on double line breaks (paragraphs) or markdown headers
  const paragraphs = normalized.split(/\n\n+/)

  const chunks: RagChunk[] = []
  let currentChunk = ''
  let chunkIndex = 0

  for (const para of paragraphs) {
    const cleanPara = para.trim()
    if (!cleanPara) continue

    if (currentChunk.length + cleanPara.length <= targetChunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${cleanPara}` : cleanPara
    } else {
      if (currentChunk) {
        const words = currentChunk.split(/\s+/).filter(Boolean).length
        chunks.push({
          id: `${documentId}-chunk-${chunkIndex}`,
          documentId,
          documentName,
          chunkIndex,
          content: currentChunk,
          tokenCount: Math.round(words * 1.3),
          score: 0,
          embedding: generateLightweightEmbedding(currentChunk)
        })
        chunkIndex++

        // Sliding-window overlap
        if (overlap > 0 && currentChunk.length > overlap) {
          const tail = currentChunk.slice(currentChunk.length - overlap)
          currentChunk = `${tail}\n\n${cleanPara}`
        } else {
          currentChunk = cleanPara
        }
      } else {
        // Para itself is huge, slice by character boundary
        let start = 0
        while (start < cleanPara.length) {
          const end = Math.min(start + targetChunkSize, cleanPara.length)
          const slice = cleanPara.slice(start, end)
          const words = slice.split(/\s+/).filter(Boolean).length
          chunks.push({
            id: `${documentId}-chunk-${chunkIndex}`,
            documentId,
            documentName,
            chunkIndex,
            content: slice,
            tokenCount: Math.round(words * 1.3),
            score: 0,
            embedding: generateLightweightEmbedding(slice)
          })
          chunkIndex++
          start += targetChunkSize - overlap
          if (start >= cleanPara.length) break
        }
        currentChunk = ''
      }
    }
  }

  if (currentChunk.trim()) {
    const words = currentChunk.split(/\s+/).filter(Boolean).length
    chunks.push({
      id: `${documentId}-chunk-${chunkIndex}`,
      documentId,
      documentName,
      chunkIndex,
      content: currentChunk,
      tokenCount: Math.round(words * 1.3),
      score: 0,
      embedding: generateLightweightEmbedding(currentChunk)
    })
  }

  return chunks
}

/**
 * Lightweight, zero-dependency high-dimensional vector hashing embedding (64 dimensions)
 * Computes unit-normalized semantic term frequency projections
 */
export function generateLightweightEmbedding(text: string, dimensions = 64): number[] {
  const vector = new Array(dimensions).fill(0)
  const tokens = tokenize(text)
  if (tokens.length === 0) return vector

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    let hash = 0
    for (let j = 0; j < token.length; j++) {
      hash = (hash << 5) - hash + token.charCodeAt(j)
      hash |= 0
    }
    const idx = Math.abs(hash) % dimensions
    vector[idx] += 1.0

    // Bi-gram hashing
    if (i < tokens.length - 1) {
      const bi = token + '_' + tokens[i + 1]
      let biHash = 0
      for (let j = 0; j < bi.length; j++) {
        biHash = (biHash << 5) - biHash + bi.charCodeAt(j)
        biHash |= 0
      }
      const biIdx = Math.abs(biHash) % dimensions
      vector[biIdx] += 0.5
    }
  }

  // Unit vector normalization
  let norm = 0
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i]
  }
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm
    }
  }

  return vector
}

/**
 * Cosine similarity between two normalized vectors
 */
export function computeCosineSimilarity(v1: number[], v2: number[]): number {
  if (!v1 || !v2 || v1.length !== v2.length || v1.length === 0) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i]
    normA += v1[i] * v1[i]
    normB += v2[i] * v2[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : Math.max(0, dotProduct / denom)
}

/**
 * BM25 sparse keyword ranking
 */
export function computeBm25(
  queryTokens: string[],
  chunk: RagChunk,
  allChunks: RagChunk[]
): { score: number; matchedTerms: string[] } {
  if (queryTokens.length === 0) return { score: 0, matchedTerms: [] }

  const chunkTokens = tokenize(chunk.content)
  const termFreq: Record<string, number> = {}
  for (const t of chunkTokens) {
    termFreq[t] = (termFreq[t] || 0) + 1
  }

  const matchedTerms: string[] = []
  let bm25Score = 0
  const k1 = 1.2
  const b = 0.75
  const docLen = chunkTokens.length
  const avgDocLen = 80 // estimated average chunk length
  const N = allChunks.length || 1

  for (const qt of queryTokens) {
    const tf = termFreq[qt] || 0
    if (tf > 0) {
      matchedTerms.push(qt)
      // Estimate doc frequency
      const df = allChunks.filter((c) => c.content.toLowerCase().includes(qt)).length || 1
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
      const numerator = tf * (k1 + 1)
      const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen))
      bm25Score += idf * (numerator / denominator)
    }
  }

  const normalized = Math.min(1.0, bm25Score / Math.max(1, queryTokens.length * 2.2))
  return { score: normalized, matchedTerms }
}

/**
 * Hybrid Semantic + BM25 Top-K Retrieval
 */
export function searchRagChunks(
  query: string,
  chunks: RagChunk[],
  topK = 4,
  threshold = 0.08
): RagChunk[] {
  if (!query || !query.trim() || !chunks || chunks.length === 0) {
    return []
  }

  const queryTokens = tokenize(query)
  const queryEmbedding = generateLightweightEmbedding(query)
  const queryLower = query.toLowerCase().trim()

  const scoredChunks: RagChunk[] = []

  for (const chunk of chunks) {
    // 1. Vector Cosine Similarity
    const chunkEmb = chunk.embedding || generateLightweightEmbedding(chunk.content)
    const vectorScore = computeCosineSimilarity(queryEmbedding, chunkEmb)

    // 2. BM25 Keyword Matching
    const { score: bm25Score, matchedTerms } = computeBm25(queryTokens, chunk, chunks)

    // 3. Exact Substring Boost
    const substringBoost = chunk.content.toLowerCase().includes(queryLower) ? 0.3 : 0

    // Hybrid formula: 55% dense semantic vector + 45% sparse BM25 + phrase boost
    const hybridScore = Math.min(1.0, 0.55 * vectorScore + 0.45 * bm25Score + substringBoost)

    if (hybridScore >= threshold) {
      scoredChunks.push({
        ...chunk,
        score: Math.round(hybridScore * 1000) / 1000,
        matchedTerms
      })
    }
  }

  // Sort descending by relevance score
  scoredChunks.sort((a, b) => b.score - a.score)
  return scoredChunks.slice(0, topK)
}

/**
 * Formats grounded context for injection into LLM system prompt
 */
export function formatRagSystemPrompt(retrievedChunks: RagChunk[]): string {
  if (!retrievedChunks || retrievedChunks.length === 0) return ''

  const lines: string[] = [
    '--- BEGIN GROUNDED KNOWLEDGE BASE CONTEXT (RAG) ---',
    'The following verified excerpts were retrieved from the user\'s uploaded knowledge documents based on their query.',
    'You must ground your answers directly in these excerpts. When citing facts, reference the source by name and chunk (e.g. `[Doc: filename (Chunk #N)]`).',
    ''
  ]

  retrievedChunks.forEach((chunk, i) => {
    const pct = Math.round(chunk.score * 100)
    lines.push(`### [Source ${i + 1}: "${chunk.documentName}" | Chunk #${chunk.chunkIndex + 1} | Relevance: ${pct}%]`)
    lines.push(chunk.content.trim())
    lines.push('')
  })

  lines.push('--- END GROUNDED KNOWLEDGE BASE CONTEXT ---')
  return lines.join('\n')
}

/**
 * Sync indexed document to Supabase with graceful fallback
 */
export async function syncDocumentToSupabase(doc: IndexedDocument): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: docData, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        id: doc.id,
        user_id: user.id,
        name: doc.name,
        file_type: doc.fileType,
        file_size: doc.size,
        total_chunks: doc.totalChunks,
        token_count: doc.chunks.reduce((sum, c) => sum + c.tokenCount, 0),
        metadata: { indexedAt: doc.indexedAt }
      })
      .select()
      .single()

    if (docError || !docData) {
      console.warn('Supabase knowledge_documents table not available:', docError?.message)
      return false
    }

    // Insert chunks in batch
    const chunkPayloads = doc.chunks.map((c) => ({
      id: crypto.randomUUID(),
      document_id: doc.id,
      user_id: user.id,
      chunk_index: c.chunkIndex,
      content: c.content,
      token_count: c.tokenCount,
      embedding: c.embedding || null
    }))

    const { error: chunkError } = await supabase
      .from('document_chunks')
      .insert(chunkPayloads)

    if (chunkError) {
      console.warn('Failed to insert document chunks:', chunkError.message)
    }

    return true
  } catch (err) {
    console.error('Error syncing document to Supabase:', err)
    return false
  }
}
