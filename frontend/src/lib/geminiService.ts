/**
 * Gemini Service for Helfen AI
 * Handles intelligent analytical summaries, chat context distillation,
 * and conversational generation using Google Gemini.
 */

const GEMINI_API_KEY =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  ''

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash'
]

export interface ChatSummaryResult {
  title: string
  executiveSummary: string
  keyDecisions: string[]
  salientTopics: string[]
  unresolvedItems: string[]
  fullStructuredSummary: string
  modelUsed: string
  messageCount: number
}

/**
 * Calls Gemini with automatic model fallback across candidate models
 */
export async function callGemini(
  prompt: string,
  systemInstruction?: string,
  modelIndex: number = 0
): Promise<string> {
  const model = CANDIDATE_MODELS[modelIndex] || 'gemini-3.5-flash-lite'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

  const body: any = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2500
    }
  }

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      console.warn(`Gemini model ${model} returned error:`, errJson)
      if (modelIndex + 1 < CANDIDATE_MODELS.length) {
        return callGemini(prompt, systemInstruction, modelIndex + 1)
      }
      throw new Error(`Gemini API error: ${res.statusText}`)
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      if (modelIndex + 1 < CANDIDATE_MODELS.length) {
        return callGemini(prompt, systemInstruction, modelIndex + 1)
      }
      throw new Error('Empty response from Gemini')
    }

    return text
  } catch (err) {
    if (modelIndex + 1 < CANDIDATE_MODELS.length) {
      return callGemini(prompt, systemInstruction, modelIndex + 1)
    }
    throw err
  }
}

/**
 * Streams Gemini chat completions in real-time
 */
export async function streamGeminiChat(
  messages: Array<{ role: string; content: string; images?: string[] | null }>,
  systemInstruction: string,
  onChunk: (chunk: string) => void,
  modelIndex: number = 0
): Promise<string> {
  const model = CANDIDATE_MODELS[modelIndex] || 'gemini-3.5-flash-lite'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`

  // Format messages for Gemini API
  const contents = messages
    .filter((m) => m.content || (m.images && m.images.length > 0))
    .map((m) => {
      const parts: any[] = []
      if (m.content) parts.push({ text: m.content })
      if (m.images && m.images.length > 0) {
        for (const img of m.images) {
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: img.replace(/^data:image\/\w+;base64,/, '')
            }
          })
        }
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      }
    })

  const body: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 3000
    }
  }

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    }
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    if (modelIndex + 1 < CANDIDATE_MODELS.length) {
      return streamGeminiChat(messages, systemInstruction, onChunk, modelIndex + 1)
    }
    throw new Error(`Gemini Stream error: ${res.statusText}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No readable stream')

  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trim()
        if (!jsonStr) continue
        try {
          const parsed = JSON.parse(jsonStr)
          const chunkText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
          if (chunkText) {
            fullText += chunkText
            onChunk(chunkText)
          }
        } catch {
          // ignore stream parse glitches
        }
      }
    }
  }

  return fullText
}

/**
 * Generates "the summary or more than a summary" of a chat
 * Produces an in-depth structured document: Executive Summary, Key Decisions,
 * Salient Technical Details, Artifacts, and Next Steps.
 */
