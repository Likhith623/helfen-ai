import type { MessageAttachment } from '@/store/appStore'

/**
 * Format bytes to human readable string (KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'
])

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'html', 'htm', 'css', 'scss', 'sass', 'go', 'rs', 'php',
  'sql', 'sh', 'bash', 'zsh', 'yml', 'yaml', 'json', 'xml', 'graphql'
])

/**
 * Categorize uploaded file based on its extension and MIME type
 */
export function getFileType(filename: string, mimeType: string): 'image' | 'document' | 'code' {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (mimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) {
    return 'image'
  }
  if (CODE_EXTENSIONS.has(ext)) {
    return 'code'
  }
  return 'document'
}

/**
 * Downscale image if too large and convert to clean base64 + dataUrl
 */
async function processImage(file: File): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) {
        reject(new Error('Failed to read image'))
        return
      }

      // If SVG or small, return directly
      if (file.type.includes('svg') || file.size < 500 * 1024) {
        const rawBase64 = dataUrl.split(',')[1] || ''
        resolve({ dataUrl, base64: rawBase64 })
        return
      }

      // Optimize image dimensions for Vision LLMs (max 1280px)
      const img = new Image()
      img.onload = () => {
        const maxDim = 1280
        let { width, height } = img

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          const rawBase64 = dataUrl.split(',')[1] || ''
          resolve({ dataUrl, base64: rawBase64 })
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const optimizedUrl = canvas.toDataURL('image/jpeg', 0.85)
        const optimizedBase64 = optimizedUrl.split(',')[1] || ''
        resolve({ dataUrl: optimizedUrl, base64: optimizedBase64 })
      }
      img.onerror = () => {
        const rawBase64 = dataUrl.split(',')[1] || ''
        resolve({ dataUrl, base64: rawBase64 })
      }
      img.src = dataUrl
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsDataURL(file)
  })
}

/**
 * Extracts text from a PDF ArrayBuffer using clean stream analysis
 */
function extractTextFromPdfBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const textDecoder = new TextDecoder('utf-8', { fatal: false })
  const rawString = textDecoder.decode(bytes)

  const textChunks: string[] = []

  // 1. Look for text enclosed in parentheses before Tj or inside TJ arrays
  const tjRegex = /\(([^)]+)\)\s*Tj/g
  let match: RegExpExecArray | null
  while ((match = tjRegex.exec(rawString)) !== null) {
    const clean = match[1].replace(/\\([()\\])/g, '$1').trim()
    if (clean.length > 0) {
      textChunks.push(clean)
    }
  }

  // 2. Look for TJ arrays: [(text) 123 (more text)] TJ
  const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g
  while ((match = arrayTjRegex.exec(rawString)) !== null) {
    const inner = match[1]
    const subMatches = inner.match(/\(([^)]+)\)/g)
    if (subMatches) {
      const line = subMatches
        .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, '$1'))
        .join(' ')
        .trim()
      if (line.length > 0) {
        textChunks.push(line)
      }
    }
  }

  // If Tj/TJ operators extracted meaningful text, return it
  if (textChunks.length > 8) {
    return textChunks.join(' ')
  }

  // 3. Fallback: Extract readable ASCII and UTF-8 paragraphs (minimum 4 characters)
  const printableRegex = /[\x20-\x7E\xA0-\xFF\n\r\t]{4,}/g
  const fallbackChunks: string[] = []
  let pMatch: RegExpExecArray | null
  while ((pMatch = printableRegex.exec(rawString)) !== null) {
    const val = pMatch[0].trim()
    // Filter out PDF internal syntax strings
    if (
      !val.startsWith('/') &&
      !val.includes('obj') &&
      !val.includes('endobj') &&
      !val.includes('stream') &&
      !val.includes('endstream') &&
      !val.includes('xref') &&
      val.length > 5
    ) {
      fallbackChunks.push(val)
    }
  }

  return fallbackChunks.join('\n\n').slice(0, 30000)
}

/**
 * Process any uploaded file and extract text or image data
 */
export async function processUploadedFile(file: File): Promise<MessageAttachment> {
  const id = crypto.randomUUID()
  const type = getFileType(file.name, file.type)

  if (type === 'image') {
    const { dataUrl, base64 } = await processImage(file)
    return {
      id,
      name: file.name,
      type: 'image',
      size: file.size,
      mimeType: file.type || 'image/png',
      dataUrl,
      base64
    }
  }

  if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer()
    const extractedText = extractTextFromPdfBuffer(buffer)
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length

    return {
      id,
      name: file.name,
      type: 'document',
      size: file.size,
      mimeType: 'application/pdf',
      text: extractedText,
      tokenCount: Math.round(wordCount * 1.3)
    }
  }

  // Text, code, or data file
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const rawText = (e.target?.result as string) || ''
      const wordCount = rawText.split(/\s+/).filter(Boolean).length

      resolve({
        id,
        name: file.name,
        type,
        size: file.size,
        mimeType: file.type || 'text/plain',
        text: rawText,
        tokenCount: Math.round(wordCount * 1.3)
      })
    }
    reader.onerror = () => reject(new Error('Failed to read document'))
    reader.readAsText(file)
  })
}

/**
 * Prepares attachments into structured context for the LLM prompt and Ollama images array
 */
export function formatAttachmentsContext(attachments: MessageAttachment[]): {
  formattedContext: string
  images: string[]
} {
  const images: string[] = []
  const documentContexts: string[] = []

  for (const att of attachments) {
    if (att.type === 'image' && att.base64) {
      images.push(att.base64)
    } else if ((att.type === 'document' || att.type === 'code') && att.text) {
      const wordCount = att.text.split(/\s+/).filter(Boolean).length
      documentContexts.push(
        `[Attached ${att.type === 'code' ? 'Code File' : 'Document'}: "${att.name}" (${formatFileSize(att.size)}, ~${wordCount} words)]\n` +
        `\`\`\`\n${att.text.slice(0, 40000)}\n\`\`\`\n` +
        `[End of "${att.name}"]`
      )
    }
  }

  const formattedContext = documentContexts.join('\n\n')
  return { formattedContext, images }
}
