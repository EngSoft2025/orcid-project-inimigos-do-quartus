// Utilities for fetching data from external academic platforms

interface SemanticScholarAuthor {
  authorId: string
  name: string
  paperCount: number
  citationCount: number
  hIndex: number
  papers?: Array<{
    paperId: string
    title: string
    year: number
    citationCount: number
    venue: string
  }>
}

interface SemanticScholarResponse {
  data: SemanticScholarAuthor[]
}

interface CrossRefResponse {
  status: string
  message: {
    items: Array<{
      title: string[]
      published: {
        'date-parts': number[][]
      }
      'container-title': string[]
      'is-referenced-by-count': number
      DOI: string
    }>
  }
}

// Enhanced cache with better organization
const cache = new Map<string, any>()
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes - longer cache for external APIs
const SEMANTIC_SCHOLAR_CACHE = new Map<string, any>()
const CROSSREF_CACHE = new Map<string, any>()

// Configuration for API requests with better resilience
const API_CONFIG = {
  timeout: 8000, // 8 seconds - increased for better reliability
  maxRetries: 2, // Reduced retries for faster response
  retryDelay: 500, // Faster retry
  semanticScholarDelay: 1000, // Rate limiting for Semantic Scholar
  crossRefDelay: 500, // Rate limiting for CrossRef
}

let lastSemanticScholarCall = 0
let lastCrossRefCall = 0

function getCacheKey(platform: string, query: string): string {
  return `${platform}:${encodeURIComponent(query.toLowerCase())}`
}

function getFromCache(key: string, specificCache?: Map<string, any>): any | null {
  const cacheToUse = specificCache || cache
  const cached = cacheToUse.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  cacheToUse.delete(key)
  return null
}

function setCache(key: string, data: any, specificCache?: Map<string, any>): void {
  const cacheToUse = specificCache || cache
  cacheToUse.set(key, { data, timestamp: Date.now() })
}

// Enhanced resilient request with exponential backoff
async function makeResilientRequest(url: string, options: RequestInit = {}, respectRateLimit: boolean = false): Promise<Response | null> {
  for (let attempt = 1; attempt <= API_CONFIG.maxRetries; attempt++) {
    try {
      // Rate limiting for specific services
      if (respectRateLimit) {
        if (url.includes('semanticscholar.org')) {
          const timeSinceLastCall = Date.now() - lastSemanticScholarCall
          if (timeSinceLastCall < API_CONFIG.semanticScholarDelay) {
            await new Promise(resolve => setTimeout(resolve, API_CONFIG.semanticScholarDelay - timeSinceLastCall))
          }
          lastSemanticScholarCall = Date.now()
        } else if (url.includes('crossref.org')) {
          const timeSinceLastCall = Date.now() - lastCrossRefCall
          if (timeSinceLastCall < API_CONFIG.crossRefDelay) {
            await new Promise(resolve => setTimeout(resolve, API_CONFIG.crossRefDelay - timeSinceLastCall))
          }
          lastCrossRefCall = Date.now()
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout)
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'ResearchersPlatform/1.0 (https://researchers-platform.com)',
          ...options.headers,
        }
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        return response
      }
      
      // Handle specific error codes
      if (response.status === 429) {
        console.warn(`Rate limit hit for ${url}`)
        const delay = API_CONFIG.retryDelay * Math.pow(2, attempt) + Math.random() * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      if (response.status >= 500) {
        console.warn(`Server error ${response.status} for ${url}`)
        if (attempt < API_CONFIG.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.retryDelay * attempt))
          continue
        }
      }
      
      // For 4xx errors, don't retry
      console.warn(`Client error ${response.status} for ${url}`)
      return null
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.warn(`Timeout on attempt ${attempt} for ${url}`)
        } else {
          console.warn(`Network error on attempt ${attempt} for ${url}:`, error.message)
        }
      }
      
      if (attempt === API_CONFIG.maxRetries) {
        return null
      }
      
      // Exponential backoff with jitter
      const delay = API_CONFIG.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 500
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return null
}

