// Utilities for fetching data from ORCID and CrossRef

interface CrossRefWork {
  title: string[]
  published: { 'date-parts': number[][] }
  'is-referenced-by-count': number
  DOI: string
  'container-title': string[]
  author: Array<{
    given: string
    family: string
  }>
}

interface CrossRefResponse {
  message: {
    items: CrossRefWork[]
    'total-results': number
  }
}

// Enhanced cache with better organization
const cache = new Map<string, any>()
const CACHE_DURATION = 30 * 60 * 1000 // 15 minutes
const CROSSREF_CACHE = new Map<string, any>()

// Configuration for API requests with better resilience
const API_CONFIG = {
  timeout: 8000, // 8 seconds
  maxRetries: 3,
  retryDelay: 500,
  crossRefDelay: 1000, // Rate limiting for CrossRef
}

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
      // Rate limiting for CrossRef
      if (respectRateLimit && url.includes('crossref.org')) {
        const timeSinceLastCall = Date.now() - lastCrossRefCall
        if (timeSinceLastCall < API_CONFIG.crossRefDelay) {
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.crossRefDelay - timeSinceLastCall))
        }
        lastCrossRefCall = Date.now()
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout)
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'ORCID-Research-Platform/1.0 (mailto:contact@research-platform.com)',
          'Accept': 'application/json',
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

// CrossRef search function for publications and citations
export async function searchCrossRefByAuthor(authorName: string): Promise<{
  publications: any[]
  totalCitations: number
  hIndex: number
} | null> {
  const cacheKey = getCacheKey('crossref-author', authorName)
  const cached = getFromCache(cacheKey, CROSSREF_CACHE)
  if (cached) {
    return cached
  }

  try {
    // Search for works by author name
    const searchUrl = `https://api.crossref.org/works?query.author=${encodeURIComponent(authorName)}&rows=100&sort=is-referenced-by-count&order=desc`
    
    const response = await makeResilientRequest(searchUrl, {}, true)
    
    if (!response) {
      console.warn(`CrossRef request failed for ${authorName}`)
      return null
    }

    const data: CrossRefResponse = await response.json()
    const works = data.message?.items || []
    
    if (works.length === 0) {
      return null
    }

    // Filter works that likely belong to the author
    const filteredWorks = works.filter(work => {
      if (!work.author || work.author.length === 0) return false
      
      const authorNames = work.author.map(author => 
        `${author.given || ''} ${author.family || ''}`.toLowerCase().trim()
      )
      
      const searchNameLower = authorName.toLowerCase()
      return authorNames.some(name => 
        name.includes(searchNameLower) || searchNameLower.includes(name)
      )
    })

    // Process publications
    const publications = filteredWorks.slice(0, 50).map(work => ({
      title: work.title?.[0] || 'Título não disponível',
      year: work.published?.['date-parts']?.[0]?.[0] || new Date().getFullYear(),
      journal: work['container-title']?.[0] || 'Revista não informada',
      citations: work['is-referenced-by-count'] || 0,
      doi: work.DOI || undefined
    }))

    // Calculate total citations
    const totalCitations = publications.reduce((sum, pub) => sum + (pub.citations || 0), 0)

    // Calculate h-index
    const citationCounts = publications
      .map(pub => pub.citations || 0)
      .sort((a, b) => b - a)
    
    const hIndex = calculateHIndex(citationCounts)

    const result = {
      publications,
      totalCitations,
      hIndex
    }

    // Cache the results
    setCache(cacheKey, result, CROSSREF_CACHE)
    
    return result

  } catch (error) {
    console.error(`CrossRef search error for ${authorName}:`, error)
    return null
  }
}

// Search for specific publication in CrossRef
export async function searchCrossRefByTitle(title: string, authorName?: string): Promise<{
  citations: number
  doi: string | undefined
  journal: string | undefined
} | null> {
  try {
    const query = authorName ? `${title} ${authorName}` : title
    const searchUrl = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=1`
    
    const response = await makeResilientRequest(searchUrl, {}, true)
    
    if (!response) return null

    const data: CrossRefResponse = await response.json()
    const work = data.message?.items?.[0]
    
    if (work) {
      return {
        citations: work['is-referenced-by-count'] || 0,
        doi: work.DOI || undefined,
        journal: work['container-title']?.[0] || undefined
      }
    }
  } catch (error) {
    console.error('CrossRef title search error:', error)
  }
  return null
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

// Enhanced function using only ORCID and CrossRef
export async function enrichWithOrcidAndCrossRefData(
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

  // Try to get CrossRef data
  try {
    const crossRefResults = await searchCrossRefByAuthor(authorName)
    
    if (crossRefResults) {
      // Use CrossRef data if ORCID data is missing or incomplete
      if (totalCitations === 0 && crossRefResults.totalCitations > 0) {
        enhancedTotalCitations = crossRefResults.totalCitations
        enhancedWith.push('CrossRef')
      }
      
      if (hIndex === 0 && crossRefResults.hIndex > 0) {
        enhancedHIndex = crossRefResults.hIndex
        if (!enhancedWith.includes('CrossRef')) {
          enhancedWith.push('CrossRef')
        }
      }
      
      // Merge publications, prioritizing those with citation data
      if (crossRefResults.publications && crossRefResults.publications.length > 0) {
        const existingTitles = new Set(publications.map(p => p.title?.toLowerCase()))
        const newPublications = crossRefResults.publications.filter(p => 
          !existingTitles.has(p.title?.toLowerCase())
        )
        
        if (newPublications.length > 0) {
          publications = [...publications, ...newPublications].slice(0, 50)
          if (!enhancedWith.includes('CrossRef')) {
            enhancedWith.push('CrossRef')
          }
        }
        
        // Enhance existing publications with citation data
        for (const pub of publications) {
          if (!pub.citations || pub.citations === 0) {
            const crossRefPub = crossRefResults.publications.find(cp => 
              cp.title?.toLowerCase().includes(pub.title?.toLowerCase()) ||
              pub.title?.toLowerCase().includes(cp.title?.toLowerCase())
            )
            if (crossRefPub && crossRefPub.citations > 0) {
              pub.citations = crossRefPub.citations
              pub.doi = pub.doi || crossRefPub.doi
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting CrossRef data:', error)
    enrichmentErrors.push('CrossRef unavailable')
  }

  // Recalculate hIndex from enhanced publications if needed
  const needsHIndexRecalculation = (typeof enhancedHIndex === 'number' && enhancedHIndex === 0) || 
                                  (typeof enhancedHIndex === 'string' && enhancedHIndex === "-")
  if (needsHIndexRecalculation && publications.length > 0) {
    const citationCounts = publications
      .map(p => typeof p.citations === 'number' ? p.citations : 0)
      .filter(c => c > 0)
    
    if (citationCounts.length > 0) {
      enhancedHIndex = calculateHIndex(citationCounts)
    }
  }

  // Recalculate total citations from enhanced publications if needed
  const needsTotalCitationRecalculation = (typeof enhancedTotalCitations === 'number' && enhancedTotalCitations === 0) || 
                                         (typeof enhancedTotalCitations === 'string' && enhancedTotalCitations === "-")
  if (needsTotalCitationRecalculation && publications.length > 0) {
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

  // Only include enrichmentErrors if there were any
  if (enrichmentErrors.length > 0) {
    return { ...result, enrichmentErrors }
  }
  
  return result
}

// Maintain backward compatibility
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
  return enrichWithOrcidAndCrossRefData(authorName, orcidData)
}