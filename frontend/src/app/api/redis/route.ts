import { NextRequest, NextResponse } from 'next/server'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export async function GET(req: NextRequest) {
  try {
    // Test ping
    await redis.ping()
    
    // Get some stats
    const info = await redis.info('memory')
    const dbSize = await redis.dbsize()
    
    return NextResponse.json({
      status: 'connected',
      dbSize,
      memoryInfo: info.split('\n').slice(0, 5).join('\n'),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Redis error'
    return NextResponse.json({ status: 'error', error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, key, value, ttl } = await req.json()

    switch (action) {
      case 'set':
        if (ttl) {
          await redis.setex(key, ttl, JSON.stringify(value))
        } else {
          await redis.set(key, JSON.stringify(value))
        }
        return NextResponse.json({ success: true })

      case 'get': {
        const data = await redis.get(key)
        return NextResponse.json({ value: data ? JSON.parse(data) : null })
      }

      case 'del':
        await redis.del(key)
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Redis operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
