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
 * Renders structured markdown (headings, code blocks, lists, numbered lists, blockquotes, tables, paragraphs) into the PDF
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

  // Split lines while tracking blocks
  const lines = content.split('\n')
  let inCodeBlock = false
  let codeBuffer: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]

    // 1. Handle code block toggles
    if (rawLine.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block: render collected code
        if (codeBuffer.length > 0) {
          doc.setFont('courier', 'normal')
          doc.setFontSize(8.5)
          const codeLines: string[] = []
          codeBuffer.forEach((cLine) => {
            const wrapped = doc.splitTextToSize(cLine, contentWidth - 12)
            codeLines.push(...wrapped)
          })

          const boxHeight = codeLines.length * 4.2 + 6
          ensureSpace(boxHeight + 4)

          doc.setFillColor(243, 245, 249)
          doc.setDrawColor(215, 222, 235)
          doc.setLineWidth(0.3)
          doc.roundedRect(18, currentY, contentWidth, boxHeight, 2, 2, 'FD')

          doc.setTextColor(40, 44, 52)
          let codeY = currentY + 4.8
          for (const cL of codeLines) {
            doc.text(cL, 22, codeY)
            codeY += 4.2
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

    // 2. Empty line -> clean spacing
    if (!trimmed) {
      currentY += 2.5
      continue
    }

    // 3. Horizontal Rule
    if (trimmed === '---' || trimmed === '***') {
      ensureSpace(6)
      doc.setDrawColor(220, 225, 235)
      doc.setLineWidth(0.4)
      doc.line(18, currentY + 2, 18 + contentWidth, currentY + 2)
      currentY += 6
      continue
    }

    // 4. Structured Markdown Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      i-- // Rewind last increment from loop

      const dataRows: string[][] = []
      let colCount = 0

      for (const tLine of tableLines) {
        if (/^\|(\s*[-:]+[-|\s:]*)\|$/.test(tLine)) {
          continue // Skip markdown divider row like |---|---|
        }
        const cells = tLine
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim().replace(/\*\*(.*?)\*\*/g, '$1'))
        if (cells.length > colCount) colCount = cells.length
        dataRows.push(cells)
      }

      if (dataRows.length > 0 && colCount > 0) {
        const colWidth = contentWidth / colCount
        const rowHeight = 7.5

        dataRows.forEach((row, rowIdx) => {
          ensureSpace(rowHeight + 2)

          const isHeaderRow = rowIdx === 0
          if (isHeaderRow) {
            doc.setFillColor(238, 244, 255) // Clean blue-tint header
            doc.rect(18, currentY, contentWidth, rowHeight, 'F')
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8.5)
            doc.setTextColor(30, 64, 130)
          } else {
            if (rowIdx % 2 === 1) {
              doc.setFillColor(250, 251, 254) // Subtle zebra row
              doc.rect(18, currentY, contentWidth, rowHeight, 'F')
            }
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8.5)
            doc.setTextColor(45, 52, 65)
          }

          // Row bottom border
          doc.setDrawColor(225, 230, 240)
          doc.setLineWidth(0.2)
          doc.line(18, currentY + rowHeight, 18 + contentWidth, currentY + rowHeight)

          // Cell text
          for (let c = 0; c < colCount; c++) {
            const cellText = row[c] || ''
            const cellX = 18 + c * colWidth + 2.5
            const wrappedCell = doc.splitTextToSize(cellText, colWidth - 5)
            doc.text(wrappedCell[0] || cellText, cellX, currentY + 5)
          }

          currentY += rowHeight
        })

        currentY += 4
        continue
      }
    }

    // 5. Blockquotes / Callout Blocks
    if (trimmed.startsWith('> ') || trimmed === '>') {
      const quoteLines: string[] = []
      while (i < lines.length && (lines[i].trim().startsWith('> ') || lines[i].trim() === '>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      i--

      const quoteText = quoteLines.join(' ').replace(/\*\*(.*?)\*\*/g, '$1')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      const wrappedQuote = doc.splitTextToSize(quoteText, contentWidth - 14)
      const qBoxHeight = wrappedQuote.length * 4.6 + 6
      ensureSpace(qBoxHeight + 4)

      // Shaded callout background
      doc.setFillColor(247, 249, 253)
      doc.setDrawColor(226, 232, 244)
      doc.setLineWidth(0.3)
      doc.roundedRect(18, currentY, contentWidth, qBoxHeight, 2, 2, 'FD')

      // Left blue accent line
      doc.setFillColor(66, 133, 244)
      doc.rect(18, currentY, 2.5, qBoxHeight, 'F')

      doc.setTextColor(55, 65, 81)
      let qY = currentY + 4.8
      for (const ql of wrappedQuote) {
        doc.text(ql, 23, qY)
        qY += 4.6
      }
      currentY += qBoxHeight + 4
      continue
    }

    // 6. Heading 1 (#)
    if (trimmed.startsWith('# ')) {
      ensureSpace(14)
      currentY += 2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13.5)
      doc.setTextColor(24, 28, 36)
      const hText = trimmed.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')
      const hLines = doc.splitTextToSize(hText, contentWidth)
      for (const hl of hLines) {
        doc.text(hl, 18, currentY + 4)
        currentY += 6
      }
      // Accent underline
      doc.setFillColor(66, 133, 244)
      doc.rect(18, currentY + 1, 35, 1, 'F')
      currentY += 4
      continue
    }

    // 7. Heading 2 (##)
    if (trimmed.startsWith('## ')) {
      ensureSpace(11)
      currentY += 1.5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11.5)
      doc.setTextColor(30, 35, 45)
      const hText = trimmed.slice(3).replace(/\*\*(.*?)\*\*/g, '$1')
      const hLines = doc.splitTextToSize(hText, contentWidth)
      for (const hl of hLines) {
        doc.text(hl, 18, currentY + 3.5)
        currentY += 5.5
      }
      currentY += 2
      continue
    }

    // 8. Heading 3 (###)
    if (trimmed.startsWith('### ')) {
      ensureSpace(9)
      currentY += 1
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(45, 52, 65)
      const hText = trimmed.slice(4).replace(/\*\*(.*?)\*\*/g, '$1')
      const hLines = doc.splitTextToSize(hText, contentWidth)
      for (const hl of hLines) {
        doc.text(hl, 18, currentY + 3)
        currentY += 5
      }
      currentY += 1.5
      continue
    }

    // 9. Numbered Lists (1. Step description)
    const numListMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)/)
    if (numListMatch) {
      const numStr = numListMatch[1]
      const listText = numListMatch[2].replace(/\*\*(.*?)\*\*/g, '$1')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      const numLines = doc.splitTextToSize(listText, contentWidth - 11)
      ensureSpace(numLines.length * 4.8 + 2)

      // Draw numbered badge
      doc.setFillColor(235, 243, 255)
      doc.roundedRect(18, currentY + 0.5, 6, 4.4, 1.2, 1.2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(37, 99, 235)
      doc.text(numStr, 21, currentY + 3.6, { align: 'center' })

      // Text body
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(33, 37, 41)
      let nY = currentY + 3.6
      for (let ni = 0; ni < numLines.length; ni++) {
        doc.text(numLines[ni], 26, nY)
        nY += 4.8
      }
      currentY += numLines.length * 4.8 + 1.5
      continue
    }

    // 10. Bullet points (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bText = trimmed.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(33, 37, 41)

      const bLines = doc.splitTextToSize(bText, contentWidth - 8)
      ensureSpace(bLines.length * 4.8 + 2)

      // Draw custom accent bullet dot
      doc.setFillColor(66, 133, 244)
      doc.circle(20, currentY + 2.5, 0.9, 'F')

      let bY = currentY + 3.6
      for (const bl of bLines) {
        doc.text(bl, 24, bY)
        bY += 4.8
      }
      currentY += bLines.length * 4.8 + 1.2
      continue
    }

    // 11. Standard paragraph text
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(33, 37, 41)

    // Clean inline bold markers if simple
    const cleanedText = rawLine.replace(/\*\*(.*?)\*\*/g, '$1')
    const pLines = doc.splitTextToSize(cleanedText, contentWidth)
    ensureSpace(pLines.length * 4.8 + 1)

    let pY = currentY + 3.4
    for (const pl of pLines) {
      doc.text(pl, 18, pY)
      pY += 4.8
    }
    currentY += pLines.length * 4.8 + 1.5
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

