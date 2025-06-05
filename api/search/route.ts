import { type NextRequest, NextResponse } from "next/server"
import { makeAuthenticatedOrcidRequest } from "@/lib/orcid-auth"
import { enrichWithExternalData, formatDataOrDash } from "@/lib/academic-platforms"

interface ORCIDSearchResult {
  "orcid-identifier": {
    path: string
  }
  "person-details": {
    "given-names"?: { value: string }
    "family-name"?: { value: string }
  }
}

interface Researcher {
  orcidId: string
  name: string
  country: string
  keywords: string[]
  citationCount: number | string
  publicationCount: number | string
  rank: number
}

// Enhanced country code mapping for better filtering
const COUNTRY_CODES: { [key: string]: string[] } = {
  "BR": ["Brazil", "Brasil", "BR", "Brazilian"],
  "US": ["United States", "USA", "US", "United States of America", "American"],
  "GB": ["United Kingdom", "UK", "GB", "Great Britain", "England", "Scotland", "Wales", "British"],
  "DE": ["Germany", "Deutschland", "DE", "German"],
  "FR": ["France", "FR", "French"],
  "CA": ["Canada", "CA", "Canadian"],
  "AU": ["Australia", "AU", "Australian"],
  "JP": ["Japan", "JP", "Japanese"],
  "CN": ["China", "CN", "Chinese"],
  "IN": ["India", "IN", "Indian"],
  "ES": ["Spain", "España", "ES", "Spanish"],
  "IT": ["Italy", "Italia", "IT", "Italian"],
  "NL": ["Netherlands", "Nederland", "NL", "Holland", "Dutch"],
  "SE": ["Sweden", "Sverige", "SE", "Swedish"],
  "NO": ["Norway", "Norge", "NO", "Norwegian"],
  "CH": ["Switzerland", "Schweiz", "CH", "Swiss"],
  "AT": ["Austria", "Österreich", "AT", "Austrian"],
  "BE": ["Belgium", "België", "BE", "Belgian"],
  "DK": ["Denmark", "Danmark", "DK", "Danish"]
}

// Cache for basic profile data to avoid repeated API calls
const profileCache = new Map<string, any>()
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

export async function POST(request: NextRequest) {
  try {
    const { query, type, country } = await request.json()

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    console.log(`Search request: query="${query}", type="${type}", country="${country}"`)

    // Verify ORCID credentials are available
    if (!process.env.ORCID_CLIENT_ID || !process.env.ORCID_CLIENT_SECRET) {
      console.error('ORCID credentials not configured')
      return NextResponse.json({ 
        error: "Configuração do servidor incompleta", 
        message: "Credenciais ORCID não configuradas"
      }, { status: 500 })
    }

    // Build simple ORCID search query that works reliably
    let searchQuery = query.trim()
    
    // Use the simplest possible syntax for ORCID API
    if (type === "keywords") {
      // For keywords, just search for the term
      searchQuery = searchQuery
    } else {
      // For names, use simple wildcard search
      searchQuery = searchQuery
    }

    // Remove country filter temporarily to test basic functionality
    // We'll filter by country on the client side instead
    /* 
    if (country && country !== "all") {
      const countryNames = COUNTRY_CODES[country] || [country]
      const primaryCountry = countryNames[0]
      searchQuery = `${searchQuery} AND country:${primaryCountry}`
    }
    */

    const encodedQuery = encodeURIComponent(searchQuery)
    const searchUrl = `https://pub.orcid.org/v3.0/search/?q=${encodedQuery}&rows=30&start=0`
    
    console.log(`ORCID Search Query: ${searchQuery}`)

    try {
      const response = await makeAuthenticatedOrcidRequest(searchUrl)

      if (!response.ok) {
        console.error(`ORCID API error: ${response.status} ${response.statusText}`)
        const errorText = await response.text().catch(() => 'No error details')
        console.error(`ORCID error details:`, errorText)
        
        return NextResponse.json({ 
          error: "Erro na busca", 
          message: `Falha na API ORCID: ${response.status}. Tente novamente.`
        }, { status: 500 })
      }

      const data = await response.json()
      const results = data.result || []

      console.log(`Found ${results.length} initial results from ORCID`)

      return await processSearchResults(results, country, query)

    } catch (apiError) {
      console.error('ORCID API request failed:', apiError)
      return NextResponse.json({ 
        error: "Erro de conexão", 
        message: "Falha ao conectar com a API ORCID. Verifique sua conexão."
      }, { status: 500 })
    }

  } catch (error) {
    console.error("Search error:", error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ 
      error: "Erro interno do servidor", 
      message: `Falha na busca: ${errorMessage}. Tente novamente.`
    }, { status: 500 })
  }
}

