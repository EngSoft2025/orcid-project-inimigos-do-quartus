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