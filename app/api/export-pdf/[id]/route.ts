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

  const checkPageBreak = (neededHeight: number = 15) => {
    if (yPosition + neededHeight > pageHeight - margin) {
      doc.addPage()
      yPosition = margin + 10
      return true
    }
    return false
  }

  // Helper function to add wrapped text - REDUZIDO
  const addWrappedText = (text: string, x: number, fontSize: number = 9, fontStyle: string = 'normal', maxWidth?: number) => {
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', fontStyle)
    
    const textWidth = maxWidth || contentWidth
    const lines = doc.splitTextToSize(text, textWidth)
    
    // LIMITAR A 3 LINHAS MÁXIMO
    const limitedLines = lines.slice(0, 3)
    
    limitedLines.forEach((line: string, index: number) => {
      checkPageBreak()
      doc.text(line, x, yPosition)
      yPosition += fontSize * 0.5 // Reduzir espaçamento
    })
    
    return limitedLines.length
  }

  // Helper function to add section title - MENOR
  const addSectionTitle = (title: string) => {
    checkPageBreak(20)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin, yPosition)
    yPosition += 10 // Reduzir espaçamento
  }

  // Header
  doc.setFillColor(41, 128, 185)
  doc.rect(0, 0, pageWidth, 25, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('CURRÍCULO ACADÊMICO', margin, 17)
  
  yPosition = 35
  doc.setTextColor(0, 0, 0)

  // Personal Information Section
  addSectionTitle('DADOS PESSOAIS')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  // Name and ORCID
  addWrappedText(`${researcher.name || 'Não informado'} | ORCID: ${researcher.orcidId}`, margin, 10)
  addWrappedText(`País: ${researcher.country || 'Não informado'}`, margin, 10)
  
  // Email
  if (researcher.email) {
    addWrappedText(`Email: ${researcher.email}`, margin, 10)
  }

  yPosition += 8

  // Academic Metrics Section - COMPACTO
  addSectionTitle('MÉTRICAS ACADÊMICAS')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  const metrics = [
    `Citações: ${researcher.totalCitations || '-'}`,
    `Índice H: ${researcher.hIndex || '-'}`,
    `Publicações: ${researcher.publications?.length || 0}`
  ].join(' | ')
  
  addWrappedText(metrics, margin, 10)
  yPosition += 8

  // Keywords Section
  if (researcher.keywords && researcher.keywords.length > 0) {
    addSectionTitle('ÁREAS DE EXPERTISE')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const limitedKeywords = researcher.keywords.slice(0, 10).join(', ')
    addWrappedText(limitedKeywords, margin)
    yPosition += 8
  }

  // Employment Section
  if (researcher.employments && researcher.employments.length > 0) {
    addSectionTitle('AFILIAÇÕES PRINCIPAIS')

    researcher.employments.slice(0, 3).forEach((emp: any) => {
      checkPageBreak(20)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      addWrappedText(`${emp.role || 'Cargo não informado'}`, margin, 10, 'bold')
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const orgInfo = `${emp.organization || 'Organização não informada'}`
      if (emp.startDate || emp.endDate) {
        const period = `(${emp.startDate || ''} - ${emp.endDate || 'Presente'})`
        addWrappedText(`${orgInfo} ${period}`, margin + 5, 9)
      } else {
        addWrappedText(orgInfo, margin + 5, 9)
      }
      
      yPosition += 3
    })
    yPosition += 5
  }

  // Education Section
  if (researcher.educations && researcher.educations.length > 0) {
    addSectionTitle('FORMAÇÃO ACADÊMICA')

    researcher.educations.slice(0, 3).forEach((edu: any) => {
      checkPageBreak(15)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      addWrappedText(`${edu.degree || 'Título não informado'}`, margin, 10, 'bold')
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const eduInfo = `${edu.organization || 'Instituição não informada'}${edu.year ? ` (${edu.year})` : ''}`
      addWrappedText(eduInfo, margin + 5, 9)
      
      yPosition += 3
    })
    yPosition += 5
  }

  // Publications Section
  if (researcher.publications && researcher.publications.length > 0) {
    addSectionTitle('PRINCIPAIS PUBLICAÇÕES')
    
    const topPublications = researcher.publications
      .sort((a: any, b: any) => {
        const aCitations = typeof a.citations === 'number' ? a.citations : 0
        const bCitations = typeof b.citations === 'number' ? b.citations : 0
        return bCitations - aCitations
      })
      .slice(0, 5)

    topPublications.forEach((pub: any, index: number) => {
      checkPageBreak(25)
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      addWrappedText(`${index + 1}. ${pub.title || 'Título não disponível'}`, margin, 9, 'bold')
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const pubInfo = [
        pub.journal || 'Revista não informada',
        pub.year || 'Ano não informado',
        `Citações: ${pub.citations || '-'}`
      ].join(' | ')
      
      addWrappedText(pubInfo, margin + 5, 8)
      yPosition += 5
    })
  }

  // Biography Section
  if (researcher.biography && researcher.biography.trim()) {
    addSectionTitle('RESUMO PROFISSIONAL')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    
    let extendedBio = researcher.biography
    
    // If the biography is too short, try to supplement it with information about affiliations.
    if (extendedBio.length < 300 && researcher.employments && researcher.employments.length > 0) {
      const currentEmployment = researcher.employments[0]
      if (currentEmployment && currentEmployment.organization) {
        extendedBio += ` Atualmente vinculado(a) à ${currentEmployment.organization}`
        if (currentEmployment.role) {
          extendedBio += ` como ${currentEmployment.role}`
        }
        extendedBio += '.'
      }
    }
    
    // If it is still short, add information about research areas
    if (extendedBio.length < 400 && researcher.keywords && researcher.keywords.length > 0) {
      const mainKeywords = researcher.keywords.slice(0, 5).join(', ')
      extendedBio += ` Suas principais áreas de pesquisa incluem: ${mainKeywords}.`
    }
    
    // Add information about academic production if available
    if (extendedBio.length < 500 && researcher.publications && researcher.publications.length > 0) {
      const publicationCount = researcher.publications.length
      const totalCitations = researcher.totalCitations || 0
      
      if (publicationCount > 0) {
        extendedBio += ` Possui ${publicationCount} publicação${publicationCount > 1 ? 'ões' : ''} registrada${publicationCount > 1 ? 's' : ''}`
        
        if (totalCitations > 0) {
          extendedBio += ` com um total de ${totalCitations} citação${totalCitations > 1 ? 'ões' : ''}`
        }
        
        if (researcher.hIndex && researcher.hIndex !== '-') {
          extendedBio += ` e índice H de ${researcher.hIndex}`
        }
        
        extendedBio += '.'
      }
    }
    
    // Limit to 800 characters but in an intelligent way
    if (extendedBio.length > 800) {
      let truncated = extendedBio.substring(0, 800)
      const lastPeriod = truncated.lastIndexOf('.')
      const lastExclamation = truncated.lastIndexOf('!')
      const lastQuestion = truncated.lastIndexOf('?')
      
      const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion)
      
      if (lastSentenceEnd > 600) {
        extendedBio = truncated.substring(0, lastSentenceEnd + 1)
      } else {
        extendedBio = truncated + '...'
      }
    }
    
    // Break text into paragraphs if it is too long
    const sentences = extendedBio.split(/[.!?]+/).filter((s: string) => s.trim().length > 0)
    
    if (sentences.length > 3) {
      const firstParagraph = sentences.slice(0, 2).join('. ') + '.'
      const secondParagraph = sentences.slice(2).join('. ') + '.'
      
      addWrappedText(firstParagraph, margin, 9, 'normal', contentWidth)
      yPosition += 3
      
      if (secondParagraph.trim().length > 1) {
        checkPageBreak(15)
        addWrappedText(secondParagraph, margin, 9, 'normal', contentWidth)
      }
    } else {
      addWrappedText(extendedBio, margin, 9, 'normal', contentWidth)
    }
    
    yPosition += 8
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128, 128, 128)
    
    const footerText = `Gerado em ${new Date().toLocaleDateString('pt-BR')} - Pág. ${i}/${pageCount}`
    doc.text(footerText, margin, pageHeight - 8)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
}