export interface ConversationPdfExportOptions {
  title?: string
  model?: string
  createdAt?: string
}

/**
 * Generates and downloads a complete conversation thread as a styled PDF document
 */
export async function generateConversationPdf(
  messages: Array<{ role: string; content: string; created_at?: string; model?: string | null }>,
  options: ConversationPdfExportOptions = {}
): Promise<void> {
  if (!messages || messages.length === 0) return

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - 36 // 18mm margins
  const maxY = pageHeight - 20

  const title = options.title || 'Complete Chat Thread'
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

  for (let idx = 0; idx < messages.length; idx++) {
    const msg = messages[idx]

    if (msg.role === 'user') {
      const ensureSpace = (needed: number) => {
        if (currentY + needed > maxY) {
          doc.addPage()
          doc.setFillColor(66, 133, 244)
          doc.rect(0, 0, pageWidth, 3, 'F')
          currentY = 20
        }
      }

      const timeLabel = msg.created_at
        ? ` (${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
        : ''

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      const textLines = doc.splitTextToSize(msg.content, contentWidth - 10)
      const boxHeight = textLines.length * 4.8 + 10
      ensureSpace(boxHeight + 5)

      doc.setFillColor(243, 246, 252)
      doc.setDrawColor(218, 226, 240)
      doc.setLineWidth(0.3)
      doc.roundedRect(18, currentY, contentWidth, boxHeight, 2, 2, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(30, 80, 160)
      doc.text(`User${timeLabel}:`, 22, currentY + 5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(33, 37, 41)
      let lineY = currentY + 9.5
      for (const line of textLines) {
        doc.text(line, 22, lineY)
        lineY += 4.8
      }

      currentY += boxHeight + 5
    } else if (msg.role === 'assistant') {
      if (currentY + 12 > maxY) {
        doc.addPage()
        doc.setFillColor(66, 133, 244)
        doc.rect(0, 0, pageWidth, 3, 'F')
        currentY = 20
      }

      const timeLabel = msg.created_at
        ? ` • ${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : ''

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(66, 133, 244)
      doc.text(`Helfen.AI (${msg.model || model})${timeLabel}`, 18, currentY + 4)
      currentY += 6

      currentY = renderMarkdownContent(doc, msg.content, currentY, contentWidth, maxY)
      currentY += 6

      // Divider line between conversation turns if not the last
      if (idx < messages.length - 1) {
        if (currentY + 6 <= maxY) {
          doc.setDrawColor(230, 235, 245)
          doc.setLineWidth(0.3)
          doc.line(18, currentY, pageWidth - 18, currentY)
          currentY += 6
        }
      }
    }
  }

  drawFooters(doc)

  const sanitizedTitle = (options.title || 'conversation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)

  const filename = `helfen-thread-${sanitizedTitle}-${Date.now().toString().slice(-4)}.pdf`
  doc.save(filename)
}