async function processSearchResults(results: ORCIDSearchResult[], filterCountry?: string, originalQuery?: string): Promise<NextResponse> {
  const researchers: Researcher[] = []
  const maxResults = 20 // Limit results for better performance
  const batchSize = 3 // Smaller batches for more reliable processing
  
  for (let i = 0; i < Math.min(results.length, maxResults); i += batchSize) {
    const batch = results.slice(i, i + batchSize)
    
    const batchPromises = batch.map(async (result) => {
      const orcidId = result["orcid-identifier"]?.path
      
      if (!orcidId) return null

      try {
        // Check cache first
        const cacheKey = `profile_${orcidId}`
        const cached = profileCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          const cachedResearcher = createResearcherFromCachedData(cached.data, orcidId, filterCountry)
          if (cachedResearcher) {
            // Try to get publication data for cached researcher
            try {
              const publicationData = await getPublicationDataEfficiently(orcidId, cachedResearcher.name)
              cachedResearcher.citationCount = publicationData.citationCount
              cachedResearcher.publicationCount = publicationData.publicationCount
            } catch (error) {
              console.log(`Failed to get publication data for cached ${cachedResearcher.name}`)
            }
          }
          return cachedResearcher
        }

        // Fetch basic profile data with timeout
        const timeoutMs = 8000 // Increased timeout
        const profileResponse = await Promise.race([
          makeAuthenticatedOrcidRequest(`https://pub.orcid.org/v3.0/${orcidId}/person`),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('Profile timeout')), timeoutMs)
          )
        ])

        let name = "Nome não disponível"
        let country = "País não informado"
        let keywords: string[] = []

        if (profileResponse.ok) {
          const profileData = await profileResponse.json()
          
          // Cache the profile data
          profileCache.set(cacheKey, { data: profileData, timestamp: Date.now() })
          
          // Extract name
          const givenNames = profileData.name?.["given-names"]?.value || ""
          const familyName = profileData.name?.["family-name"]?.value || ""
          name = `${givenNames} ${familyName}`.trim() || "Nome não disponível"

          // Extract country
          const addresses = profileData.addresses?.address || []
          country = addresses.length > 0 ? addresses[0].country?.value : "País não informado"

          // Extract keywords
          const keywordData = profileData.keywords?.keyword || []
          keywords = keywordData.slice(0, 10).map((k: any) => k.content).filter(Boolean)
        }

        // Apply country filter if specified
        if (filterCountry && filterCountry !== "all") {
          if (country === "País não informado" || 
              (!country.toLowerCase().includes(filterCountry.toLowerCase()) && 
               country !== filterCountry.toUpperCase())) {
            console.log(`Filtering out ${name} - country: ${country}, filter: ${filterCountry}`)
            return null
          }
        }

        // Get publication and citation data with better error handling
        let citationCount: number | string = "-"
        let publicationCount: number | string = "-"
        
        try {
          console.log(`Getting publication data for ${name}...`)
          const publicationData = await getPublicationDataEfficiently(orcidId, name)
          citationCount = publicationData.citationCount
          publicationCount = publicationData.publicationCount
          console.log(`${name}: ${publicationCount} publications, ${citationCount} citations`)
        } catch (error) {
          console.log(`Failed to get publication data for ${name}:`, error instanceof Error ? error.message : 'Unknown error')
        }

        // Return researcher object with correct property names
        return {
          orcidId,
          name,
          country,
          keywords,
          citationCount, // This maps to the search interface
          publicationCount, // This maps to the search interface
          rank: 0 // Will be set during sorting
        }

      } catch (error) {
        console.error(`Error processing researcher ${orcidId}:`, error)
        return null
      }
    })

    try {
      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          researchers.push(result.value)
        }
      })
    } catch (error) {
      console.error('Error processing batch:', error)
    }

    // Delay between batches to avoid overwhelming the APIs
    if (i + batchSize < Math.min(results.length, maxResults)) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Sort researchers by citation count (handling both numbers and strings)
  researchers.sort((a, b) => {
    const aCitations = typeof a.citationCount === 'number' ? a.citationCount : 
                     (a.citationCount === "-" ? 0 : parseInt(String(a.citationCount)) || 0)
    const bCitations = typeof b.citationCount === 'number' ? b.citationCount : 
                     (b.citationCount === "-" ? 0 : parseInt(String(b.citationCount)) || 0)
    
    // Primary sort by citations (descending)
    if (bCitations !== aCitations) {
      return bCitations - aCitations
    }
    
    // Secondary sort by publication count (descending)
    const aPubs = typeof a.publicationCount === 'number' ? a.publicationCount : 
                 (a.publicationCount === "-" ? 0 : parseInt(String(a.publicationCount)) || 0)
    const bPubs = typeof b.publicationCount === 'number' ? b.publicationCount : 
                 (b.publicationCount === "-" ? 0 : parseInt(String(b.publicationCount)) || 0)
    
    return bPubs - aPubs
  })

  // Assign ranks after sorting
  researchers.forEach((researcher, index) => {
    researcher.rank = index + 1
  })

  console.log(`Returning ${researchers.length} researchers`)
  console.log(`Citation counts: ${researchers.map(r => `${r.name}: ${r.citationCount}`).join(', ')}`)

  return NextResponse.json({ researchers })
}

