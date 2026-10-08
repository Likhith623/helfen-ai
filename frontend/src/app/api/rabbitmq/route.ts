import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  try {
    // Test RabbitMQ connection
    const amqp = await import('amqplib')
    const conn = await amqp.connect(
      process.env.RABBITMQ_URL || 'amqp://helfen:helfen123@localhost:5672/helfen_vhost'
    )
    const channel = await conn.createChannel()
    await channel.assertQueue('helfen.ai.events', { durable: true })
    await channel.close()
    await conn.close()

    return NextResponse.json({ status: 'connected', queue: 'helfen.ai.events' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'RabbitMQ error'
    return NextResponse.json({ status: 'error', error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { event, data } = await req.json()

    const amqp = await import('amqplib')
    const conn = await amqp.connect(
      process.env.RABBITMQ_URL || 'amqp://helfen:helfen123@localhost:5672/helfen_vhost'
    )
    const channel = await conn.createChannel()

    await channel.assertQueue('helfen.ai.events', { durable: true })
    channel.sendToQueue(
      'helfen.ai.events',
      Buffer.from(JSON.stringify({ event, data, timestamp: new Date().toISOString() })),
      { persistent: true }
    )

    await channel.close()
    await conn.close()

    return NextResponse.json({ success: true, event })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'RabbitMQ publish failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
