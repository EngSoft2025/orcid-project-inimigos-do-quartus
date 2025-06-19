import { type NextRequest, NextResponse } from "next/server"
import { makeAuthenticatedOrcidRequest } from "@/lib/orcid-auth"
import { enrichWithOrcidAndCrossRefData, formatDataOrDash } from "@/lib/academic-platforms"

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
  "BR": ["Brazil", "Brasil", "BR", "Brazilian", "Universidade", "Instituto", "UFRJ", "USP", "UFMG", "UNICAMP"],
  "US": ["United States", "USA", "US", "United States of America", "American", "University", "College"],
  "GB": ["United Kingdom", "UK", "GB", "Great Britain", "England", "Scotland", "Wales", "British"],
  "DE": ["Germany", "Deutschland", "DE", "German", "Universität"],
  "FR": ["France", "FR", "French", "Université"],
  "CA": ["Canada", "CA", "Canadian", "University"],
  "AU": ["Australia", "AU", "Australian", "University"],
  "JP": ["Japan", "JP", "Japanese", "University"],
  "CN": ["China", "CN", "Chinese", "University"],
  "IN": ["India", "IN", "Indian", "University"],
  "ES": ["Spain", "España", "ES", "Spanish", "Universidad"],
  "IT": ["Italy", "Italia", "IT", "Italian", "Università"],
  "NL": ["Netherlands", "Nederland", "NL", "Holland", "Dutch", "Universiteit"],
  "SE": ["Sweden", "Sverige", "SE", "Swedish", "University"],
  "NO": ["Norway", "Norge", "NO", "Norwegian", "University"],
  "CH": ["Switzerland", "Schweiz", "CH", "Swiss", "University"],
  "AT": ["Austria", "Österreich", "AT", "Austrian", "Universität"],
  "BE": ["Belgium", "België", "BE", "Belgian", "University"],
  "DK": ["Denmark", "Danmark", "DK", "Danish", "University"],
  "PT": ["Portugal", "PT", "Portuguese", "Universidade"],
  "MX": ["Mexico", "México", "MX", "Mexican", "Universidad"],
  "AR": ["Argentina", "AR", "Argentinian", "Universidad"],
  "CL": ["Chile", "CL", "Chilean", "Universidad"],
  "CO": ["Colombia", "CO", "Colombian", "Universidad"],
  "PE": ["Peru", "Perú", "PE", "Peruvian", "Universidad"],
  "UY": ["Uruguay", "UY", "Uruguayan", "Universidad"],
  "VE": ["Venezuela", "VE", "Venezuelan", "Universidad"]
}

// Cache for basic profile data to avoid repeated API calls
const profileCache = new Map<string, any>()
// Constantes otimizadas
const CACHE_DURATION = 20 * 60 * 1000 // 20 minutos
const PROFILE_TIMEOUT = 3000 // 3 segundos
const BATCH_DELAY = 25 // 25ms entre batches
const MAX_CONCURRENT_PROFILES = 8 // Mais requests simultâneos

// Implementar cache de resultados de busca completos
const searchCache = new Map<string, { results: Researcher[], timestamp: number }>()
const SEARCH_CACHE_DURATION = 10 * 60 * 1000 // 10 minutos

export async function POST(request: NextRequest) {
  try {
    const { query, type, country } = await request.json()
    
    // Cache key baseado em query + type + country
    const cacheKey = `search_${query.trim().toLowerCase()}_${type}_${country || 'all'}`
    const cached = searchCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_DURATION) {
      console.log(`Cache hit for: ${cacheKey}`)
      return NextResponse.json({ researchers: cached.results })
    }

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    console.log(`Search: "${query}" (${type}) - Country: ${country || 'all'}`)

    // Verify ORCID credentials are available
    if (!process.env.ORCID_CLIENT_ID || !process.env.ORCID_CLIENT_SECRET) {
      console.error('ORCID credentials not configured')
      return NextResponse.json({ 
        error: "Configuração do servidor incompleta", 
        message: "Credenciais ORCID não configuradas"
      }, { status: 500 })
    }

    // Use a multi-strategy approach for better country filtering
    const searchResults = await performCountryAwareSearchOptimized(query, type, country)
    
    // Cache dos resultados
    searchCache.set(cacheKey, { results: searchResults, timestamp: Date.now() })
    
    return NextResponse.json({ researchers: searchResults })

  } catch (error) {
    console.error("Search error:", error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ 
      error: "Erro interno do servidor", 
      message: `Falha na busca: ${errorMessage}. Tente novamente.`
    }, { status: 500 })
  }
}