function createResearcherFromCachedData(profileData: any, orcidId: string, filterCountry?: string): Researcher | null {
  // Extract name from cached data
  const givenNames = profileData.name?.["given-names"]?.value || ""
  const familyName = profileData.name?.["family-name"]?.value || ""
  const name = `${givenNames} ${familyName}`.trim() || 
               profileData.name?.["credit-name"]?.value || 
               "Nome não disponível"

  // Extract country
  const addresses = profileData.addresses?.address || []
  const country = addresses.length > 0 ? addresses[0].country?.value : "País não informado"

  // Apply country filter
  if (filterCountry && filterCountry !== "all") {
    const countryNames = COUNTRY_CODES[filterCountry] || [filterCountry]
    const countryMatches = countryNames.some(countryName => 
      country.toLowerCase().includes(countryName.toLowerCase()) ||
      countryName.toLowerCase().includes(country.toLowerCase())
    )
    
    if (!countryMatches && country !== "País não informado") {
      return null
    }
  }

  // Extract keywords
  const keywordData = profileData.keywords?.keyword || []
  const keywords = keywordData.slice(0, 10).map((k: any) => k.content).filter(Boolean)

  return {
    orcidId,
    name,
    country,
    keywords,
    citationCount: "-", // Will be filled by external data if available
    publicationCount: "-", // Will be filled by external data if available
    rank: 0,
  }
}