export async function generateDeepChatSummary(
  title: string,
  messages: Array<{ role: string; content: string }>
): Promise<ChatSummaryResult> {
  if (!messages || messages.length === 0) {
    return {
      title,
      executiveSummary: `Conversation "${title}" currently contains no recorded messages.`,
      keyDecisions: [],
      salientTopics: [],
      unresolvedItems: [],
      fullStructuredSummary: `### Context for "${title}"\nNo messages have been recorded in this conversation yet.`,
      modelUsed: 'rule-based',
      messageCount: 0
    }
  }

  // Build compact formatted log of the conversation turns
  const formattedTranscript = messages
    .map((m, idx) => {
      const role = m.role === 'user' ? 'User' : 'Assistant'
      const text = m.content.length > 1000 ? m.content.slice(0, 1000) + '...' : m.content
      return `[Turn ${idx + 1} - ${role}]:\n${text}`
    })
    .join('\n\n')

  const prompt = `You are an expert AI research & conversation distillation engine.
Analyze the following conversation titled "${title}" and generate a comprehensive, highly insightful synthesis ("summary and more than a summary") that captures both the big picture and granular technical/factual context.

Output your analysis in this structured format:

## 1. Executive Summary
(2-3 clear, impactful sentences summarizing what this discussion was about, the user's primary objectives, and the main solutions achieved.)

## 2. Key Decisions, Conclusions & Takeaways
(Bullet points detailing the definitive choices made, conclusions reached, methodologies selected, or architectural decisions agreed upon.)

## 3. Salient Concepts, Technical Details & Artifacts
(Granular details: equations, code patterns, technical parameters, file names, framework versions, or data points established in the discussion.)

## 4. Pending / Open Items & Next Steps
(What was left unfinished, suggested follow-ups, or logical next directions.)

## 5. Salient Dialogue Turning Points
(Brief chronological breakdown of key milestones in the conversation.)

Here is the conversation log:
${formattedTranscript}
`

  try {
    const rawAiSummary = await callGemini(
      prompt,
      'You are Helfen AI Context Summarizer. You specialize in dense, high-signal conversational summarization with zero loss of critical context.'
    )

    // Extract sections for structured UI presentation
    const execMatch = rawAiSummary.match(/## 1\.\s*Executive Summary([\s\S]*?)(?=## 2|$)/i)
    const decisionsMatch = rawAiSummary.match(/## 2\.\s*Key Decisions[^\n]*([\s\S]*?)(?=## 3|$)/i)
    const topicsMatch = rawAiSummary.match(/## 3\.\s*Salient Concepts[^\n]*([\s\S]*?)(?=## 4|$)/i)
    const unresolvedMatch = rawAiSummary.match(/## 4\.\s*Pending[^\n]*([\s\S]*?)(?=## 5|$)/i)

    const extractBullets = (block: string | undefined): string[] => {
      if (!block) return []
      return block
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l))
        .map((l) => l.replace(/^[-*]\s*|^\d+\.\s*/, '').trim())
        .filter(Boolean)
    }

    const executiveSummary = execMatch ? execMatch[1].trim() : `Comprehensive summary of "${title}".`
    const keyDecisions = extractBullets(decisionsMatch?.[1])
    const salientTopics = extractBullets(topicsMatch?.[1])
    const unresolvedItems = extractBullets(unresolvedMatch?.[1])

    return {
      title,
      executiveSummary,
      keyDecisions,
      salientTopics,
      unresolvedItems,
      fullStructuredSummary: rawAiSummary,
      modelUsed: 'gemini-3.5-flash-lite',
      messageCount: messages.length
    }
  } catch (err) {
    console.warn('Gemini summary call failed, falling back to algorithmic distillation:', err)
    return generateOfflineSummary(title, messages)
  }
}

/**
 * High-quality fallback rule-based analytical digest if API is offline
 */
export function generateOfflineSummary(
  title: string,
  messages: Array<{ role: string; content: string }>
): ChatSummaryResult {
  const userMessages = messages.filter((m) => m.role === 'user')
  const assistantMessages = messages.filter((m) => m.role === 'assistant')

  const topics: string[] = []
  const decisions: string[] = []
  const artifacts: string[] = []

  // Extract questions and major queries
  for (const m of userMessages) {
    const lines = m.content.split('\n').filter(Boolean)
    for (const line of lines) {
      if (line.includes('?') || line.toLowerCase().startsWith('how') || line.toLowerCase().startsWith('what')) {
        topics.push(line.trim().slice(0, 120))
      }
    }
  }

  // Extract code blocks, bullets, and strong conclusions from assistant
  for (const m of assistantMessages) {
    const codeMatches = m.content.match(/```[a-z]*\n[\s\S]*?```/gi)
    if (codeMatches) {
      artifacts.push(`Code artifact (${codeMatches.length} block(s))`)
    }

    const bullets = m.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- **') || l.startsWith('* **'))
      .map((l) => l.replace(/^[-*]\s*/, '').slice(0, 140))

    decisions.push(...bullets.slice(0, 4))
  }

  const executiveSummary =
    userMessages.length > 0
      ? `Discussion centered on "${title}", involving ${messages.length} conversational turns. Initial focus: "${userMessages[0].content.slice(0, 150)}...".`
      : `Context record for "${title}".`

  const fullStructuredSummary = [
    `## Context & Comprehensive Synthesis: "${title}"`,
    `\n### 1. Executive Summary`,
    executiveSummary,
    `\n### 2. Key Discussion Topics & User Queries`,
    ...(topics.slice(0, 6).map((t) => `- ${t}`) || ['- General exploratory discussion']),
    `\n### 3. Established Solutions & Key Conclusions`,
    ...(decisions.slice(0, 6).map((d) => `- ${d}`) || ['- Detailed answers provided and analyzed']),
    `\n### 4. Technical Artifacts & Context Log`,
    `- Total conversation turns: ${messages.length} messages (${userMessages.length} user prompts, ${assistantMessages.length} assistant responses)`,
    `- Full context active and ready for cross-session queries.`
  ].join('\n')

  return {
    title,
    executiveSummary,
    keyDecisions: decisions.slice(0, 6),
    salientTopics: topics.slice(0, 6),
    unresolvedItems: [],
    fullStructuredSummary,
    modelUsed: 'algorithmic-distillation',
    messageCount: messages.length
  }
}
