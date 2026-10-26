/**
 * Chat Context & Referencing Service for Helfen AI
 * Handles natural language intent detection, fuzzy conversation matching,
 * and deep analytical summary generation & caching.
 */

import { supabase } from '@/lib/supabase'
import { generateDeepChatSummary, type ChatSummaryResult } from '@/lib/geminiService'
import type { Conversation } from '@/store/appStore'

export interface DetectedContextCommand {
  isContextCommand: boolean
  chatNameQuery: string
  remainingPrompt: string
  hasFollowUpQuestion: boolean
  fullMatchedPattern?: string
}

export interface ResolvedContext {
  conversationId: string
  title: string
  summaryResult: ChatSummaryResult
  formattedContext: string
  messageCount: number
}

/**
 * Natural language patterns for identifying context linking requests
 */
const CONTEXT_PATTERNS: Array<{
  regex: RegExp
  extract: (match: RegExpMatchArray, original: string) => { chatName: string; remaining: string }
}> = [
  // 1. "i want you to have a context of 'chat name'[, now ...]"
  {
    regex: /(?:i\s+want\s+you\s+to\s+have|please\s+have|have|take|use|include|load)\s+(?:a\s+|the\s+)?context\s+(?:of|from)\s+["“'‘]([^"”'’]+)["”'’](?:\s*[,;.]?\s*(.*))?$/i,
    extract: (m) => ({ chatName: m[1].trim(), remaining: (m[2] || '').trim() })
  },
  // 2. "with context of 'chat name'[, ...]"
  {
    regex: /(?:with|reference|refer\s+to)\s+(?:the\s+)?context\s+(?:of|from)\s+["“'‘]([^"”'’]+)["”'’](?:\s*[,;.]?\s*(.*))?$/i,
    extract: (m) => ({ chatName: m[1].trim(), remaining: (m[2] || '').trim() })
  },
  // 3. Slash command: "/context [chat name]"
  {
    regex: /^\/context\s+["“'‘]?([^"”'’\n,]+)["”'’]?(?:\s*[,;.]?\s*(.*))?$/i,
    extract: (m) => ({ chatName: m[1].trim(), remaining: (m[2] || '').trim() })
  },
  // 4. "@context 'chat name' [...]"
  {
    regex: /^@context\s+["“'‘]?([^"”'’\n,]+)["”'’]?(?:\s*[,;.]?\s*(.*))?$/i,
    extract: (m) => ({ chatName: m[1].trim(), remaining: (m[2] || '').trim() })
  },
  // 5. Unquoted variations: "i want you to have a context of chat name"
  {
    regex: /(?:i\s+want\s+you\s+to\s+have|please\s+have|have|take|use|include|load)\s+(?:a\s+|the\s+)?context\s+(?:of|from)\s+(?:the\s+chat\s+|chat\s+)?([^,\n.?!]+)(?:[,\n.?!]\s*(.*))?$/i,
    extract: (m) => ({ chatName: m[1].trim(), remaining: (m[2] || '').trim() })
  }
]

/**
 * Detects whether the user's input is requesting context from another chat
 */
