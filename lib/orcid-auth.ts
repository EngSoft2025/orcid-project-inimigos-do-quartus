interface OAuthToken {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

let cachedToken: OAuthToken | null = null
let tokenExpiry: number = 0

export async function getOrcidAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken.access_token
  }

  const clientId = process.env.ORCID_CLIENT_ID
  const clientSecret = process.env.ORCID_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('ORCID credentials not configured')
  }

  const response = await fetch('https://orcid.org/oauth/token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'client_id': clientId,
      'client_secret': clientSecret,
      'scope': '/read-public',
      'grant_type': 'client_credentials',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get ORCID access token: ${response.status}`)
  }

  const token: OAuthToken = await response.json()
  
  // Cache the token with a buffer (expire 5 minutes early)
  cachedToken = token
  tokenExpiry = Date.now() + (token.expires_in - 300) * 1000

  return token.access_token
}

export async function makeAuthenticatedOrcidRequest(url: string): Promise<Response> {
  const accessToken = await getOrcidAccessToken()
  
  return fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  })
}

// Utility to search for additional academic data from other platforms
export async function searchCrossRef(title: string, author?: string): Promise<{ citations?: number, doi?: string } | null> {
  try {
    const query = author ? `${title} ${author}` : title
    const response = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=1`, {
      headers: {
        'User-Agent': 'ResearchersPlatform/1.0 (mailto:admin@example.com)'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      const work = data.message?.items?.[0]
      
      if (work) {
        return {
          citations: work['is-referenced-by-count'] || undefined,
          doi: work.DOI || undefined
        }
      }
    }
  } catch (error) {
    console.error('CrossRef search error:', error)
  }
  return null
}

export async function searchOpenAlex(title: string, authorName?: string): Promise<{ citations?: number, hIndex?: number } | null> {
  try {
    const query = authorName ? `${title} ${authorName}` : title
    const response = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=1`)
    
    if (response.ok) {
      const data = await response.json()
      const work = data.results?.[0]
      
      if (work) {
        return {
          citations: work.cited_by_count || undefined
        }
      }
    }
  } catch (error) {
    console.error('OpenAlex search error:', error)
  }
  return null
}

export async function searchSemanticScholar(title: string): Promise<{ citations?: number } | null> {
  try {
    const response = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title)}&limit=1&fields=citationCount`)
    
    if (response.ok) {
      const data = await response.json()
      const paper = data.data?.[0]
      
      if (paper) {
        return {
          citations: paper.citationCount || undefined
        }
      }
    }
  } catch (error) {
    console.error('Semantic Scholar search error:', error)
  }
  return null
}

export async function getEnhancedPublicationData(title: string, authorName?: string): Promise<{ citations?: number, doi?: string }> {
  // Try multiple sources in parallel
  const [crossRefData, openAlexData, semanticData] = await Promise.allSettled([
    searchCrossRef(title, authorName),
    searchOpenAlex(title, authorName),
    searchSemanticScholar(title)
  ])
  
  let citations: number | undefined
  let doi: string | undefined
  
  // Extract data from successful responses
  if (crossRefData.status === 'fulfilled' && crossRefData.value) {
    citations = crossRefData.value.citations
    doi = crossRefData.value.doi
  }
  
  if (openAlexData.status === 'fulfilled' && openAlexData.value) {
    citations = citations || openAlexData.value.citations
  }
  
  if (semanticData.status === 'fulfilled' && semanticData.value) {
    citations = citations || semanticData.value.citations
  }
  
  return { citations, doi }
}