async function performCountryAwareSearch(query: string, type: string, country?: string): Promise<Researcher[]> {
  const allResults: Researcher[] = []
  
  // Strategy 1: Direct search with country-specific terms
  if (country && country !== "all") {
    const countrySpecificResults = await searchWithCountryTerms(query, type, country)
    allResults.push(...countrySpecificResults)
  }
  
  // Strategy 2: General search with post-filtering
  if (allResults.length < 30) { // Aumentar de 15 para 30 para buscar mais resultados
    const generalResults = await searchGeneral(query, type, country)
    
    // Merge results, avoiding duplicates
    const existingIds = new Set(allResults.map(r => r.orcidId))
    const newResults = generalResults.filter(r => !existingIds.has(r.orcidId))
    allResults.push(...newResults)
  }
  
  // Sort and rank results
  return rankAndSortResults(allResults)
}

async function searchWithCountryTerms(query: string, type: string, country: string): Promise<Researcher[]> {
  const countryNames = COUNTRY_CODES[country] || [country]
  
  // Build search query with country-specific terms
  let searchQuery = query.trim()
  
  if (type === "keywords") {
    // Para keywords com país, ser mais flexível
    const keywords = searchQuery.split(/[,\s]+/).filter((k: string) => k.length > 2)
    if (keywords.length > 1) {
      searchQuery = keywords.map((keyword: string) => `"${keyword.trim()}"`).join(' OR ')
    } else {
      searchQuery = `"${searchQuery}"`
    }
  } else {
    const nameParts = searchQuery.split(' ').filter((part: string) => part.length > 1)
    if (nameParts.length > 1) {
      const givenName = nameParts.slice(0, -1).join(' ')
      const familyName = nameParts[nameParts.length - 1]
      // Busca flexível para nomes com país
      searchQuery = `(family-name:"${familyName}" OR family-name:${familyName}*) AND (given-names:"${givenName}" OR given-names:${givenName}*)`
    } else {
      // Para nome único + país, busca mais ampla
      searchQuery = `(family-name:"${searchQuery}" OR family-name:${searchQuery}* OR given-names:"${searchQuery}" OR given-names:${searchQuery}*)`
    }
  }
  
  // Add country filter using multiple strategies - mais específico
  const countryQueries = countryNames.flatMap(countryName => [
    `affiliation-org-name:"${countryName}"`,
    `current-institution-affiliation-name:"${countryName}"`,
    `affiliation-org-name:*${countryName}*`,
    `current-institution-affiliation-name:*${countryName}*`
  ])
  
  const finalQuery = `(${searchQuery}) AND (${countryQueries.join(' OR ')})`
  
  try {
    return await executeOrcidSearch(finalQuery, country)
  } catch (error) {
    console.warn('Country-specific search failed, trying general search')
    return []
  }
}

async function searchGeneral(query: string, type: string, filterCountry?: string): Promise<Researcher[]> {
  let searchQuery = query.trim()
  
  if (type === "keywords") {
    const keywords = searchQuery.split(/[,\s]+/).filter((k: string) => k.length > 2)
    if (keywords.length > 1) {
      // Mais flexível: usar OR para múltiplas palavras-chave
      searchQuery = keywords.map((keyword: string) => `"${keyword.trim()}"`).join(' OR ')
    } else {
      searchQuery = `"${searchQuery}"`
    }
  } else {
    const nameParts = searchQuery.split(' ').filter((part: string) => part.length > 1)
    if (nameParts.length > 1) {
      const givenName = nameParts.slice(0, -1).join(' ')
      const familyName = nameParts[nameParts.length - 1]
      // Busca mais flexível: permitir correspondências parciais
      searchQuery = `(family-name:"${familyName}" OR family-name:${familyName}*) AND (given-names:"${givenName}" OR given-names:${givenName}*)`
    } else {
      // Para nomes únicos, busca mais ampla com wildcards
      const singleName = searchQuery
      searchQuery = `(family-name:"${singleName}" OR family-name:${singleName}* OR given-names:"${singleName}" OR given-names:${singleName}*)`
      
      // Só adicionar filtro de data para nomes muito comuns
      if (isVeryCommonName(singleName)) {
        searchQuery += ` AND profile-submission-date:[2010-01-01 TO *]`
      }
    }
  }
  
  return await executeOrcidSearch(searchQuery, filterCountry)
}