export async function searchSemanticScholar(authorName: string): Promise<SemanticScholarAuthor[]> {
  const cacheKey = getCacheKey('semantic-scholar-author', authorName)
  const cached = getFromCache(cacheKey, SEMANTIC_SCHOLAR_CACHE)
  if (cached) {
    console.log(`Using cached Semantic Scholar data for ${authorName}`)
    return cached
  }

  try {
    const response = await makeResilientRequest(
      `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(authorName)}&limit=3&fields=authorId,name,paperCount,citationCount,hIndex,papers.title,papers.year,papers.citationCount,papers.venue`,
      {},
      true // Respect rate limit
    )
    
    if (!response) {
      console.warn(`Semantic Scholar API failed for ${authorName}`)
      return []
    }
    
    const data: SemanticScholarResponse = await response.json()
    const result = data.data || []
    
    console.log(`Semantic Scholar found ${result.length} authors for ${authorName}`)
    setCache(cacheKey, result, SEMANTIC_SCHOLAR_CACHE)
    return result
  } catch (error) {
    console.error(`Semantic Scholar API error for ${authorName}:`, error)
    return []
  }
}

export async function searchCrossRef(authorName: string): Promise<any[]> {
  const cacheKey = getCacheKey('crossref-author', authorName)
  const cached = getFromCache(cacheKey, CROSSREF_CACHE)
  if (cached) {
    console.log(`Using cached CrossRef data for ${authorName}`)
    return cached
  }

  try {
    const response = await makeResilientRequest(
      `https://api.crossref.org/works?query.author=${encodeURIComponent(authorName)}&rows=10&select=title,published,container-title,is-referenced-by-count,DOI&sort=is-referenced-by-count&order=desc`,
      {
        headers: {
          'User-Agent': 'ResearchersPlatform/1.0 (mailto:contact@researchers-platform.com)'
        }
      },
      true // Respect rate limit
    )
    
    if (!response) {
      console.warn(`CrossRef API failed for ${authorName}`)
      return []
    }
    
    const data: CrossRefResponse = await response.json()
    const result = data.message?.items || []
    
    console.log(`CrossRef found ${result.length} works for ${authorName}`)
    setCache(cacheKey, result, CROSSREF_CACHE)
    return result
  } catch (error) {
    console.error(`CrossRef API error for ${authorName}:`, error)
    return []
  }
}

export async function getGoogleScholarMetrics(authorName: string): Promise<{ citationCount: number | string; hIndex: number | string }> {
  // Google Scholar doesn't have a public API, so we use Semantic Scholar as alternative
  try {
    const semanticData = await searchSemanticScholar(authorName)
    if (semanticData.length > 0) {
      // Find the best match (exact name match preferred)
      const exactMatch = semanticData.find(author => 
        author.name.toLowerCase() === authorName.toLowerCase()
      )
      const author = exactMatch || semanticData[0]
      
      return {
        citationCount: formatDataOrDash(author.citationCount),
        hIndex: formatDataOrDash(author.hIndex)
      }
    }
  } catch (error) {
    console.error(`Error getting metrics for ${authorName}:`, error)
  }
  
  return {
    citationCount: "-",
    hIndex: "-"
  }
}

export function calculateHIndex(citationCounts: number[]): number {
  if (citationCounts.length === 0) return 0
  
  const sortedCitations = citationCounts.sort((a, b) => b - a)
  let hIndex = 0
  
  for (let i = 0; i < sortedCitations.length; i++) {
    if (sortedCitations[i] >= i + 1) {
      hIndex = i + 1
    } else {
      break
    }
  }
  
  return hIndex
}

export function formatDataOrDash<T>(value: T | null | undefined): T | string {
  if (value === null || value === undefined || value === 0 || value === '') {
    return "-"
  }
  return value
}