export function detectContextCommand(input: string): DetectedContextCommand {
  const trimmed = input.trim()
  if (!trimmed) {
    return { isContextCommand: false, chatNameQuery: '', remainingPrompt: '', hasFollowUpQuestion: false }
  }

  for (const pattern of CONTEXT_PATTERNS) {
    const match = trimmed.match(pattern.regex)
    if (match) {
      const { chatName, remaining } = pattern.extract(match, trimmed)
      // Clean chatName from quotes or trailing punctuation
      const cleanChatName = chatName.replace(/^["“'‘]+|["”'’]+$/g, '').trim()
      if (cleanChatName.length >= 2) {
        return {
          isContextCommand: true,
          chatNameQuery: cleanChatName,
          remainingPrompt: remaining,
          hasFollowUpQuestion: remaining.length > 0,
          fullMatchedPattern: match[0]
        }
      }
    }
  }

  return { isContextCommand: false, chatNameQuery: '', remainingPrompt: '', hasFollowUpQuestion: false }
}

/**
 * Normalizes text for lenient fuzzy comparisons
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Finds the closest matching conversation from the user's list or database
 */
export async function findConversationByTitle(
  query: string,
  localConversations: Conversation[] = []
): Promise<Conversation | null> {
  const cleanQuery = query.trim()
  if (!cleanQuery) return null

  const normQuery = normalizeText(cleanQuery)
  const queryTokens = new Set(normQuery.split(' ').filter((t) => t.length > 2))

  // 1. Exact match in local conversations (case-insensitive)
  const exact = localConversations.find(
    (c) => !c.is_archived && c.title.toLowerCase() === cleanQuery.toLowerCase()
  )
  if (exact) return exact

  // 2. Normalized match (punctuation stripped)
  const normalizedMatch = localConversations.find(
    (c) => !c.is_archived && normalizeText(c.title) === normQuery
  )
  if (normalizedMatch) return normalizedMatch

  // 3. Substring match
  const substringMatch = localConversations.find(
    (c) =>
      !c.is_archived &&
      (c.title.toLowerCase().includes(cleanQuery.toLowerCase()) ||
        cleanQuery.toLowerCase().includes(c.title.toLowerCase()))
  )
  if (substringMatch) return substringMatch

  // 4. Token overlap scoring
  let bestConv: Conversation | null = null
  let maxScore = 0

  for (const c of localConversations) {
    if (c.is_archived) continue
    const cTokens = normalizeText(c.title).split(' ').filter((t) => t.length > 2)
    let overlap = 0
    for (const t of cTokens) {
      if (queryTokens.has(t)) overlap++
    }
    const score = queryTokens.size > 0 ? overlap / queryTokens.size : 0
    if (score > maxScore && score >= 0.4) {
      maxScore = score
      bestConv = c
    }
  }

  if (bestConv) return bestConv

  // 5. Fallback: Search directly in Supabase for user's conversations
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .ilike('title', `%${cleanQuery}%`)
        .limit(1)

      if (data && data.length > 0) {
        return data[0] as Conversation
      }
    }
  } catch (err) {
    console.warn('Supabase remote conversation search fallback error:', err)
  }

  return null
}

/**
 * Resolves a chat's context and generates "summary or more than a summary"
 * Caches the result in Supabase and returns the structured context.
 */
export async function resolveChatContextAndSummary(
  conversationId: string,
  providedTitle?: string
): Promise<ResolvedContext> {
  // 1. Fetch title and messages from Supabase
  let title = providedTitle || 'Previous Chat'
  let messages: Array<{ role: string; content: string; created_at: string }> = []
  let existingSummary: string | null = null

  try {
    const [convRes, msgsRes] = await Promise.all([
      supabase.from('conversations').select('title, summary, summary_metadata').eq('id', conversationId).single(),
      supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(60)
    ])

    if (convRes.data?.title) title = convRes.data.title
    if (convRes.data?.summary) existingSummary = convRes.data.summary
    if (msgsRes.data) messages = msgsRes.data as any
  } catch (err) {
    console.warn('Failed to load conversation from Supabase:', err)
  }

  // 2. Check for cached deep summary in conversation_summaries table
  let summaryResult: ChatSummaryResult | null = null
  try {
    const { data: cachedSummary } = await supabase
      .from('conversation_summaries')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cachedSummary && cachedSummary.summary) {
      summaryResult = {
        title,
        executiveSummary: cachedSummary.executive_summary || cachedSummary.summary.slice(0, 300),
        keyDecisions: cachedSummary.key_decisions || [],
        salientTopics: cachedSummary.salient_topics || [],
        unresolvedItems: cachedSummary.unresolved_items || [],
        fullStructuredSummary: cachedSummary.summary,
        modelUsed: cachedSummary.model_used || 'cached',
        messageCount: cachedSummary.message_count || messages.length
      }
    }
  } catch {
    // Cached record not found or table not yet created
  }

  // 3. Generate summary if not yet cached
  if (!summaryResult) {
    if (existingSummary) {
      summaryResult = {
        title,
        executiveSummary: existingSummary.slice(0, 300),
        keyDecisions: [],
        salientTopics: [],
        unresolvedItems: [],
        fullStructuredSummary: existingSummary,
        modelUsed: 'database-column',
        messageCount: messages.length
      }
    } else {
      summaryResult = await generateDeepChatSummary(title, messages)

      // 4. Asynchronously persist the generated summary to Supabase
      saveSummaryToSupabase(conversationId, title, summaryResult, messages.length).catch((e) =>
        console.warn('Failed to cache summary in Supabase:', e)
      )
    }
  }

  // 5. Build rich injected context format for the LLM
  const formattedContext = formatContextBlock(title, summaryResult, messages)

  return {
    conversationId,
    title,
    summaryResult,
    formattedContext,
    messageCount: messages.length
  }
}