async function executeOrcidSearch(searchQuery: string, filterCountry?: string): Promise<Researcher[]> {
  // Otimizar query para nomes comuns
  const optimizedQuery = optimizeQueryForCommonNames(searchQuery, filterCountry ? "name" : "general")
  
  const encodedQuery = encodeURIComponent(optimizedQuery)
  // Aumentar rows de 40 para 100 para buscar mais resultados
  const searchUrl = `https://pub.orcid.org/v3.0/search/?q=${encodedQuery}&rows=100&start=0`
  
  try {
    const response = await Promise.race([
      makeAuthenticatedOrcidRequest(searchUrl),
      new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('ORCID search timeout')), 8000) // Timeout de 8s
      )
    ])
    
    if (!response.ok) {
      throw new Error(`ORCID API error: ${response.status}`)
    }

    const data = await response.json()
    const results = data.result || []

    return await processSearchResults(results, filterCountry)

  } catch (apiError) {
    console.error('ORCID API request failed:', apiError)
    throw apiError
  }
}

async function processSearchResults(results: ORCIDSearchResult[], filterCountry?: string): Promise<Researcher[]> {
  const researchers: Researcher[] = []
  const maxResults = 50
  const batchSize = 15  // Aumentar de 10 para 15
  const maxConcurrent = 4  // Aumentar de 3 para 4
  
  // Early return se não há resultados
  if (!results || results.length === 0) {
    return researchers
  }
  
  // Processar resultados mais promissores primeiro (se houver ranking na API)
  const sortedResults = results.sort((a, b) => {
    // Se ORCID fornecer score, usar isso
    const scoreA = (a as any)?.score || 0
    const scoreB = (b as any)?.score || 0
    return scoreB - scoreA
  })

  for (let i = 0; i < Math.min(sortedResults.length, maxResults); i += batchSize * maxConcurrent) {
    const batches = []
    
    for (let j = 0; j < maxConcurrent && (i + j * batchSize) < Math.min(sortedResults.length, maxResults); j++) {
      const batchStart = i + j * batchSize
      const batchEnd = Math.min(batchStart + batchSize, Math.min(sortedResults.length, maxResults))
      const batch = sortedResults.slice(batchStart, batchEnd)
      
      if (batch.length > 0) {
        batches.push(processBatchOptimized(batch, filterCountry))
      }
    }
    
    const batchResults = await Promise.allSettled(batches)
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        researchers.push(...result.value)
      }
    })

    // Early return se já temos resultados suficientes
    if (researchers.length >= 30) {
      console.log(`Early return: found ${researchers.length} researchers`)
      break
    }

    // Delay reduzido
    if (i + batchSize * maxConcurrent < Math.min(sortedResults.length, maxResults)) {
      await new Promise(resolve => setTimeout(resolve, 50)) // Reduzir de 100ms para 50ms
    }
  }

  return researchers
}

