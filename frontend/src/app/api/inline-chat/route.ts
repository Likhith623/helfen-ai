import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { selectedText, question, conversationId, model = 'llama3.2:3b' } = await req.json()

    if (!selectedText || !question) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const systemPrompt = `You are a helpful AI assistant. The user has selected a specific piece of text from a response and has a question about it. Answer concisely and clearly.

Selected text: "${selectedText}"

Provide a focused, helpful answer to the user's question about this selected text. Keep your response concise (2-4 sentences max unless detail is needed).`

    const ollamaResponse = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        stream: true,
        options: { temperature: 0.5, top_p: 0.9 },
      }),
    })

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama error: ${ollamaResponse.statusText}`)
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaResponse.body!.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const lines = decoder.decode(value).split('\n').filter(Boolean)
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line)
                if (parsed.message?.content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: parsed.message.content, done: false })}\n\n`)
                  )
                }
                if (parsed.done) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`))
                }
              } catch {}
            }
          }
        } catch (err) {
          controller.error(err)
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
    const message = error instanceof Error ? error.message : 'Inline chat error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
