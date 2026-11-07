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
  size = 260,
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
    const baseRadius = size * 0.38 // ~100px radius for 260px container

    const isLight = theme === 'light'

    const render = () => {
      // Speed modulation based on status
      const speed =
        status === 'thinking'
          ? 0.042
          : status === 'speaking'
          ? 0.035
          : 0.022
      timeRef.current += speed
      const t = timeRef.current

      ctx.clearRect(0, 0, size, size)

      // Dynamic breathing and volume responsiveness
      const vol = Math.min(1, Math.max(0, volumeLevel))
      const currentRadius =
        baseRadius *
        (1 + Math.sin(t * 1.5) * 0.015 + vol * 0.08)

      // 1. Soft atmospheric halo behind the orb
      if (!isLight) {
        // Dark mode: luminous cyan/azure glow (like Image 2)
        const outerGlow = ctx.createRadialGradient(
          centerX,
          centerY,
          currentRadius * 0.82,
          centerX,
          centerY,
          currentRadius * 1.35
        )
        const glowAlpha = 0.25 + vol * 0.25
        outerGlow.addColorStop(0, `rgba(56, 189, 248, ${glowAlpha})`)
        outerGlow.addColorStop(0.5, `rgba(37, 99, 235, ${glowAlpha * 0.5})`)
        outerGlow.addColorStop(1, 'rgba(30, 58, 138, 0)')

        ctx.save()
        ctx.beginPath()
        ctx.arc(centerX, centerY, currentRadius * 1.35, 0, Math.PI * 2)
        ctx.fillStyle = outerGlow
        ctx.fill()
        ctx.restore()
      } else {
        // Light mode: delicate soft sky shadow (like Image 1)
        const outerShadow = ctx.createRadialGradient(
          centerX,
          centerY,
          currentRadius * 0.88,
          centerX,
          centerY,
          currentRadius * 1.25
        )
        const shadowAlpha = 0.12 + vol * 0.15
        outerShadow.addColorStop(0, `rgba(37, 99, 235, ${shadowAlpha})`)
        outerShadow.addColorStop(0.6, `rgba(56, 189, 248, ${shadowAlpha * 0.4})`)
        outerShadow.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.save()
        ctx.beginPath()
        ctx.arc(centerX, centerY, currentRadius * 1.25, 0, Math.PI * 2)
        ctx.fillStyle = outerShadow
        ctx.fill()
        ctx.restore()
      }

      // 2. Circular Clipping Boundary (Exact ChatGPT Voice Spherical Mask)
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2)
      ctx.clip()

      // 3. Fluid Base Rotating Gradient (Azure to Sky Blue)
      const rotAngle = status === 'thinking' ? t * 0.9 : t * 0.25
      const gx1 = centerX + Math.cos(rotAngle) * currentRadius
      const gy1 = centerY + Math.sin(rotAngle) * currentRadius
      const gx2 = centerX - Math.cos(rotAngle) * currentRadius
      const gy2 = centerY - Math.sin(rotAngle) * currentRadius

      const baseGrad = ctx.createLinearGradient(gx1, gy1, gx2, gy2)
      baseGrad.addColorStop(0, '#1d4ed8') // Deep royal blue
      baseGrad.addColorStop(0.35, '#2563eb') // Azure blue
      baseGrad.addColorStop(0.7, '#38bdf8') // Sky blue
      baseGrad.addColorStop(1, '#93c5fd') // Soft ice periwinkle

      ctx.fillStyle = baseGrad
      ctx.fillRect(0, 0, size, size)

      // 4. Harmonic Ethereal Fluid Cloud Blobs (The Signature ChatGPT Voice Texture)
      // Billow 1: Main Brilliant White Cloud Mass
      const w1x =
        centerX +
        Math.cos(t * 0.6) * (currentRadius * 0.36)
      const w1y =
        centerY +
        Math.sin(t * 0.7) * (currentRadius * 0.32) -
        currentRadius * 0.12
      const w1r =
        currentRadius * (0.65 + Math.sin(t * 1.1) * 0.08 + vol * 0.2)
      const w1Grad = ctx.createRadialGradient(w1x, w1y, 0, w1x, w1y, w1r)
      w1Grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)')
      w1Grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.88)')
      w1Grad.addColorStop(0.65, 'rgba(224, 242, 254, 0.45)')
      w1Grad.addColorStop(1, 'rgba(186, 230, 253, 0)')

      ctx.fillStyle = w1Grad
      ctx.beginPath()
      ctx.arc(w1x, w1y, w1r, 0, Math.PI * 2)
      ctx.fill()

      // Billow 2: Diagonal Sweeping White Plume (Creates the diagonal cloud streak)
      const w2x =
        centerX +
        Math.sin(t * 0.5 + 2.0) * (currentRadius * 0.42)
      const w2y =
        centerY +
        Math.cos(t * 0.6 + 1.4) * (currentRadius * 0.38)
      const w2r =
        currentRadius * (0.58 + Math.cos(t * 0.95) * 0.08 + vol * 0.18)
      const w2Grad = ctx.createRadialGradient(w2x, w2y, 0, w2x, w2y, w2r)
      w2Grad.addColorStop(0, 'rgba(255, 255, 255, 0.94)')
      w2Grad.addColorStop(0.4, 'rgba(240, 249, 255, 0.72)')
      w2Grad.addColorStop(0.7, 'rgba(186, 230, 253, 0.35)')
      w2Grad.addColorStop(1, 'rgba(125, 211, 252, 0)')

      ctx.fillStyle = w2Grad
      ctx.beginPath()
      ctx.arc(w2x, w2y, w2r, 0, Math.PI * 2)
      ctx.fill()

      // Billow 3: Vibrant Cyan / Turquoise Accent
      const c3x =
        centerX +
        Math.cos(t * 0.8 + 3.4) * (currentRadius * 0.44)
      const c3y =
        centerY +
        Math.sin(t * 0.75 + 2.8) * (currentRadius * 0.4)
      const c3r = currentRadius * (0.68 + vol * 0.2)
      const c3Grad = ctx.createRadialGradient(c3x, c3y, 0, c3x, c3y, c3r)
      c3Grad.addColorStop(0, 'rgba(56, 189, 248, 0.85)')
      c3Grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.45)')
      c3Grad.addColorStop(1, 'rgba(2, 132, 199, 0)')

      ctx.fillStyle = c3Grad
      ctx.beginPath()
      ctx.arc(c3x, c3y, c3r, 0, Math.PI * 2)
      ctx.fill()

      // Billow 4: Deep Oceanic Cobalt Shadow (Lower contrast anchor)
      const d4x =
        centerX +
        Math.sin(t * 0.55 + 4.8) * (currentRadius * 0.35)
      const d4y =
        centerY +
        Math.cos(t * 0.45 + 4.2) * (currentRadius * 0.3) +
        currentRadius * 0.25
      const d4r = currentRadius * (0.78 + Math.sin(t * 0.7) * 0.08)
      const d4Grad = ctx.createRadialGradient(d4x, d4y, 0, d4x, d4y, d4r)
      d4Grad.addColorStop(0, 'rgba(30, 58, 138, 0.95)')
      d4Grad.addColorStop(0.45, 'rgba(29, 78, 216, 0.82)')
      d4Grad.addColorStop(0.8, 'rgba(37, 99, 235, 0.3)')
      d4Grad.addColorStop(1, 'rgba(37, 99, 235, 0)')

      ctx.fillStyle = d4Grad
      ctx.beginPath()
      ctx.arc(d4x, d4y, d4r, 0, Math.PI * 2)
      ctx.fill()

      // Billow 5: Glowing Pure White Center Specular Core
      const w5x = w1x * 0.6 + w2x * 0.4
      const w5y = w1y * 0.6 + w2y * 0.4
      const w5r = currentRadius * (0.36 + vol * 0.24)
      const w5Grad = ctx.createRadialGradient(w5x, w5y, 0, w5x, w5y, w5r)
      w5Grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
      w5Grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.65)')
      w5Grad.addColorStop(1, 'rgba(255, 255, 255, 0)')

      ctx.fillStyle = w5Grad
      ctx.beginPath()
      ctx.arc(w5x, w5y, w5r, 0, Math.PI * 2)
      ctx.fill()

      // End clipping
      ctx.restore()

      // 5. Crisp, elegant perimeter rim
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2)
      if (isLight) {
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.16)'
        ctx.lineWidth = 1.2
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
        ctx.lineWidth = 1.2
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