// Nova função auxiliar para processar um lote individual
async function processBatch(batch: ORCIDSearchResult[], filterCountry?: string): Promise<Researcher[]> {
  const batchResults: Researcher[] = []
  
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
          // Try to get enhanced publication data for cached researcher
          try {
            const publicationData = await getEnhancedPublicationData(orcidId, cachedResearcher.name)
            cachedResearcher.citationCount = publicationData.citationCount
            cachedResearcher.publicationCount = publicationData.publicationCount
          } catch (error) {
            // Silent fallback for cached data enhancement
          }
        }
        return cachedResearcher
      }

      // Fetch comprehensive profile data
      const timeoutMs = PROFILE_TIMEOUT
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
        
        // Extract name with multiple fallbacks
        const givenNames = profileData.name?.["given-names"]?.value || ""
        const familyName = profileData.name?.["family-name"]?.value || ""
        const creditName = profileData.name?.["credit-name"]?.value || ""
        
        name = creditName || `${givenNames} ${familyName}`.trim() || "Nome não disponível"
        
        // Extract country with improved matching
        const addresses = profileData.addresses?.address || []
        if (addresses.length > 0) {
          country = addresses[0].country?.value || "País não informado"
        }
        
        // Extract keywords
        const keywordData = profileData.keywords?.keyword || []
        keywords = keywordData.slice(0, 15).map((k: any) => k.content).filter(Boolean)
      }

      // Apply enhanced country filtering
      if (filterCountry && filterCountry !== "all") {
        if (!isCountryMatch(country, filterCountry)) {
          return null
        }
      }

      // Get enhanced publication and citation data
      let citationCount: number | string = "-"
      let publicationCount: number | string = "-"
      
      try {
        const publicationData = await getEnhancedPublicationData(orcidId, name)
        citationCount = publicationData.citationCount
        publicationCount = publicationData.publicationCount
      } catch (error) {
        // Silent fallback for publication data
      }

      return {
        orcidId,
        name,
        country,
        keywords,
        citationCount,
        publicationCount,
        rank: 0 // Will be set during sorting
      }

    } catch (error) {
      console.error(`Error processing researcher ${orcidId}:`, error)
      return null
    }
  })

  const results = await Promise.allSettled(batchPromises)
  
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      batchResults.push(result.value)
    }
  })

  return batchResults
}

async function processBatchOptimized(batch: ORCIDSearchResult[], filterCountry?: string): Promise<Researcher[]> {
  const batchResults: Researcher[] = []
  
  // Separar requests cached vs não-cached
  const cachedRequests: Promise<Researcher | null>[] = []
  const freshRequests: Promise<Researcher | null>[] = []
  
  batch.forEach((result) => {
    const orcidId = result["orcid-identifier"]?.path
    if (!orcidId) return
    
    const cacheKey = `profile_${orcidId}`
    const cached = profileCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      cachedRequests.push(Promise.resolve(createResearcherFromCachedData(cached.data, orcidId, filterCountry)))
    } else {
      freshRequests.push(processSingleResearcher(result, filterCountry))
    }
  })
  
  // Processar cached instantaneamente
  const cachedResults = await Promise.allSettled(cachedRequests)
  cachedResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      batchResults.push(result.value)
    }
  })
  
  // Processar fresh requests com limite de concorrência
  if (freshRequests.length > 0) {
    const freshResults = await Promise.allSettled(freshRequests)
    freshResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        batchResults.push(result.value)
      }
    })
  }

  return batchResults
}

async function processSingleResearcher(result: ORCIDSearchResult, filterCountry?: string): Promise<Researcher | null> {
  const orcidId = result["orcid-identifier"]?.path
  if (!orcidId) return null

  try {
    // Timeout mais agressivo para perfis
    const timeoutMs = 3000 // Reduzir de 5s para 3s
    const cacheKey = `profile_${orcidId}`
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
      
      // Extract name with multiple fallbacks
      const givenNames = profileData.name?.["given-names"]?.value || ""
      const familyName = profileData.name?.["family-name"]?.value || ""
      const creditName = profileData.name?.["credit-name"]?.value || ""
      
      name = creditName || `${givenNames} ${familyName}`.trim() || "Nome não disponível"
      
      // Extract country with improved matching
      const addresses = profileData.addresses?.address || []
      if (addresses.length > 0) {
        country = addresses[0].country?.value || "País não informado"
      }
      
      // Extract keywords
      const keywordData = profileData.keywords?.keyword || []
      keywords = keywordData.slice(0, 15).map((k: any) => k.content).filter(Boolean)
    }

    // Apply enhanced country filtering
    if (filterCountry && filterCountry !== "all") {
      if (!isCountryMatch(country, filterCountry)) {
        return null
      }
    }

    // Get enhanced publication and citation data
    let citationCount: number | string = "-"
    let publicationCount: number | string = "-"
    
    try {
      const publicationData = await getEnhancedPublicationData(orcidId, name)
      citationCount = publicationData.citationCount
      publicationCount = publicationData.publicationCount
    } catch (error) {
      // Silent fallback for publication data
    }

    return {
      orcidId,
      name,
      country,
      keywords,
      citationCount,
      publicationCount,
      rank: 0 // Will be set during sorting
    }

  } catch (error) {
    // Falha mais rápida
    return null
  }
}

