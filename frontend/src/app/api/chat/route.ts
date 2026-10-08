import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { conversationId, messages, model = 'llama3.2:3b', isTemporary = false } = body

    // Get memories from Redis for context
    let memoryContext = ''
    if (conversationId) {
      const cachedHistory = await redis.get(`chat:${conversationId}`)
      if (cachedHistory) {
        const parsed = JSON.parse(cachedHistory)
        memoryContext = parsed.summary || ''
      }
    }

    // Build system prompt
    const systemPrompt = `You are Helfen AI, a helpful, harmless, and honest AI assistant. You provide clear, concise, and accurate responses.${memoryContext ? `\n\nContext from previous interactions:\n${memoryContext}` : ''}`

    // Build messages for Ollama
    const ollamaMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    // Stream from Ollama
    const ollamaResponse = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      }),
    })

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama error: ${ollamaResponse.statusText}`)
    }

    // Store context in Redis after streaming completes
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    let fullContent = ''

    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaResponse.body!.getReader()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n').filter(Boolean)

            for (const line of lines) {
              try {
                const parsed = JSON.parse(line)
                if (parsed.message?.content) {
                  fullContent += parsed.message.content
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: parsed.message.content, done: false })}\n\n`)
                  )
                }
                if (parsed.done) {
                  // Cache to Redis
                  if (conversationId && !isTemporary) {
                    await redis.setex(
                      `chat:${conversationId}`,
                      86400, // 24 hours
                      JSON.stringify({
                        lastUpdated: new Date().toISOString(),
                        summary: fullContent.slice(0, 500),
                        messageCount: messages.length + 1,
                      })
                    )
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`))
                }
              } catch {
                // Skip parse errors
              }
            }
          }
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