/**
 * Builds the comprehensive LLM prompt context block
 */
function formatContextBlock(
  title: string,
  summary: ChatSummaryResult,
  messages: Array<{ role: string; content: string }>
): string {
  const parts: string[] = [
    `=== REFERENCED CHAT CONTEXT: "${title}" ===`,
    `The user has explicitly instructed you to load and ground your thoughts in the context of their previous chat "${title}".`,
    `Below is the complete analytical summary, key decisions, technical parameters, and dialogue turning points established in that chat:`,
    '',
    summary.fullStructuredSummary,
    ''
  ]

  // Add the most recent salient turns for maximum accuracy
  if (messages.length > 0) {
    const recent = messages.slice(-10)
    parts.push(
      `--- RECENT VERBATIM EXCERPTS FROM "${title}" (Last ${recent.length} messages) ---`
    )
    for (const m of recent) {
      const role = m.role === 'user' ? 'User' : 'Assistant'
      const truncated = m.content.length > 500 ? m.content.slice(0, 500) + '...' : m.content
      parts.push(`[${role}]: ${truncated}`)
    }
    parts.push('--- END VERBATIM EXCERPTS ---')
  }

  parts.push(
    `=== END REFERENCED CONTEXT ===`,
    `GROUNDING INSTRUCTIONS:`,
    `- Acknowledge that you have full context of "${title}".`,
    `- Use the decisions, technical parameters, and facts established in "${title}" to seamlessly answer the user's questions without asking them to repeat themselves.`,
    `- Maintain complete continuity with the tone, goals, and standards agreed upon in that previous chat.`
  )

  return parts.join('\n')
}

/**
 * Persists the deep summary to Supabase for instant re-use
 */
async function saveSummaryToSupabase(
  conversationId: string,
  title: string,
  summary: ChatSummaryResult,
  messageCount: number
) {
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Try updating conversations table with summary
  await supabase
    .from('conversations')
    .update({
      summary: summary.fullStructuredSummary,
      summary_metadata: {
        executive_summary: summary.executiveSummary,
        key_decisions: summary.keyDecisions,
        salient_topics: summary.salientTopics,
        unresolved_items: summary.unresolvedItems,
        message_count: messageCount,
        model_used: summary.modelUsed,
        generated_at: new Date().toISOString()
      }
    })
    .eq('id', conversationId)

  // 2. Try inserting into conversation_summaries table
  if (user) {
    await supabase.from('conversation_summaries').insert({
      conversation_id: conversationId,
      user_id: user.id,
      title,
      summary: summary.fullStructuredSummary,
      executive_summary: summary.executiveSummary,
      key_decisions: summary.keyDecisions,
      salient_topics: summary.salientTopics,
      unresolved_items: summary.unresolvedItems,
      message_count: messageCount,
      model_used: summary.modelUsed
    })
  }
}

/**
 * Persists the referenced conversation context onto the current active conversation
 */
export async function saveReferencedContextToConversation(
  currentConversationId: string,
  referencedConversationId: string,
  referencedTitle: string,
  summaryText: string
) {
  try {
    await supabase
      .from('conversations')
      .update({
        parent_conversation_id: referencedConversationId,
        referenced_conversation_id: referencedConversationId,
        referenced_context_title: referencedTitle,
        referenced_context_summary: summaryText
      })
      .eq('id', currentConversationId)
  } catch (err) {
    console.warn('Failed to persist referenced context onto conversation record:', err)
  }
}
