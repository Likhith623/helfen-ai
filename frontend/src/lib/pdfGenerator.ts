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
 * Generates and downloads a multi-page PDF of an assistant response
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
  const contentWidth = pageWidth - 36 // 18mm margins on left & right
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
    const promptBoxHeight = promptLines.length * 5 + 6

    doc.roundedRect(18, currentY, contentWidth, promptBoxHeight, 2, 2, 'FD')
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9.5)
    doc.setTextColor(70, 75, 85)
    doc.text(promptLines, 22, currentY + 5)

    currentY += promptBoxHeight + 8
  }

  // Response Body
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(33, 37, 41)

  const bodyLines = doc.splitTextToSize(content, contentWidth)
  const lineHeight = 5.5

  for (let i = 0; i < bodyLines.length; i++) {
    if (currentY + lineHeight > maxY) {
      doc.addPage()
      // Top accent bar on subsequent pages
      doc.setFillColor(66, 133, 244)
      doc.rect(0, 0, pageWidth, 3, 'F')
      currentY = 20
    }
    doc.text(bodyLines[i], 18, currentY)
    currentY += lineHeight
  }

  // Draw running footers with total page count
  drawFooters(doc)

  const sanitizedTitle = (options.title || 'response')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)

  const filename = `helfen-${sanitizedTitle}-${Date.now().toString().slice(-4)}.pdf`
  doc.save(filename)
}
