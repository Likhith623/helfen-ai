import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'sonic-english' } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const cartesiaResponse = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': process.env.CARTESIA_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: text.slice(0, 1000), // Limit for performance
        model_id: 'sonic-english',
        voice: {
          mode: 'id',
          id: '694f9389-aac1-45b6-b726-9d9369183238', // Default voice ID
        },
        output_format: {
          container: 'mp3',
          encoding: 'mp3',
          sample_rate: 44100,
        },
      }),
    })

    if (!cartesiaResponse.ok) {
      const errText = await cartesiaResponse.text()
      throw new Error(`Cartesia error: ${errText}`)
    }

    const audioBuffer = await cartesiaResponse.arrayBuffer()

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'TTS error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
