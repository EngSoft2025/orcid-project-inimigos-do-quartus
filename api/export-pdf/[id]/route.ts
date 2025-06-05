import { type NextRequest, NextResponse } from "next/server"

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

    // Generate PDF content using a proper PDF structure with UTF-8 support
    const pdfContent = generateProfessionalPDF(researcher)

    const response = new NextResponse(pdfContent, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${researcher.name.replace(/[^a-zA-Z0-9-_\s]/g, "_")}-curriculo.pdf"`,
        "Content-Transfer-Encoding": "binary",
      },
    })

    return response
  } catch (error) {
    console.error("PDF export error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateProfessionalPDF(researcher: any): Buffer {
  // Create PDF content with proper UTF-8 encoding and better character support
  const contentBody = `BT
/F2 16 Tf
50 750 Td
(CURRÍCULO ACADÊMICO) Tj
0 -30 Td
/F2 14 Tf
(Nome: ${sanitizeTextForPDF(researcher.name)}) Tj
0 -20 Td
(ORCID ID: ${researcher.orcidId}) Tj
0 -20 Td
(País: ${sanitizeTextForPDF(researcher.country)}) Tj
${researcher.website ? `0 -20 Td
(Website: ${researcher.website}) Tj` : ''}
${researcher.email ? `0 -20 Td
(Email: ${researcher.email}) Tj` : ''}

0 -40 Td
/F2 12 Tf
(BIOGRAFIA) Tj
0 -5 Td
(________________________________________________) Tj
0 -20 Td
/F1 10 Tf
${generateBiographyText(researcher.biography)}

0 -30 Td
/F2 12 Tf
(MÉTRICAS ACADÊMICAS) Tj
0 -5 Td
(________________________________________________) Tj
0 -20 Td
/F1 10 Tf
(• Total de Citações: ${researcher.totalCitations || '-'}) Tj
0 -15 Td
(• Índice H: ${researcher.hIndex || '-'}) Tj
0 -15 Td
(• Número de Publicações: ${researcher.publications?.length || 0}) Tj

0 -30 Td
/F2 12 Tf
(ÁREAS DE EXPERTISE) Tj
0 -5 Td
(________________________________________________) Tj
0 -20 Td
/F1 10 Tf
${generateKeywordsText(researcher.keywords)}

${researcher.employments && researcher.employments.length > 0 ? `
0 -30 Td
/F2 12 Tf
(AFILIAÇÕES PROFISSIONAIS) Tj
0 -5 Td
(________________________________________________) Tj
0 -20 Td
/F1 10 Tf
${generateEmploymentsText(researcher.employments)}` : ''}

${researcher.educations && researcher.educations.length > 0 ? `
0 -30 Td
/F2 12 Tf
(FORMAÇÃO ACADÊMICA) Tj
0 -5 Td
(________________________________________________) Tj
0 -20 Td
/F1 10 Tf
${generateEducationsText(researcher.educations)}` : ''}

0 -30 Td
/F2 12 Tf
(PUBLICAÇÕES) Tj
0 -5 Td
(________________________________________________) Tj
${generatePublicationsText(researcher.publications)}
ET`

  const pdfHeader = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 5 0 R
    /F2 6 0 R
  >>
>>
>>
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
/Encoding /WinAnsiEncoding
>>
endobj

6 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
/Encoding /WinAnsiEncoding
>>
endobj

4 0 obj
<<
/Length ${contentBody.length}
>>
stream
${contentBody}
endstream
endobj

xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
0000000301 00000 n 
0000000398 00000 n 
0000000520 00000 n 
trailer
<<
/Size 7
/Root 1 0 R
>>
startxref`

  const content: string = `${pdfHeader}
${pdfHeader.length + contentBody.length + 400}
%%EOF`

  return Buffer.from(content, 'latin1')
}

function sanitizeTextForPDF(text: string): string {
  if (!text) return ''
  
  // Map common Portuguese characters to their closest ASCII equivalents
  const charMap: { [key: string]: string } = {
    'á': 'á', 'à': 'à', 'ã': 'ã', 'â': 'â',
    'Á': 'Á', 'À': 'À', 'Ã': 'Ã', 'Â': 'Â',
    'é': 'é', 'ê': 'ê',
    'É': 'É', 'Ê': 'Ê',
    'í': 'í', 'Í': 'Í',
    'ó': 'ó', 'ô': 'ô', 'õ': 'õ',
    'Ó': 'Ó', 'Ô': 'Ô', 'Õ': 'Õ',
    'ú': 'ú', 'Ú': 'Ú',
    'ç': 'ç', 'Ç': 'Ç',
    'ñ': 'ñ', 'Ñ': 'Ñ'
  }
  
  return text
    .split('')
    .map(char => charMap[char] || char)
    .join('')
    .replace(/[()\\]/g, '\\$&') // Escape PDF special characters
    .substring(0, 120) // Reasonable length limit
}

function calculateContentLength(researcher: any): number {
  // More accurate estimate for content length
  const baseLength = 2000
  const biographyLength = (researcher.biography || '').length
  const publicationsLength = (researcher.publications || []).length * 150
  const employmentLength = (researcher.employments || []).length * 80
  const educationLength = (researcher.educations || []).length * 60
  const keywordLength = (researcher.keywords || []).join(', ').length
  
  return baseLength + biographyLength + publicationsLength + employmentLength + educationLength + keywordLength
}

function generateBiographyText(biography: string): string {
  if (!biography) return '(Biografia não disponível) Tj'
  
  const sanitized = sanitizeTextForPDF(biography)
  const lines = splitIntoLines(sanitized, 80)
  
  return lines.map((line, index) => {
    if (index === 0) return `(${line}) Tj`
    return `0 -12 Td\n(${line}) Tj`
  }).join('\n')
}

function generateKeywordsText(keywords: string[]): string {
  if (!keywords || keywords.length === 0) {
    return '(Áreas de expertise não informadas) Tj'
  }
  
  const sanitizedKeywords = keywords.map(k => sanitizeTextForPDF(k)).filter(Boolean)
  const keywordText = sanitizedKeywords.join(', ')
  const lines = splitIntoLines(keywordText, 80)
  
  return lines.map((line, index) => {
    if (index === 0) return `(${line}) Tj`
    return `0 -12 Td\n(${line}) Tj`
  }).join('\n')
}

function generateEmploymentsText(employments: any[]): string {
  if (!employments || employments.length === 0) {
    return '(Afiliações não informadas) Tj'
  }
  
  return employments.slice(0, 10).map((emp, index) => {
    const role = sanitizeTextForPDF(emp.role || 'Cargo não informado')
    const org = sanitizeTextForPDF(emp.organization || 'Organização não informada')
    const period = emp.startDate || emp.endDate ? 
      `${emp.startDate || ''} - ${emp.endDate || 'Presente'}` : ''
    
    let text = index === 0 ? 
      `(• ${role}) Tj` : 
      `0 -12 Td\n(• ${role}) Tj`
    
    text += `\n0 -12 Td\n(  ${org}) Tj`
    
    if (period) {
      text += `\n0 -12 Td\n(  ${period}) Tj`
    }
    
    return text
  }).join('\n0 -15 Td\n')
}

function generateEducationsText(educations: any[]): string {
  if (!educations || educations.length === 0) {
    return '(Formação não informada) Tj'
  }
  
  return educations.slice(0, 10).map((edu, index) => {
    const degree = sanitizeTextForPDF(edu.degree || 'Título não informado')
    const org = sanitizeTextForPDF(edu.organization || 'Instituição não informada')
    const year = edu.year ? ` (${edu.year})` : ''
    
    const text = index === 0 ? 
      `(• ${degree}) Tj\n0 -12 Td\n(  ${org}${year}) Tj` : 
      `0 -12 Td\n(• ${degree}) Tj\n0 -12 Td\n(  ${org}${year}) Tj`
    
    return text
  }).join('\n0 -15 Td\n')
}

function generatePublicationsText(publications: any[]): string {
  if (!publications || publications.length === 0) {
    return '\n0 -20 Td\n/F1 10 Tf\n(Nenhuma publicação encontrada) Tj'
  }
  
  let yPosition = -20
  const pubTexts = publications.slice(0, 15).map((pub, index) => {
    const title = sanitizeTextForPDF(pub.title || 'Título não disponível')
    const journal = sanitizeTextForPDF(pub.journal || 'Revista não informada')
    const year = pub.year || 'Ano não informado'
    const citations = typeof pub.citations === 'number' ? pub.citations : (pub.citations || '-')
    
    let text = `0 ${yPosition} Td\n/F1 10 Tf\n(${index + 1}. ${title}) Tj`
    yPosition -= 12
    text += `\n0 -12 Td\n(   Revista: ${journal}) Tj`
    text += `\n0 -12 Td\n(   Ano: ${year} | Citações: ${citations}) Tj`
    
    if (pub.doi) {
      text += `\n0 -12 Td\n(   DOI: ${sanitizeTextForPDF(pub.doi)}) Tj`
    }
    
    yPosition -= 20
    
    return text
  })
  
  return pubTexts.join('\n')
}

function splitIntoLines(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  
  for (const word of words) {
    if ((currentLine + ' ' + word).length <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word.substring(0, maxChars) // Truncate very long words
    }
  }
  
  if (currentLine) lines.push(currentLine)
  return lines.filter(line => line.trim()) // Remove empty lines
}