// Enhanced function with better matching and fallback strategies
export async function enrichWithExternalData(
  authorName: string,
  orcidData: {
    publications: any[]
    totalCitations: number
    hIndex: number
  }
): Promise<{
  publications: any[]
  totalCitations: number | string
  hIndex: number | string
  enhancedWith: string[]
  enrichmentErrors?: string[]
}> {
  const enhancedWith: string[] = []
  const enrichmentErrors: string[] = []
  let { publications, totalCitations, hIndex } = orcidData
  let enhancedTotalCitations: number | string = totalCitations
  let enhancedHIndex: number | string = hIndex

  console.log(`Enriching data for ${authorName}...`)

  // Parallel execution of external API calls for better performance
  const [semanticResults, crossrefResults] = await Promise.allSettled([
    searchSemanticScholar(authorName),
    searchCrossRef(authorName)
  ])

  // Process Semantic Scholar results
  if (semanticResults.status === 'fulfilled' && semanticResults.value.length > 0) {
    try {
      // Find best matching author
      const authors = semanticResults.value
      const exactMatch = authors.find(author => 
        author.name.toLowerCase().includes(authorName.toLowerCase()) ||
        authorName.toLowerCase().includes(author.name.toLowerCase())
      )
      const author = exactMatch || authors[0]
      
      console.log(`Semantic Scholar match: ${author.name} (${author.paperCount} papers, ${author.citationCount} citations)`)
      
      // Use Semantic Scholar data if ORCID data is missing or incomplete
      if (totalCitations === 0 && author.citationCount > 0) {
        enhancedTotalCitations = author.citationCount
        enhancedWith.push('Semantic Scholar')
      }
      
      if (hIndex === 0 && author.hIndex > 0) {
        enhancedHIndex = author.hIndex
        if (!enhancedWith.includes('Semantic Scholar')) {
          enhancedWith.push('Semantic Scholar')
        }
      }
      
      // Enrich publications if needed
      if (publications.length === 0 && author.papers && author.papers.length > 0) {
        publications = author.papers.slice(0, 20).map((paper: any) => ({
          title: paper.title || "Título não disponível",
          year: paper.year || new Date().getFullYear(),
          journal: paper.venue || "Revista não informada",
          citations: formatDataOrDash(paper.citationCount),
          doi: undefined
        }))
        if (!enhancedWith.includes('Semantic Scholar')) {
          enhancedWith.push('Semantic Scholar')
        }
      }

      // Enrich publications with citation data from external sources
      if (author.papers && author.papers.length > 0) {
        // Try to match publications by title similarity
        const enrichedPublications = publications.map(orcidPub => {
          // Find matching paper from Semantic Scholar
          const matchingPaper = author.papers?.find(semanticPaper => {
            const orcidTitle = orcidPub.title.toLowerCase().replace(/[^\w\s]/g, '').trim()
            const semanticTitle = semanticPaper.title?.toLowerCase().replace(/[^\w\s]/g, '').trim()
            
            // Check for exact match or significant overlap
            if (orcidTitle === semanticTitle) return true
            
            // Check for substantial title overlap (80% similarity)
            const words1 = orcidTitle.split(/\s+/).filter((w: string) => w.length > 3)
            const words2 = semanticTitle?.split(/\s+/).filter((w: string) => w.length > 3) || []
            
            if (words1.length === 0 || words2.length === 0) return false
            
            const commonWords = words1.filter((word: string) => words2.includes(word))
            const similarity = commonWords.length / Math.max(words1.length, words2.length)
            
            return similarity >= 0.8
          })
          
          if (matchingPaper && matchingPaper.citationCount > 0) {
            return {
              ...orcidPub,
              citations: matchingPaper.citationCount
            }
          }
          
          return orcidPub
        })
        
        // Count how many publications got enriched
        const enrichedCount = enrichedPublications.filter(pub => 
          typeof pub.citations === 'number' && pub.citations > 0
        ).length
        
        if (enrichedCount > 0) {
          publications = enrichedPublications
          console.log(`Semantic Scholar enriched ${enrichedCount} publications with citation data`)
        }
      }
      
    } catch (error) {
      console.error('Error processing Semantic Scholar data:', error)
      enrichmentErrors.push('Semantic Scholar processing error')
    }
  } else if (semanticResults.status === 'rejected') {
    console.error('Semantic Scholar request failed:', semanticResults.reason)
    enrichmentErrors.push('Semantic Scholar unavailable')
  }

  // Process CrossRef results for enrichment
  if (crossrefResults.status === 'fulfilled' && crossrefResults.value.length > 0) {
    try {
      const works = crossrefResults.value
      console.log(`CrossRef found ${works.length} works`)
      
      // If no publications from ORCID, use CrossRef data
      if (publications.length === 0) {
        publications = works.slice(0, 15).map((item: any) => ({
          title: item.title?.[0] || "Título não disponível",
          year: item.published?.['date-parts']?.[0]?.[0] || new Date().getFullYear(),
          journal: item['container-title']?.[0] || "Revista não informada",
          citations: formatDataOrDash(item['is-referenced-by-count']),
          doi: item.DOI
        }))
        
        enhancedWith.push('CrossRef')
      } else {
        // Enrich existing publications with CrossRef citation data
        const enrichedPublications = publications.map(orcidPub => {
          // Skip if already has citation data
          if (typeof orcidPub.citations === 'number' && orcidPub.citations > 0) {
            return orcidPub
          }
          
          // Find matching work from CrossRef
          const matchingWork = works.find(crossrefWork => {
            const orcidTitle = orcidPub.title.toLowerCase().replace(/[^\w\s]/g, '').trim()
            const crossrefTitle = crossrefWork.title?.[0]?.toLowerCase().replace(/[^\w\s]/g, '').trim()
            
            if (!crossrefTitle) return false
            
            // Check for exact match or significant overlap
            if (orcidTitle === crossrefTitle) return true
            
            // Check for substantial title overlap (70% similarity for CrossRef due to potential formatting differences)
            const words1 = orcidTitle.split(/\s+/).filter((w: string) => w.length > 3)
            const words2 = crossrefTitle.split(/\s+/).filter((w: string) => w.length > 3)
            
            if (words1.length === 0 || words2.length === 0) return false
            
            const commonWords = words1.filter((word: string) => words2.includes(word))
            const similarity = commonWords.length / Math.max(words1.length, words2.length)
            
            return similarity >= 0.7
          })
          
          if (matchingWork && matchingWork['is-referenced-by-count'] > 0) {
            return {
              ...orcidPub,
              citations: matchingWork['is-referenced-by-count'],
              doi: orcidPub.doi || matchingWork.DOI
            }
          }
          
          return orcidPub
        })
        
        // Count how many publications got enriched
        const enrichedCount = enrichedPublications.filter((pub, index) => 
          typeof pub.citations === 'number' && pub.citations > 0 && 
          (typeof publications[index].citations !== 'number' || publications[index].citations === 0)
        ).length
        
        if (enrichedCount > 0) {
          publications = enrichedPublications
          console.log(`CrossRef enriched ${enrichedCount} publications with citation data`)
          if (!enhancedWith.includes('CrossRef')) {
            enhancedWith.push('CrossRef')
          }
        }
      }
      
      // Calculate total citations from CrossRef if needed
      const needsCitationData = (typeof enhancedTotalCitations === 'number' && enhancedTotalCitations === 0) || 
                                (typeof enhancedTotalCitations === 'string' && enhancedTotalCitations === "-")
      if (needsCitationData) {
        const totalFromCrossRef = works.reduce((sum: number, item: any) => 
          sum + (item['is-referenced-by-count'] || 0), 0)
        if (totalFromCrossRef > 0) {
          enhancedTotalCitations = totalFromCrossRef
        }
      }
      
    } catch (error) {
      console.error('Error processing CrossRef data:', error)
      enrichmentErrors.push('CrossRef processing error')
    }
  } else if (crossrefResults.status === 'rejected') {
    console.error('CrossRef request failed:', crossrefResults.reason)
    enrichmentErrors.push('CrossRef unavailable')
  }

  // Calculate hIndex from publications if still needed
  const needsHIndexData = (typeof enhancedHIndex === 'number' && enhancedHIndex === 0) || 
                         (typeof enhancedHIndex === 'string' && enhancedHIndex === "-")
  if (needsHIndexData && publications.length > 0) {
    const citationCounts = publications
      .map(p => typeof p.citations === 'number' ? p.citations : 0)
      .filter(c => c > 0)
    
    if (citationCounts.length > 0) {
      enhancedHIndex = calculateHIndex(citationCounts)
    }
  }

  // Calculate total citations from publications if still needed
  const needsTotalCitationData = (typeof enhancedTotalCitations === 'number' && enhancedTotalCitations === 0) || 
                                (typeof enhancedTotalCitations === 'string' && enhancedTotalCitations === "-")
  if (needsTotalCitationData && publications.length > 0) {
    const citationSum = publications
      .map(p => typeof p.citations === 'number' ? p.citations : 0)
      .reduce((sum, citations) => sum + citations, 0)
    
    if (citationSum > 0) {
      enhancedTotalCitations = citationSum
    }
  }

  // Apply formatting to ensure "-" for missing data
  const result = {
    publications,
    totalCitations: formatDataOrDash(enhancedTotalCitations),
    hIndex: formatDataOrDash(enhancedHIndex),
    enhancedWith
  }

  console.log(`Enrichment complete for ${authorName}. Enhanced with: ${enhancedWith.join(', ') || 'none'}`)

  // Only include enrichmentErrors if there were any
  if (enrichmentErrors.length > 0) {
    return { ...result, enrichmentErrors }
  }
  
  return result
}