function isCountryMatch(researcherCountry: string, filterCountry: string): boolean {
  if (researcherCountry === "País não informado") return false
  
  const countryNames = COUNTRY_CODES[filterCountry] || [filterCountry]
  
  return countryNames.some(countryName => {
    const researcherCountryLower = researcherCountry.toLowerCase()
    const countryNameLower = countryName.toLowerCase()
    
    return researcherCountryLower.includes(countryNameLower) ||
           countryNameLower.includes(researcherCountryLower) ||
           researcherCountryLower === countryNameLower
  })
}

function createResearcherFromCachedData(profileData: any, orcidId: string, filterCountry?: string): Researcher | null {
  // Extract name from cached data
  const givenNames = profileData.name?.["given-names"]?.value || ""
  const familyName = profileData.name?.["family-name"]?.value || ""
  const creditName = profileData.name?.["credit-name"]?.value || ""
  const name = creditName || `${givenNames} ${familyName}`.trim() || "Nome não disponível"

  // Extract country
  const addresses = profileData.addresses?.address || []
  const country = addresses.length > 0 ? addresses[0].country?.value : "País não informado"

  // Apply country filter
  if (filterCountry && filterCountry !== "all") {
    if (!isCountryMatch(country, filterCountry)) {
      return null
    }
  }

  // Extract keywords
  const keywordData = profileData.keywords?.keyword || []
  const keywords = keywordData.slice(0, 15).map((k: any) => k.content).filter(Boolean)

  return {
    orcidId,
    name,
    country,
    keywords,
    citationCount: "-", // Will be filled by enhanced data if available
    publicationCount: "-", // Will be filled by enhanced data if available
    rank: 0,
  }
}

async function getEnhancedPublicationData(orcidId: string, name: string): Promise<{ citationCount: number | string, publicationCount: number | string }> {
  try {
    // Get ORCID works data
    const worksResponse = await Promise.race([
        makeAuthenticatedOrcidRequest(`https://pub.orcid.org/v3.0/${orcidId}/works`),
        new Promise<Response>((_, reject) => 
          setTimeout(() => reject(new Error('ORCID works timeout')), 10000)
        )
      ])

    let orcidPublicationCount = 0
    let publications: any[] = []

    if (worksResponse.ok) {
      const worksData = await worksResponse.json()
      orcidPublicationCount = worksData.group?.length || 0
      
      // Extract publication details for enrichment
      publications = worksData.group?.slice(0, 20).map((group: any) => {
        const workSummary = group["work-summary"]?.[0]
        return {
          title: workSummary?.title?.title?.value || "Título não disponível",
          year: workSummary?.["publication-date"]?.year?.value || new Date().getFullYear(),
          journal: workSummary?.["journal-title"]?.value || "Revista não informada"
        }
      }) || []
    }

    // Try to enhance with CrossRef data
    try {
      const enrichmentResult = await Promise.race([
        enrichWithOrcidAndCrossRefData(name, {
          publications,
          totalCitations: 0,
          hIndex: 0
        }),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Enrichment timeout')), 15000)
        )
      ])

      if (enrichmentResult && enrichmentResult.totalCitations !== undefined) {
        const citations = typeof enrichmentResult.totalCitations === 'number' ? 
                         enrichmentResult.totalCitations : 
                         (enrichmentResult.totalCitations === "-" ? 0 : parseInt(String(enrichmentResult.totalCitations)) || 0)
        
        const publicationCountFromEnrichment = enrichmentResult.publications?.length || orcidPublicationCount
        
        return {
          citationCount: citations > 0 ? citations : "-",
          publicationCount: publicationCountFromEnrichment > 0 ? publicationCountFromEnrichment : orcidPublicationCount || "-"
        }
      }
    } catch (enrichmentError) {
      // Silent fallback for enrichment errors
    }

    // Fallback to ORCID data only
    return {
      citationCount: "-",
      publicationCount: orcidPublicationCount > 0 ? orcidPublicationCount : "-"
    }

  } catch (error) {
    return {
      citationCount: "-",
      publicationCount: "-"
    }
  }
}

