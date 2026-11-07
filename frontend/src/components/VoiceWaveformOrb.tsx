'use client'

import { useEffect, useRef } from 'react'

interface VoiceWaveformOrbProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking'
  volumeLevel: number // 0.0 to 1.0
  frequencyData?: Uint8Array
  size?: number
  theme?: 'light' | 'dark'
}

export function VoiceWaveformOrb({
  status,
  volumeLevel,
  size = 250,
  theme = 'dark'
}: VoiceWaveformOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)
  const timeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const centerX = size / 2
    const centerY = size / 2
    const baseRadius = size * 0.38 // ~95px radius for 250px container

    const isLight = theme === 'light'

    const render = () => {
      // Speed modulation based on status
      const speed =
        status === 'thinking'
          ? 0.038
          : status === 'speaking'
          ? 0.032
          : 0.02
      timeRef.current += speed
      const t = timeRef.current

      ctx.clearRect(0, 0, size, size)

      // Dynamic breathing and subtle volume responsiveness (smooth fluid expansion)
      const vol = Math.min(1, Math.max(0, volumeLevel))
      const currentRadius =
        baseRadius *
        (1 + Math.sin(t * 1.4) * 0.012 + vol * 0.065)

      // 1. Soft atmospheric halo behind the orb
      if (!isLight) {
        // Dark mode: soft, ethereal cyan/azure glow (delicate, not harsh)
        const outerGlow = ctx.createRadialGradient(
          centerX,
          centerY,
          currentRadius * 0.88,
          centerX,
          centerY,
          currentRadius * 1.3
        )
        const glowAlpha = 0.2 + vol * 0.15
        outerGlow.addColorStop(0, `rgba(56, 189, 248, ${glowAlpha})`)
        outerGlow.addColorStop(0.5, `rgba(37, 99, 235, ${glowAlpha * 0.4})`)
        outerGlow.addColorStop(1, 'rgba(30, 58, 138, 0)')

        ctx.save()
        ctx.beginPath()
        ctx.arc(centerX, centerY, currentRadius * 1.3, 0, Math.PI * 2)
        ctx.fillStyle = outerGlow
        ctx.fill()
        ctx.restore()
      } else {
        // Light mode: delicate soft sky shadow (matches Image 1)
        const outerShadow = ctx.createRadialGradient(
          centerX,
          centerY,
          currentRadius * 0.9,
          centerX,
          centerY,
          currentRadius * 1.2
        )
        const shadowAlpha = 0.08 + vol * 0.1
        outerShadow.addColorStop(0, `rgba(37, 99, 235, ${shadowAlpha})`)
        outerShadow.addColorStop(0.6, `rgba(56, 189, 248, ${shadowAlpha * 0.3})`)
        outerShadow.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.save()
        ctx.beginPath()
        ctx.arc(centerX, centerY, currentRadius * 1.2, 0, Math.PI * 2)
        ctx.fillStyle = outerShadow
        ctx.fill()
        ctx.restore()
      }

      // 2. Circular Clipping Boundary (Exact ChatGPT Voice Spherical Mask)
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2)
      ctx.clip()

      // 3. Fluid Base Rotating Gradient (Deep Azure to Vibrant Sky Blue)
      const rotAngle = status === 'thinking' ? t * 0.8 : t * 0.22
      const gx1 = centerX + Math.cos(rotAngle) * currentRadius
      const gy1 = centerY + Math.sin(rotAngle) * currentRadius
      const gx2 = centerX - Math.cos(rotAngle) * currentRadius
      const gy2 = centerY - Math.sin(rotAngle) * currentRadius

      const baseGrad = ctx.createLinearGradient(gx1, gy1, gx2, gy2)
      baseGrad.addColorStop(0, '#1d4ed8') // Deep royal blue
      baseGrad.addColorStop(0.32, '#2563eb') // Azure blue
      baseGrad.addColorStop(0.68, '#38bdf8') // Sky blue
      baseGrad.addColorStop(1, '#7dd3fc') // Soft cyan ice

      ctx.fillStyle = baseGrad
      ctx.fillRect(0, 0, size, size)

      // 4. Harmonic Ethereal Fluid Cloud Blobs (NO harsh center spotlight! Soft dreamy watercolor clouds)
      // Billow 1: Soft Cloud Plume (Drifting diagonally in upper-left)
      const w1x =
        centerX +
        Math.cos(t * 0.55) * (currentRadius * 0.38)
      const w1y =
        centerY +
        Math.sin(t * 0.65) * (currentRadius * 0.32) -
        currentRadius * 0.18
      const w1r =
        currentRadius * (0.7 + Math.sin(t * 0.9) * 0.06 + vol * 0.15)
      const w1Grad = ctx.createRadialGradient(w1x, w1y, 0, w1x, w1y, w1r)
      // Soft alpha falloff - graceful, billowing white clouds
      w1Grad.addColorStop(0, 'rgba(255, 255, 255, 0.72)')
      w1Grad.addColorStop(0.3, 'rgba(240, 249, 255, 0.55)')
      w1Grad.addColorStop(0.6, 'rgba(186, 230, 253, 0.28)')
      w1Grad.addColorStop(1, 'rgba(125, 211, 252, 0)')

      ctx.fillStyle = w1Grad
      ctx.beginPath()
      ctx.arc(w1x, w1y, w1r, 0, Math.PI * 2)
      ctx.fill()

      // Billow 2: Sweeping Wave Band (Creates the organic cloud streak seen in ChatGPT photos)
      const w2x =
        centerX +
        Math.sin(t * 0.48 + 1.8) * (currentRadius * 0.45)
      const w2y =
        centerY +
        Math.cos(t * 0.58 + 1.2) * (currentRadius * 0.4)
      const w2r =
        currentRadius * (0.65 + Math.cos(t * 0.85) * 0.06 + vol * 0.14)
      const w2Grad = ctx.createRadialGradient(w2x, w2y, 0, w2x, w2y, w2r)
      w2Grad.addColorStop(0, 'rgba(255, 255, 255, 0.68)')
      w2Grad.addColorStop(0.35, 'rgba(224, 242, 254, 0.48)')
      w2Grad.addColorStop(0.7, 'rgba(125, 211, 252, 0.22)')
      w2Grad.addColorStop(1, 'rgba(56, 189, 248, 0)')

      ctx.fillStyle = w2Grad
      ctx.beginPath()
      ctx.arc(w2x, w2y, w2r, 0, Math.PI * 2)
      ctx.fill()

      // Billow 3: Glowing Cyan & Turquoise Accent Swirl
      const c3x =
        centerX +
        Math.cos(t * 0.7 + 3.1) * (currentRadius * 0.42)
      const c3y =
        centerY +
        Math.sin(t * 0.65 + 2.6) * (currentRadius * 0.38)
      const c3r = currentRadius * (0.72 + vol * 0.16)
      const c3Grad = ctx.createRadialGradient(c3x, c3y, 0, c3x, c3y, c3r)
      c3Grad.addColorStop(0, 'rgba(56, 189, 248, 0.75)')
      c3Grad.addColorStop(0.45, 'rgba(14, 165, 233, 0.38)')
      c3Grad.addColorStop(1, 'rgba(2, 132, 199, 0)')

      ctx.fillStyle = c3Grad
      ctx.beginPath()
      ctx.arc(c3x, c3y, c3r, 0, Math.PI * 2)
      ctx.fill()

      // Billow 4: Deep Oceanic Royal Shadow (Lower section anchor contrast)
      const d4x =
        centerX +
        Math.sin(t * 0.5 + 4.5) * (currentRadius * 0.32)
      const d4y =
        centerY +
        Math.cos(t * 0.4 + 3.9) * (currentRadius * 0.28) +
        currentRadius * 0.28
      const d4r = currentRadius * (0.8 + Math.sin(t * 0.6) * 0.06)
      const d4Grad = ctx.createRadialGradient(d4x, d4y, 0, d4x, d4y, d4r)
      d4Grad.addColorStop(0, 'rgba(30, 58, 138, 0.88)')
      d4Grad.addColorStop(0.45, 'rgba(29, 78, 216, 0.72)')
      d4Grad.addColorStop(0.8, 'rgba(37, 99, 235, 0.25)')
      d4Grad.addColorStop(1, 'rgba(37, 99, 235, 0)')

      ctx.fillStyle = d4Grad
      ctx.beginPath()
      ctx.arc(d4x, d4y, d4r, 0, Math.PI * 2)
      ctx.fill()

      // End clipping
      ctx.restore()

      // 5. Crisp, delicate perimeter rim
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2)
      if (isLight) {
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.14)'
        ctx.lineWidth = 1.0
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
        ctx.lineWidth = 1.0
      }
      ctx.stroke()
      ctx.restore()

      animRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [status, volumeLevel, size, theme])

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