async function getPublicationDataEfficiently(orcidId: string, name: string): Promise<{ citationCount: number | string, publicationCount: number | string }> {
  try {
    // First try to get ORCID works data
    const worksResponse = await Promise.race([
      makeAuthenticatedOrcidRequest(`https://pub.orcid.org/v3.0/${orcidId}/works`),
      new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('ORCID works timeout')), 8000)
      )
    ])

    let orcidPublicationCount = 0
    if (worksResponse.ok) {
      const worksData = await worksResponse.json()
      orcidPublicationCount = worksData.group?.length || 0
    }

    // Try to get citation data from external sources
    try {
      console.log(`Attempting to get citation data for ${name}`)
      const enrichmentResult = await Promise.race([
        enrichWithExternalData(name, {
          publications: [],
          totalCitations: 0,
          hIndex: 0
        }),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Enrichment timeout')), 12000)
        )
      ])

      if (enrichmentResult && enrichmentResult.totalCitations !== undefined) {
        const citations = typeof enrichmentResult.totalCitations === 'number' ? 
                         enrichmentResult.totalCitations : 
                         (enrichmentResult.totalCitations === "-" ? 0 : parseInt(String(enrichmentResult.totalCitations)) || 0)
        
        const publications = enrichmentResult.publications?.length || orcidPublicationCount
        
        console.log(`Successfully enriched ${name}: ${citations} citations, ${publications} publications`)
        return {
          citationCount: citations > 0 ? citations : "-",
          publicationCount: publications > 0 ? publications : orcidPublicationCount || "-"
        }
      }
    } catch (enrichmentError) {
      console.log(`Enrichment failed for ${name}:`, enrichmentError instanceof Error ? enrichmentError.message : 'Unknown error')
    }

    // Fallback to ORCID data only
    return {
      citationCount: "-",
      publicationCount: orcidPublicationCount > 0 ? orcidPublicationCount : "-"
    }

  } catch (error) {
    console.error(`Error getting publication data for ${orcidId}:`, error)
    return {
      citationCount: "-",
      publicationCount: "-"
    }
  }
}

// New helper function to get a sample of ORCID publications for citation estimation
async function getOrcidPublicationSample(orcidId: string, sampleSize: number): Promise<{ estimatedCitations: number | string }> {
  try {
    const worksResponse = await makeAuthenticatedOrcidRequest(`https://pub.orcid.org/v3.0/${orcidId}/works`)
    
    if (!worksResponse.ok) {
      throw new Error('Failed to get works')
    }
    
    const worksData = await worksResponse.json()
    const workGroups = worksData.group || []
    
    if (workGroups.length === 0) {
      return { estimatedCitations: "-" }
    }
    
    // Get details for a few recent publications
    const sampleWorks = workGroups.slice(0, sampleSize)
    let totalCitations = 0
    let worksWithCitations = 0
    
    const detailPromises = sampleWorks.map(async (group: any) => {
      const workSummary = group["work-summary"]?.[0]
      if (!workSummary) return null
      
      try {
        const workDetailResponse = await Promise.race([
          makeAuthenticatedOrcidRequest(`https://pub.orcid.org/v3.0/${orcidId}/work/${workSummary["put-code"]}`),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('Work detail timeout')), 3000)
          )
        ])
        
        if (workDetailResponse.ok) {
          const workDetail = await workDetailResponse.json()
          
          // Look for citation count in external identifiers or other fields
          const externalIds = workDetail["external-ids"]?.["external-id"] || []
          const title = workDetail.title?.title?.value || ""
          
          // This is a basic estimation - in practice, you'd need external APIs for real citation counts
          // For now, we'll return a placeholder indicating we have publication data
          return { title, year: workDetail["publication-date"]?.year?.value }
        }
      } catch (error) {
        return null
      }
      
      return null
    })
    
    const results = await Promise.allSettled(detailPromises)
    const validResults = results.filter(r => r.status === 'fulfilled' && r.value).length
    
    // If we successfully got publication details, indicate that external enrichment might work
    if (validResults > 0) {
      return { estimatedCitations: "pending" } // Signal that external enrichment should be tried
    }
    
    return { estimatedCitations: "-" }
  } catch (error) {
    return { estimatedCitations: "-" }
  }
}
