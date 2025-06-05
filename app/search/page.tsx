"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, MapPin, BookOpen, TrendingUp, Users, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

interface Researcher {
  orcidId: string
  name: string
  country: string
  keywords: string[]
  citationCount: number | string
  publicationCount: number | string
  rank: number
}

const countries = [
  { value: "all", label: "Todos os países" },
  { value: "BR", label: "Brasil" },
  { value: "US", label: "Estados Unidos" },
  { value: "GB", label: "Reino Unido" },
  { value: "DE", label: "Alemanha" },
  { value: "FR", label: "França" },
  { value: "CA", label: "Canadá" },
  { value: "AU", label: "Austrália" },
  { value: "JP", label: "Japão" },
  { value: "CN", label: "China" },
  { value: "IN", label: "Índia" },
  { value: "ES", label: "Espanha" },
  { value: "IT", label: "Itália" },
  { value: "NL", label: "Holanda" },
  { value: "SE", label: "Suécia" },
  { value: "NO", label: "Noruega" },
  { value: "CH", label: "Suíça" },
  { value: "AT", label: "Áustria" },
  { value: "BE", label: "Bélgica" },
  { value: "DK", label: "Dinamarca" },
]

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState<"name" | "keywords">("name")
  const [selectedCountry, setSelectedCountry] = useState("all")
  const [results, setResults] = useState<Researcher[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle URL parameters for direct navigation from researcher profile
  useEffect(() => {
    const query = searchParams.get("query")
    const type = searchParams.get("type")

    if (query) {
      setSearchQuery(query)
      if (type === "keywords") {
        setSearchType("keywords")
      }
      // Auto-search when coming from a link
      handleSearch(query, (type as "name" | "keywords") || "name", "all")
    }
  }, [searchParams])

  const handleSearch = async (query?: string, type?: "name" | "keywords", country?: string) => {
    const searchTerm = query || searchQuery
    const searchTypeToUse = type || searchType
    const countryToUse = country || selectedCountry

    if (!searchTerm.trim()) return

    setLoading(true)
    setHasSearched(true)

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchTerm,
          type: searchTypeToUse,
          country: countryToUse === "all" ? undefined : countryToUse,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setResults(data.researchers || [])
        console.log(`Found ${data.researchers?.length || 0} researchers`)
      } else {
        let errorMessage = "Erro na busca. Tente novamente."
        
        try {
          const errorData = await response.json()
          if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch {
          // Use default error message if JSON parsing fails
        }
        
        console.error("Search failed:", response.status, errorMessage)
        setResults([])
        
        // You could add a toast notification here in the future
        // For now, just log the error - results will show "no results found"
      }
    } catch (error) {
      console.error("Network error during search:", error)
      setResults([])
      // Handle network errors gracefully - results will show "no results found"
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
              <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              <span className="text-sm md:text-lg font-semibold truncate">Interface Centralizada</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8">
        {/* Search Section */}
        <div className="max-w-4xl mx-auto mb-6 md:mb-8">
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 md:mb-4">Buscar Pesquisadores</h1>
            <p className="text-sm md:text-base text-gray-600 px-2">
              Encontre pesquisadores por nome ou área de expertise
            </p>
          </div>

          <Card className="p-4 md:p-6">
            <div className="space-y-4">
              {/* Search Type Toggle and Country Filter */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Type Buttons */}
                <div className="flex gap-2 w-full lg:w-auto">
                  <Button
                    variant={searchType === "name" ? "default" : "outline"}
                    onClick={() => setSearchType("name")}
                    size="sm"
                    className="flex-1 lg:flex-none text-xs md:text-sm"
                  >
                    Por Nome
                  </Button>
                  <Button
                    variant={searchType === "keywords" ? "default" : "outline"}
                    onClick={() => setSearchType("keywords")}
                    size="sm"
                    className="flex-1 lg:flex-none text-xs md:text-sm"
                  >
                    Por Área/Palavras-chave
                  </Button>
                </div>

                {/* Country Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
                  <span className="text-xs md:text-sm text-gray-600 whitespace-nowrap">País:</span>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Search Input */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder={
                    searchType === "name"
                      ? "Digite o nome do pesquisador..."
                      : "Digite palavras-chave (ex: gamificação, machine learning)..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 text-sm md:text-base"
                />
                <Button 
                  onClick={() => handleSearch()} 
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? "Buscando..." : "Buscar"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Results Section */}
        {hasSearched && (
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="p-4 md:p-6">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-8 w-8 md:h-12 md:w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-3 md:h-4 w-full max-w-[250px]" />
                        <Skeleton className="h-3 md:h-4 w-full max-w-[200px]" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">Resultados da Busca</h2>
                  <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
                    <Badge variant="secondary" className="text-xs md:text-sm w-fit">
                      {results.length} pesquisador(es) encontrado(s)
                    </Badge>
                    {selectedCountry !== "all" && (
                      <Badge variant="outline" className="text-xs md:text-sm w-fit">
                        Filtrado por: {countries.find((c) => c.value === selectedCountry)?.label}
                      </Badge>
                    )}
                  </div>
                </div>

                {results.map((researcher, index) => (
                  <Card
                    key={researcher.orcidId}
                    className="p-3 md:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push(`/researcher/${researcher.orcidId}`)}
                  >
                    {/* Mobile Layout */}
                    <div className="block md:hidden">
                      {/* Header with rank and name */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="bg-blue-100 text-blue-600 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                          #{researcher.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 leading-tight break-words mb-1">
                            {researcher.name}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{researcher.country || "País não informado"}</span>
                          </div>
                        </div>
                        {/* Citation count - top right */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-bold text-blue-600">
                            {typeof researcher.citationCount === 'string' ? researcher.citationCount : researcher.citationCount}
                          </div>
                          <div className="text-xs text-gray-500">citações</div>
                        </div>
                      </div>
                      {/* Stats row */}
                      <div className="flex items-center justify-between mb-3 py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <BookOpen className="h-3 w-3 flex-shrink-0" />
                          <span>{typeof researcher.publicationCount === 'string' ? researcher.publicationCount : researcher.publicationCount} pub.</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <TrendingUp className="h-3 w-3 flex-shrink-0" />
                          <span>{typeof researcher.citationCount === 'string' ? researcher.citationCount : researcher.citationCount} cit.</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Ranking #{researcher.rank}
                        </div>
                      </div>
                      {/* Keywords */}
                      {researcher.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {researcher.keywords.slice(0, 4).map((keyword, i) => (
                            <Badge key={i} variant="outline" className="text-xs py-0.5 px-2 break-words">
                              {keyword}
                            </Badge>
                          ))}
                          {researcher.keywords.length > 4 && (
                            <Badge variant="outline" className="text-xs py-0.5 px-2">
                              +{researcher.keywords.length - 4}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Desktop Layout */}
                    <div className="hidden md:flex lg:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                          <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 md:w-8 md:h-8 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0">
                            #{researcher.rank}
                          </div>
                          <h3 className="text-lg md:text-xl font-semibold text-gray-900 break-words">
                            {researcher.name}
                          </h3>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3 text-xs md:text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span className="truncate">{researcher.country || "País não informado"}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span>{typeof researcher.publicationCount === 'string' ? researcher.publicationCount : researcher.publicationCount} publicações</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span>{typeof researcher.citationCount === 'string' ? researcher.citationCount : researcher.citationCount} citações</span>
                          </div>
                        </div>
                        {researcher.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 md:gap-2">
                            {researcher.keywords.slice(0, 5).map((keyword, i) => (
                              <Badge key={i} variant="outline" className="text-xs break-words">
                                {keyword}
                              </Badge>
                            ))}
                            {researcher.keywords.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{researcher.keywords.length - 5} mais
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-center lg:text-right flex-shrink-0">
                        <div className="text-xl md:text-2xl font-bold text-blue-600">
                          {typeof researcher.citationCount === 'string' ? researcher.citationCount : researcher.citationCount}
                        </div>
                        <div className="text-xs text-gray-500">citações</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 md:p-12 text-center">
                <Search className="h-12 w-12 md:h-16 md:w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
                  Nenhum resultado encontrado
                </h3>
                <p className="text-sm md:text-base text-gray-600 max-w-md mx-auto">
                  Tente ajustar sua busca, palavras-chave ou filtro de país
                </p>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
