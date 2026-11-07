'use client'

import { useEffect, useRef } from 'react'

interface VoiceWaveformOrbProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking'
  volumeLevel: number // 0.0 to 1.0
  frequencyData?: Uint8Array
  size?: number
}

export function VoiceWaveformOrb({
  status,
  volumeLevel,
  size = 240
}: VoiceWaveformOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)
  const timeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const centerX = size / 2
    const centerY = size / 2

    const render = () => {
      // Speed modulation based on status
      const speed = status === 'thinking' ? 0.045 : status === 'speaking' ? 0.04 : 0.025
      timeRef.current += speed
      const t = timeRef.current

      ctx.clearRect(0, 0, size, size)

      // Base radius: small, neat ball (26px) with very subtle volume response (up to 32px)
      const baseRadius = 26 + volumeLevel * 8

      // Echo wave count and styling
      // 3 smooth expanding concentric echo circles
      const echoCount = 3
      const maxEchoRadius = size * 0.44

      for (let i = 0; i < echoCount; i++) {
        // Continuous fractional progress from 0.0 to 1.0
        const progress = ((t * 0.45 + i / echoCount) % 1)
        const currentEchoRadius = baseRadius + progress * (maxEchoRadius - baseRadius)

        // Fade out smoothly as echo expands outward
        const echoOpacity = Math.sin(progress * Math.PI) * 0.38 * (0.5 + volumeLevel * 0.8)

        if (echoOpacity > 0.01) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(centerX, centerY, currentEchoRadius, 0, Math.PI * 2)

          // Echo stroke gradient
          const echoGrad = ctx.createLinearGradient(
            centerX - currentEchoRadius,
            centerY - currentEchoRadius,
            centerX + currentEchoRadius,
            centerY + currentEchoRadius
          )

          if (status === 'thinking') {
            echoGrad.addColorStop(0, `rgba(168, 85, 247, ${echoOpacity})`)
            echoGrad.addColorStop(0.5, `rgba(236, 72, 153, ${echoOpacity})`)
            echoGrad.addColorStop(1, `rgba(59, 130, 246, ${echoOpacity})`)
          } else if (status === 'speaking') {
            echoGrad.addColorStop(0, `rgba(34, 197, 94, ${echoOpacity})`)
            echoGrad.addColorStop(0.5, `rgba(6, 182, 212, ${echoOpacity})`)
            echoGrad.addColorStop(1, `rgba(59, 130, 246, ${echoOpacity})`)
          } else {
            // Listening / Idle (Gemini signature cyan-blue-purple echo)
            echoGrad.addColorStop(0, `rgba(56, 189, 248, ${echoOpacity})`)
            echoGrad.addColorStop(0.5, `rgba(99, 102, 241, ${echoOpacity})`)
            echoGrad.addColorStop(1, `rgba(168, 85, 247, ${echoOpacity})`)
          }

          ctx.strokeStyle = echoGrad
          ctx.lineWidth = 1.8 + (1 - progress) * 1.2
          ctx.stroke()
          ctx.restore()
        }
      }

      // Soft ambient radiant glow behind the ball
      const glowGrad = ctx.createRadialGradient(
        centerX, centerY, baseRadius * 0.2,
        centerX, centerY, baseRadius * 2.4
      )

      if (status === 'thinking') {
        glowGrad.addColorStop(0, 'rgba(168, 85, 247, 0.45)')
        glowGrad.addColorStop(0.6, 'rgba(236, 72, 153, 0.22)')
        glowGrad.addColorStop(1, 'rgba(168, 85, 247, 0)')
      } else if (status === 'speaking') {
        glowGrad.addColorStop(0, 'rgba(34, 197, 94, 0.42)')
        glowGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.22)')
        glowGrad.addColorStop(1, 'rgba(6, 182, 212, 0)')
      } else {
        glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)')
        glowGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.25)')
        glowGrad.addColorStop(1, 'rgba(99, 102, 241, 0)')
      }

      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, baseRadius * 2.4, 0, Math.PI * 2)
      ctx.fillStyle = glowGrad
      ctx.fill()
      ctx.restore()

      // The neat colorful 3D core ball
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2)

      // 3D sphere radial gradient with off-center specular light
      const lightOffsetX = Math.cos(t * 0.8) * 4 - 6
      const lightOffsetY = Math.sin(t * 0.8) * 4 - 6

      const sphereGrad = ctx.createRadialGradient(
        centerX + lightOffsetX,
        centerY + lightOffsetY,
        baseRadius * 0.08,
        centerX,
        centerY,
        baseRadius
      )

      if (status === 'thinking') {
        sphereGrad.addColorStop(0, '#ffffff')
        sphereGrad.addColorStop(0.25, '#f472b6')
        sphereGrad.addColorStop(0.65, '#a855f7')
        sphereGrad.addColorStop(1, '#4c1d95')
      } else if (status === 'speaking') {
        sphereGrad.addColorStop(0, '#ffffff')
        sphereGrad.addColorStop(0.25, '#6ee7b7')
        sphereGrad.addColorStop(0.65, '#06b6d4')
        sphereGrad.addColorStop(1, '#1e3a8a')
      } else {
        // Listening / Idle
        sphereGrad.addColorStop(0, '#ffffff')
        sphereGrad.addColorStop(0.25, '#7dd3fc')
        sphereGrad.addColorStop(0.65, '#6366f1')
        sphereGrad.addColorStop(1, '#312e81')
      }

      ctx.fillStyle = sphereGrad
      ctx.shadowColor = status === 'thinking' ? '#ec4899' : status === 'speaking' ? '#10b981' : '#38bdf8'
      ctx.shadowBlur = 16
      ctx.fill()
      ctx.restore()

      animRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [status, volumeLevel, size])

  return (
    <div className="voice-orb-wrapper">
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          display: 'block',
          margin: '0 auto'
        }}
      />
    </div>
  )
}
