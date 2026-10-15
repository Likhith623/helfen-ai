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
  frequencyData,
  size = 280
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
      timeRef.current += 0.035
      const t = timeRef.current

      ctx.clearRect(0, 0, size, size)

      // Base radius with volume bounce
      const baseRadius = 58 + volumeLevel * 32

      // Determine palette based on status
      let primaryColor = 'rgba(66, 133, 244, ' // Blue
      let secondaryColor = 'rgba(52, 168, 83, ' // Green
      let auraColor = 'rgba(156, 39, 176, ' // Purple

      if (status === 'listening') {
        primaryColor = 'rgba(66, 133, 244, '
        secondaryColor = 'rgba(0, 229, 255, '
        auraColor = 'rgba(41, 121, 255, '
      } else if (status === 'thinking') {
        primaryColor = 'rgba(156, 39, 176, '
        secondaryColor = 'rgba(233, 30, 99, '
        auraColor = 'rgba(103, 58, 183, '
      } else if (status === 'speaking') {
        primaryColor = 'rgba(0, 230, 118, '
        secondaryColor = 'rgba(0, 229, 255, '
        auraColor = 'rgba(255, 171, 0, '
      }

      // 1. Draw outer ambient glowing aura
      const ambientGrad = ctx.createRadialGradient(
        centerX, centerY, baseRadius * 0.4,
        centerX, centerY, baseRadius * 2.2
      )
      ambientGrad.addColorStop(0, `${primaryColor}0.38)`)
      ambientGrad.addColorStop(0.5, `${secondaryColor}0.18)`)
      ambientGrad.addColorStop(1, `${auraColor}0)`)

      ctx.fillStyle = ambientGrad
      ctx.beginPath()
      ctx.arc(centerX, centerY, baseRadius * 2.2, 0, Math.PI * 2)
      ctx.fill()

      // 2. Draw harmonic undulating fluid wave rings
      const rings = status === 'speaking' ? 4 : status === 'listening' ? 3 : 2

      for (let r = 0; r < rings; r++) {
        const ringOffset = r * 14
        const ringFreq = 3 + r * 2
        const ringAlpha = (0.55 - r * 0.12) * (0.6 + volumeLevel * 0.8)

        ctx.beginPath()
        const points = 60

        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2
          // Frequency data modulation if available
          let freqBoost = 0
          if (frequencyData && frequencyData.length > 0) {
            const freqIndex = (i * 2 + r * 5) % frequencyData.length
            freqBoost = (frequencyData[freqIndex] / 255) * 22
          }

          const wave =
            Math.sin(angle * ringFreq + t + r * 1.5) * (8 + volumeLevel * 18 + freqBoost) +
            Math.cos(angle * 2 - t * 0.8) * 4

          const radius = baseRadius + ringOffset + wave
          const x = centerX + Math.cos(angle) * radius
          const y = centerY + Math.sin(angle) * radius

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.closePath()

        ctx.strokeStyle = `${r % 2 === 0 ? primaryColor : secondaryColor}${ringAlpha})`
        ctx.lineWidth = 2.5 + volumeLevel * 2
        ctx.stroke()
      }

      // 3. Central pulsing glowing core orb
      const coreGrad = ctx.createRadialGradient(
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.25,
        4,
        centerX,
        centerY,
        baseRadius
      )

      if (status === 'thinking') {
        const rotationAngle = t * 1.2
        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(rotationAngle)
        ctx.translate(-centerX, -centerY)
      }

      coreGrad.addColorStop(0, '#ffffff')
      coreGrad.addColorStop(0.3, `${primaryColor}0.9)`)
      coreGrad.addColorStop(0.7, `${secondaryColor}0.85)`)
      coreGrad.addColorStop(1, `${auraColor}0.4)`)

      ctx.fillStyle = coreGrad
      ctx.beginPath()
      ctx.arc(centerX, centerY, baseRadius * 0.85, 0, Math.PI * 2)
      ctx.fill()

      if (status === 'thinking') {
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [status, volumeLevel, frequencyData, size])

  return (
    <div className="voice-waveform-orb-container" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  )
}
