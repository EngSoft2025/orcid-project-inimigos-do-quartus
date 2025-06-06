import { type NextRequest, NextResponse } from "next/server"
import jsPDF from 'jspdf'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const orcidId = id

    // Fetch researcher data
    const researcherResponse = await fetch(`${request.nextUrl.origin}/api/researcher/${orcidId}`)
    if (!researcherResponse.ok) {
      return NextResponse.json({ error: "Researcher not found" }, { status: 404 })
    }

    const researcher = await researcherResponse.json()

    // Generate PDF using jsPDF
    const pdfBuffer = generateProfessionalPDF(researcher)

    const response = new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(researcher.name)}-curriculo.pdf"`,
      },
    })

    return response

  } catch (error) {
    console.error("PDF export error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateProfessionalPDF(researcher: any): Buffer {
  const doc = new jsPDF()
  
  // Set up fonts and styling
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let yPosition = margin + 10

  // Helper function to add new page if needed
  const checkPageBreak = (neededHeight: number = 15) => {
    if (yPosition + neededHeight > pageHeight - margin) {
      doc.addPage()
      yPosition = margin + 10
      return true
    }
    return false
  }

  // Helper function to add wrapped text
  const addWrappedText = (text: string, x: number, fontSize: number = 10, fontStyle: string = 'normal', maxWidth?: number) => {
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', fontStyle)
    
    const textWidth = maxWidth || contentWidth
    const lines = doc.splitTextToSize(text, textWidth)
    
    lines.forEach((line: string, index: number) => {
      checkPageBreak()
      doc.text(line, x, yPosition)
      yPosition += fontSize * 0.6 // Line height
    })
    
    return lines.length
  }

  // Helper function to add section title
  const addSectionTitle = (title: string) => {
    checkPageBreak(25)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin, yPosition)
    yPosition += 15
  }

  // Header
  doc.setFillColor(41, 128, 185)
  doc.rect(0, 0, pageWidth, 30, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('CURRÍCULO ACADÊMICO', margin, 20)
  
  yPosition = 45
  doc.setTextColor(0, 0, 0)

  // Personal Information Section
  addSectionTitle('INFORMAÇÕES PESSOAIS')

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  
  // Name
  addWrappedText(`Nome: ${researcher.name || 'Não informado'}`, margin, 11)
  yPosition += 3
  
  // ORCID ID
  addWrappedText(`ORCID ID: ${researcher.orcidId}`, margin, 11)
  yPosition += 3
  
  // Country
  addWrappedText(`País: ${researcher.country || 'Não informado'}`, margin, 11)
  yPosition += 3
  
  // Email (if available)
  if (researcher.email) {
    addWrappedText(`Email: ${researcher.email}`, margin, 11)
    yPosition += 3
  }
  
  // Website (if available)
  if (researcher.website) {
    addWrappedText(`Website: ${researcher.website}`, margin, 11)
    yPosition += 3
  }

  yPosition += 10

  // Academic Metrics Section
  addSectionTitle('MÉTRICAS ACADÊMICAS')

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  
  addWrappedText(`• Total de Citações: ${researcher.totalCitations || '-'}`, margin, 11)
  yPosition += 3
  addWrappedText(`• Índice H: ${researcher.hIndex || '-'}`, margin, 11)
  yPosition += 3
  addWrappedText(`• Número de Publicações: ${researcher.publications?.length || 0}`, margin, 11)
  yPosition += 10

  // Biography Section (if available)
  if (researcher.biography && researcher.biography.trim()) {
    addSectionTitle('BIOGRAFIA')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    addWrappedText(researcher.biography, margin)
    yPosition += 10
  }

  // Keywords Section
  if (researcher.keywords && researcher.keywords.length > 0) {
    addSectionTitle('ÁREAS DE EXPERTISE')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const keywordsText = researcher.keywords.join(', ')
    addWrappedText(keywordsText, margin)
    yPosition += 10
  }

  // Employment Section
  if (researcher.employments && researcher.employments.length > 0) {
    addSectionTitle('AFILIAÇÕES PROFISSIONAIS')

    researcher.employments.slice(0, 10).forEach((emp: any) => {
      checkPageBreak(30)
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      addWrappedText(`• ${emp.role || 'Cargo não informado'}`, margin, 11, 'bold')
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      addWrappedText(`  ${emp.organization || 'Organização não informada'}`, margin + 5, 10)
      
      if (emp.startDate || emp.endDate) {
        const period = `${emp.startDate || ''} - ${emp.endDate || 'Presente'}`
        addWrappedText(`  Período: ${period}`, margin + 5, 10)
      }
      
      yPosition += 5
    })
    yPosition += 5
  }

  // Education Section
  if (researcher.educations && researcher.educations.length > 0) {
    addSectionTitle('FORMAÇÃO ACADÊMICA')

    researcher.educations.slice(0, 10).forEach((edu: any) => {
      checkPageBreak(25)
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      addWrappedText(`• ${edu.degree || 'Título não informado'}`, margin, 11, 'bold')
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      addWrappedText(`  ${edu.organization || 'Instituição não informada'}`, margin + 5, 10)
      
      if (edu.year) {
        addWrappedText(`  Ano: ${edu.year}`, margin + 5, 10)
      }
      
      yPosition += 5
    })
    yPosition += 5
  }

  // Publications Section
  if (researcher.publications && researcher.publications.length > 0) {
    addSectionTitle('PUBLICAÇÕES')

    researcher.publications.forEach((pub: any, index: number) => {
      checkPageBreak(35)
      
      // Publication number and title
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      addWrappedText(`${index + 1}. ${pub.title || 'Título não disponível'}`, margin, 10, 'bold')
      
      // Journal and year
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const journalInfo = `Revista: ${pub.journal || 'Não informada'} | Ano: ${pub.year || 'Não informado'}`
      addWrappedText(journalInfo, margin + 5, 9)
      
      // Citations
      const citations = typeof pub.citations === 'number' ? pub.citations : (pub.citations || '-')
      addWrappedText(`Citações: ${citations}`, margin + 5, 9)
      
      // DOI (if available)
      if (pub.doi) {
        addWrappedText(`DOI: ${pub.doi}`, margin + 5, 9)
      }
      
      yPosition += 8
    })
  }

  // Footer with generation date
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128, 128, 128)
    
    const footerText = `Gerado em ${new Date().toLocaleDateString('pt-BR')} - Página ${i} de ${pageCount}`
    doc.text(footerText, margin, pageHeight - 10)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
}
