import jsPDF from 'jspdf'

export interface PdfExportOptions {
  title?: string
  prompt?: string
  model?: string
  createdAt?: string
}

/**
 * Draws professional Helfen AI header and branding banner
 */
function drawHeader(doc: jsPDF, title: string, model: string, dateStr: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Top color accent bar (Gemini-inspired blue)
  doc.setFillColor(66, 133, 244)
  doc.rect(0, 0, pageWidth, 5, 'F')

  // Brand Name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(24, 28, 36)
  doc.text('Helfen.AI', 18, 16)

  // Sub-badge
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 105, 115)
  doc.text('INTELLIGENT ASSISTANT RESPONSE', 50, 16)

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30, 35, 45)
  const cleanTitle = title.length > 60 ? title.slice(0, 60) + '...' : title
  doc.text(cleanTitle, 18, 25)

  // Metadata row
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(115, 120, 130)
  doc.text(`Model: ${model}   |   Exported: ${dateStr}`, 18, 31)

  // Subtle dividing line
  doc.setDrawColor(220, 225, 235)
  doc.setLineWidth(0.5)
  doc.line(18, 35, pageWidth - 18, 35)

  return 42 // Next Y position
}

/**
 * Draws running footer on every page
 */
function drawFooters(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(230, 235, 245)
    doc.setLineWidth(0.4)
    doc.line(18, pageHeight - 12, pageWidth - 18, pageHeight - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 145, 155)
    doc.text('Generated with Helfen.AI • Next-Gen Contextual Assistant', 18, pageHeight - 7)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 18, pageHeight - 7, { align: 'right' })
  }
}

/**
 * Renders structured markdown (headings, code blocks, lists, paragraphs) into the PDF
 */
function renderMarkdownContent(
  doc: jsPDF,
  content: string,
  startY: number,
  contentWidth: number,
  maxY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  let currentY = startY

  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > maxY) {
      doc.addPage()
      doc.setFillColor(66, 133, 244)
      doc.rect(0, 0, pageWidth, 3, 'F')
      currentY = 20
    }
  }

  // Split lines while tracking code blocks
  const lines = content.split('\n')
  let inCodeBlock = false
  let codeBuffer: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]

    // Handle code block toggles
    if (rawLine.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block: render collected code
        if (codeBuffer.length > 0) {
          doc.setFont('courier', 'normal')
          doc.setFontSize(9)
          const codeLines: string[] = []
          codeBuffer.forEach((cLine) => {
            const wrapped = doc.splitTextToSize(cLine, contentWidth - 10)
            codeLines.push(...wrapped)
          })

          const boxHeight = codeLines.length * 4.5 + 6
          ensureSpace(boxHeight + 4)

          doc.setFillColor(242, 244, 248)
          doc.setDrawColor(215, 222, 235)
          doc.setLineWidth(0.3)
          doc.roundedRect(18, currentY, contentWidth, boxHeight, 2, 2, 'FD')

          doc.setTextColor(40, 44, 52)
          let codeY = currentY + 5
          for (const cL of codeLines) {
            doc.text(cL, 22, codeY)
            codeY += 4.5
          }

          currentY += boxHeight + 4
          codeBuffer = []
        }
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeBuffer = []
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine)
      continue
    }

    const trimmed = rawLine.trim()

    // Empty line -> small spacing
    if (!trimmed) {
      currentY += 3
      continue
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***') {
      ensureSpace(6)
      doc.setDrawColor(220, 225, 235)
      doc.setLineWidth(0.4)
      doc.line(18, currentY + 2, 18 + contentWidth, currentY + 2)
      currentY += 6
      continue
    }

    // Heading 1 (#)
    if (trimmed.startsWith('# ')) {
      ensureSpace(12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13.5)
      doc.setTextColor(24, 28, 36)
      const hText = trimmed.slice(2)
      const hLines = doc.splitTextToSize(hText, contentWidth)
      for (const hl of hLines) {
        doc.text(hl, 18, currentY + 4)
        currentY += 6
      }
      currentY += 2
      continue
    }

    // Heading 2 (##)
    if (trimmed.startsWith('## ')) {
      ensureSpace(10)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(30, 35, 45)
      const hText = trimmed.slice(3)
      const hLines = doc.splitTextToSize(hText, contentWidth)
      for (const hl of hLines) {
        doc.text(hl, 18, currentY + 3)
        currentY += 5.5
      }
      currentY += 2
      continue
    }

    // Heading 3 (###)
    if (trimmed.startsWith('### ')) {
      ensureSpace(9)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(45, 52, 65)
      const hText = trimmed.slice(4)
      const hLines = doc.splitTextToSize(hText, contentWidth)
      for (const hl of hLines) {
        doc.text(hl, 18, currentY + 3)
        currentY += 5
      }
      currentY += 1.5
      continue
    }

    // Bullet points (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      ensureSpace(6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(33, 37, 41)

      const bText = trimmed.slice(2)
      const bLines = doc.splitTextToSize(bText, contentWidth - 6)

      // Draw small bullet dot
      doc.setFillColor(66, 133, 244)
      doc.circle(20, currentY + 1.2, 0.8, 'F')

      for (const bl of bLines) {
        doc.text(bl, 24, currentY + 2.5)
        currentY += 5
      }
      continue
    }

    // Standard paragraph text
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(33, 37, 41)

    // Clean inline bold markers if simple
    const cleanedText = rawLine.replace(/\*\*(.*?)\*\*/g, '$1')
    const pLines = doc.splitTextToSize(cleanedText, contentWidth)
    ensureSpace(pLines.length * 5 + 1)

    for (const pl of pLines) {
      doc.text(pl, 18, currentY + 2.5)
      currentY += 5
    }
  }

  return currentY
}

/**
 * Generates and downloads a beautifully styled PDF of an assistant response
 */
export async function generateResponsePdf(
  content: string,
  options: PdfExportOptions = {}
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - 36 // 18mm margins
  const maxY = pageHeight - 20

  const title = options.title || 'Conversation Response'
  const model = options.model || 'llama3.2:3b'
  const dateStr = options.createdAt
    ? new Date(options.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : new Date().toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })

  let currentY = drawHeader(doc, title, model, dateStr)

  // Optional User Prompt context box
  if (options.prompt && options.prompt.trim()) {
    doc.setFillColor(245, 247, 250)
    doc.setDrawColor(215, 225, 240)
    doc.setLineWidth(0.3)

    const promptLines = doc.splitTextToSize(`Prompt: ${options.prompt.trim()}`, contentWidth - 8)
    const promptBoxHeight = promptLines.length * 4.8 + 6

    doc.roundedRect(18, currentY, contentWidth, promptBoxHeight, 2, 2, 'FD')
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(70, 75, 85)
    doc.text(promptLines, 22, currentY + 5)

    currentY += promptBoxHeight + 6
  }

  // Render markdown response body with code blocks and headers
  renderMarkdownContent(doc, content, currentY, contentWidth, maxY)

  // Draw running footers with total page count
  drawFooters(doc)

  const sanitizedTitle = (options.title || 'response')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)

  const filename = `helfen-${sanitizedTitle}-${Date.now().toString().slice(-4)}.pdf`
  doc.save(filename)
}
