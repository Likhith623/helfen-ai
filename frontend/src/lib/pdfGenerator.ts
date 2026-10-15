import jsPDF from 'jspdf'

export interface PdfExportOptions {
  title?: string
  prompt?: string
  model?: string
  createdAt?: string
}

/**
 * Generates and downloads a PDF of an assistant response
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

  const title = options.title || 'Helfen AI Response'
  const model = options.model || 'llama3.2:3b'
  const dateStr = options.createdAt
    ? new Date(options.createdAt).toLocaleString()
    : new Date().toLocaleString()

  // Base setup
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(16)
  doc.text(title, 20, 25)

  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text(`Model: ${model} | Generated: ${dateStr}`, 20, 32)

  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  const lines = doc.splitTextToSize(content, 170)
  doc.text(lines, 20, 45)

  const filename = `helfen-response-${Date.now()}.pdf`
  doc.save(filename)
}