// Nova função para obter dados de publicação com otimizações
async function getEnhancedPublicationDataOptimized(orcidId: string, name: string): Promise<{ citationCount: number | string, publicationCount: number | string }> {
  try {
    // Cache específico para dados de publicação
    const pubCacheKey = `pub_${orcidId}`
    const cachedPub = profileCache.get(pubCacheKey)
    
    if (cachedPub && Date.now() - cachedPub.timestamp < CACHE_DURATION * 2) { // Cache mais longo para pubs
      return cachedPub.data
    }

    // Timeout mais agressivo
    const worksResponse = await Promise.race([
      makeAuthenticatedOrcidRequest(`https://pub.orcid.org/v3.0/${orcidId}/works`),
      new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('ORCID works timeout')), 5000) // 5s timeout
      )
    ])

    let orcidPublicationCount = 0
    if (worksResponse.ok) {
      const worksData = await worksResponse.json()
      orcidPublicationCount = worksData.group?.length || 0
    }

    // Pular enriquecimento CrossRef para performance
    const result = {
      citationCount: "-", // Pode ser enriquecido assincronamente depois
      publicationCount: orcidPublicationCount > 0 ? orcidPublicationCount : "-"
    }
    
    // Cache resultado
    profileCache.set(pubCacheKey, { data: result, timestamp: Date.now() })
    
    return result

  } catch (error) {
    return { citationCount: "-", publicationCount: "-" }
  }
}

function rankAndSortResults(researchers: Researcher[]): Researcher[] {
  // Enhanced sorting by citation count and publication count
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

  console.log(`Found ${researchers.length} researchers`)

  return researchers.slice(0, 50) // Aumentar de 25 para 50 resultados
}

// Adicionar após a função executeOrcidSearch
function optimizeQueryForCommonNames(query: string, type: string): string {
  // Aplicar filtros mais restritivos apenas para casos muito específicos
  if (type === "name" && isVeryCommonName(query)) {
    return `${query} AND profile-submission-date:[2015-01-01 TO *]`
  }
  
  return query
}

// Nova função auxiliar para detectar nomes extremamente comuns
function isVeryCommonName(query: string): boolean {
  const veryCommonNames = [
    'maria silva', 'jose silva', 'john smith', 'mary johnson',
    'maria', 'jose', 'john', 'mary', 'silva', 'smith'
  ]
  
  const queryLower = query.toLowerCase().trim()
  
  // Só aplicar filtros para nomes na lista de muito comuns
  return veryCommonNames.some(common => 
    queryLower === common || 
    (queryLower.length <= 4 && veryCommonNames.includes(queryLower))
  )
}

async function performCountryAwareSearchOptimized(query: string, type: string, country?: string): Promise<Researcher[]> {
  const allResults: Researcher[] = []
  
  try {
    // Strategy 1: Busca específica por país (mais rápida)
    if (country && country !== "all") {
      const countrySpecificResults = await Promise.race([
        searchWithCountryTerms(query, type, country),
        new Promise<Researcher[]>((_, reject) => 
          setTimeout(() => reject(new Error('Country search timeout')), 10000)
        )
      ])
      allResults.push(...countrySpecificResults)
    }
    
    // Strategy 2: Só fazer busca geral se realmente necessário
    if (allResults.length < 15) { // Reduzir threshold de 30 para 15
      const generalResults = await Promise.race([
        searchGeneral(query, type, country),
        new Promise<Researcher[]>((_, reject) => 
          setTimeout(() => reject(new Error('General search timeout')), 10000)
        )
      ])
      
      // Merge sem duplicatas
      const existingIds = new Set(allResults.map(r => r.orcidId))
      const newResults = generalResults.filter(r => !existingIds.has(r.orcidId))
      allResults.push(...newResults)
    }
    
  } catch (error) {
    console.warn('Search strategy failed:', error)
    // Fallback para busca simples
    if (allResults.length === 0) {
      try {
        const fallbackResults = await searchGeneral(query, type, country)
        allResults.push(...fallbackResults)
      } catch (fallbackError) {
        console.error('Fallback search failed:', fallbackError)
      }
    }
  }
  
  return rankAndSortResults(allResults)
}
