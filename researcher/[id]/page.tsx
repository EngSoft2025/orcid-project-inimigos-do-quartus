"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  MapPin,
  Mail,
  ExternalLink,
  BookOpen,
  TrendingUp,
  Download,
  Users,
  Building,
  GraduationCap,
  Globe,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChatInterface } from "@/components/chat-interface"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface Publication {
  title: string
  year: number
  journal: string
  citations: number | string
  doi?: string
}

interface Employment {
  organization: string
  role: string
  startDate?: string
  endDate?: string
}

interface Education {
  organization: string
  degree: string
  year?: string
}

interface ResearcherProfile {
  orcidId: string
  name: string
  country: string
  email?: string
  website?: string
  keywords: string[]
  publications: Publication[]
  totalCitations: number | string
  hIndex: number | string
  biography?: string
  employments: Employment[]
  educations: Education[]
}

export default function ResearcherProfilePage() {
  const params = useParams()
  const orcidId = params.id as string
  const [profile, setProfile] = useState<ResearcherProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOrder, setSortOrder] = useState<"year-desc" | "year-asc" | "citations-desc" | "citations-asc" | "title">(
    "year-desc",
  )

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/researcher/${orcidId}`)
        if (response.ok) {
          const data = await response.json()
          setProfile(data)
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
      } finally {
        setLoading(false)
      }
    }

    if (orcidId) {
      fetchProfile()
    }
  }, [orcidId])

  const handleExportPDF = async () => {
    try {
      const response = await fetch(`/api/export-pdf/${orcidId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${profile?.name || "researcher"}-profile.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error("Error exporting PDF:", error)
    }
  }

  const getPublicationLink = (publication: Publication) => {
    if (publication.doi) {
      return `https://doi.org/${publication.doi}`
    }
    // Fallback to Google Scholar search
    return `https://scholar.google.com/scholar?q=${encodeURIComponent(publication.title)}`
  }

  const getFilteredAndSortedPublications = () => {
    if (!profile) return []
    
    const filtered = profile.publications.filter(
      (pub) =>
        pub.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pub.journal.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    switch (sortOrder) {
      case "year-desc":
        return filtered.sort((a, b) => b.year - a.year)
      case "year-asc":
        return filtered.sort((a, b) => a.year - b.year)
      case "citations-desc":
        return filtered.sort((a, b) => {
          const aCitations = typeof a.citations === 'string' ? 0 : a.citations
          const bCitations = typeof b.citations === 'string' ? 0 : b.citations
          return bCitations - aCitations
        })
      case "citations-asc":
        return filtered.sort((a, b) => {
          const aCitations = typeof a.citations === 'string' ? 0 : a.citations
          const bCitations = typeof b.citations === 'string' ? 0 : b.citations
          return aCitations - bCitations
        })
      case "title":
        return filtered.sort((a, b) => a.title.localeCompare(b.title))
      default:
        return filtered
    }
  }

  // Helper function to safely get numeric citations
  const getNumericCitations = (publications: Publication[]) => {
    return publications
      .map(p => typeof p.citations === 'number' ? p.citations : 0)
      .filter(c => c > 0)
  }

  // Helper function to safely calculate total citations for display
  const getTotalCitationsForCalculation = () => {
    if (!profile) return 0
    if (typeof profile.totalCitations === 'number') return profile.totalCitations
    return getNumericCitations(profile.publications).reduce((sum, citations) => sum + citations, 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Pesquisador não encontrado</h2>
          <p className="text-gray-600 mb-4">O perfil solicitado não pôde ser carregado.</p>
          <Link href="/search">
            <Button>Voltar à Busca</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/search" className="flex items-center space-x-2">
            <ArrowLeft className="h-5 w-5" />
            <Users className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-semibold">Voltar à Busca</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Mobile Layout */}
        <div className="lg:hidden space-y-6">
          {/* Profile Header */}
          <Card className="p-4 sm:p-6">
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{profile.name}</h1>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mb-6 text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{profile.country || "País não informado"}</span>
                  </div>
                  {profile.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${profile.email}`} className="hover:text-blue-600 text-sm break-all">
                        {profile.email}
                      </a>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 text-sm"
                      >
                        Website
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    <a
                      href={`https://orcid.org/${orcidId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 text-sm break-all"
                    >
                      ORCID: {orcidId}
                    </a>
                  </div>
                </div>
              </div>

              {profile.biography && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Biografia</h3>
                  <p className="text-gray-700 leading-relaxed text-sm">{profile.biography}</p>
                </div>
              )}

              {profile.employments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Afiliações Profissionais
                  </h3>
                  <div className="space-y-3">
                    {profile.employments.map((emp, index) => (
                      <div key={index} className="border-l-4 border-blue-200 pl-4">
                        <div className="font-medium text-gray-900 text-sm">{emp.role}</div>
                        <div className="text-gray-600 text-sm">{emp.organization}</div>
                        {(emp.startDate || emp.endDate) && (
                          <div className="text-xs text-gray-500">
                            {emp.startDate} {emp.endDate ? `- ${emp.endDate}` : "- Presente"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.educations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Formação Acadêmica
                  </h3>
                  <div className="space-y-3">
                    {profile.educations.map((edu, index) => (
                      <div key={index} className="border-l-4 border-green-200 pl-4">
                        <div className="font-medium text-gray-900 text-sm">{edu.degree}</div>
                        <div className="text-gray-600 text-sm">{edu.organization}</div>
                        {edu.year && <div className="text-xs text-gray-500">{edu.year}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.keywords.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Áreas de Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.keywords.map((keyword, i) => (
                      <Link
                        key={i}
                        href={`/search?query=${encodeURIComponent(keyword)}&type=keywords`}
                        className="hover:scale-105 transition-transform"
                      >
                        <Badge variant="secondary" className="cursor-pointer hover:bg-blue-100 text-xs">
                          {keyword}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* PDF Export Button */}
              <div className="pt-4 border-t">
                <Button onClick={handleExportPDF} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Currículo em PDF
                </Button>
              </div>
            </div>
          </Card>

          {/* Statistics - Mobile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estatísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Total de Citações</span>
                  <span className="font-semibold text-blue-600">
                    {typeof profile.totalCitations === 'string' ? profile.totalCitations : profile.totalCitations}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Índice H</span>
                  <span className="font-semibold text-green-600">
                    {typeof profile.hIndex === 'string' ? profile.hIndex : profile.hIndex}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Publicações</span>
                  <span className="font-semibold text-purple-600">{profile.publications.length}</span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Publicações por ano</span>
                  <span className="font-semibold">
                    {(
                      profile.publications.length /
                      Math.max(1, new Date().getFullYear() - Math.min(...profile.publications.map((p) => p.year)))
                    ).toFixed(1)}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Citações por publicação</span>
                  <span className="font-semibold">
                    {profile.publications.length > 0
                      ? (getTotalCitationsForCalculation() / profile.publications.length).toFixed(1)
                      : "-"}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Publicação mais citada</span>
                  <span className="font-semibold">
                    {(() => {
                      const numericCitations = getNumericCitations(profile.publications)
                      return numericCitations.length > 0 ? Math.max(...numericCitations) : "-"
                    })()}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Últimos 5 anos</span>
                  <span className="font-semibold">
                    {profile.publications.filter((p) => p.year >= new Date().getFullYear() - 5).length || "-"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chat Interface - Mobile */}
          <ChatInterface researcherName={profile.name} researcherData={profile} />

          {/* Publications - Mobile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5" />
                Publicações ({profile.publications.length})
              </CardTitle>
              <CardDescription className="text-sm">Lista completa de publicações com busca e ordenação</CardDescription>
              {/* Search and Sort Controls */}
              <div className="flex flex-col gap-3 mt-4">
                <div className="w-full">
                  <Input
                    placeholder="Buscar publicações por título ou revista..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-sm"
                  />
                </div>
                <div className="w-full">
                  <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="year-desc">Mais recentes</SelectItem>
                      <SelectItem value="year-asc">Mais antigas</SelectItem>
                      <SelectItem value="citations-desc">Mais citadas</SelectItem>
                      <SelectItem value="citations-asc">Menos citadas</SelectItem>
                      <SelectItem value="title">Título (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getFilteredAndSortedPublications().length > 0 ? (
                  getFilteredAndSortedPublications().map((publication, index) => (
                    <Card key={index} className="p-3 md:p-4 hover:shadow-md transition-shadow">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 mb-1 md:mb-2 text-sm md:text-base leading-tight break-words">
                            <a
                              href={getPublicationLink(publication)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {publication.title}
                            </a>
                          </h3>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs md:text-sm text-gray-600 mb-2">
                            <span className="font-medium">{publication.journal}</span>
                            <span>{publication.year}</span>
                            {publication.doi && (
                              <span className="text-blue-600 break-all">DOI: {publication.doi}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex lg:flex-col items-center lg:items-end gap-2 lg:gap-1 flex-shrink-0">
                          <div className="text-center lg:text-right">
                            <div className="text-lg md:text-xl font-bold text-blue-600">
                              {typeof publication.citations === 'string' ? publication.citations : publication.citations}
                            </div>
                            <div className="text-xs text-gray-500">citações</div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400 lg:mt-1" />
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm">Nenhuma publicação encontrada com os critérios de busca.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Header */}
            <Card className="p-8">
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">{profile.name}</h1>
                  <div className="flex items-center gap-6 mb-6 text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      {profile.country || "País não informado"}
                    </div>
                    {profile.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        <a href={`mailto:${profile.email}`} className="hover:text-blue-600">
                          {profile.email}
                        </a>
                      </div>
                    )}
                    {profile.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600"
                        >
                          Website
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-5 w-5" />
                      <a
                        href={`https://orcid.org/${orcidId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600"
                      >
                        ORCID: {orcidId}
                      </a>
                    </div>
                  </div>
                </div>

                {profile.biography && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Biografia</h3>
                    <p className="text-gray-700 leading-relaxed">{profile.biography}</p>
                  </div>
                )}

                {profile.employments.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Afiliações Profissionais
                    </h3>
                    <div className="space-y-3">
                      {profile.employments.map((emp, index) => (
                        <div key={index} className="border-l-4 border-blue-200 pl-4">
                          <div className="font-medium text-gray-900">{emp.role}</div>
                          <div className="text-gray-600">{emp.organization}</div>
                          {(emp.startDate || emp.endDate) && (
                            <div className="text-sm text-gray-500">
                              {emp.startDate} {emp.endDate ? `- ${emp.endDate}` : "- Presente"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile.educations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Formação Acadêmica
                    </h3>
                    <div className="space-y-3">
                      {profile.educations.map((edu, index) => (
                        <div key={index} className="border-l-4 border-green-200 pl-4">
                          <div className="font-medium text-gray-900">{edu.degree}</div>
                          <div className="text-gray-600">{edu.organization}</div>
                          {edu.year && <div className="text-sm text-gray-500">{edu.year}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile.keywords.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Áreas de Expertise</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.keywords.map((keyword, i) => (
                        <Link
                          key={i}
                          href={`/search?query=${encodeURIComponent(keyword)}&type=keywords`}
                          className="hover:scale-105 transition-transform"
                        >
                          <Badge variant="secondary" className="cursor-pointer hover:bg-blue-100">
                            {keyword}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* PDF Export Button */}
                <div className="pt-4 border-t">
                  <Button onClick={handleExportPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Currículo em PDF
                  </Button>
                </div>
              </div>
            </Card>

            {/* Publications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Publicações ({profile.publications.length})
                </CardTitle>
                <CardDescription>Lista completa de publicações com busca e ordenação</CardDescription>
                {/* Search and Sort Controls */}
                <div className="flex gap-4 mt-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Buscar publicações por título ou revista..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="w-48">
                    <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="year-desc">Mais recentes</SelectItem>
                        <SelectItem value="year-asc">Mais antigas</SelectItem>
                        <SelectItem value="citations-desc">Mais citadas</SelectItem>
                        <SelectItem value="citations-asc">Menos citadas</SelectItem>
                        <SelectItem value="title">Título (A-Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getFilteredAndSortedPublications().length > 0 ? (
                    getFilteredAndSortedPublications().map((publication, index) => (
                      <Card key={index} className="p-3 md:p-4 hover:shadow-md transition-shadow">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 md:mb-2 text-sm md:text-base leading-tight break-words">
                              <a
                                href={getPublicationLink(publication)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {publication.title}
                              </a>
                            </h3>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs md:text-sm text-gray-600 mb-2">
                              <span className="font-medium">{publication.journal}</span>
                              <span>{publication.year}</span>
                              {publication.doi && (
                                <span className="text-blue-600 break-all">DOI: {publication.doi}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex lg:flex-col items-center lg:items-end gap-2 lg:gap-1 flex-shrink-0">
                            <div className="text-center lg:text-right">
                              <div className="text-lg md:text-xl font-bold text-blue-600">
                                {typeof publication.citations === 'string' ? publication.citations : publication.citations}
                              </div>
                              <div className="text-xs text-gray-500">citações</div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-gray-400 lg:mt-1" />
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>Nenhuma publicação encontrada com os critérios de busca.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* All Statistics with consistent layout */}
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total de Citações</span>
                    <span className="font-semibold text-blue-600">
                      {typeof profile.totalCitations === 'string' ? profile.totalCitations : profile.totalCitations}
                    </span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Índice H</span>
                    <span className="font-semibold text-green-600">
                      {typeof profile.hIndex === 'string' ? profile.hIndex : profile.hIndex}
                    </span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Publicações</span>
                    <span className="font-semibold text-purple-600">{profile.publications.length}</span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Publicações por ano</span>
                    <span className="font-semibold">
                      {(
                        profile.publications.length /
                        Math.max(1, new Date().getFullYear() - Math.min(...profile.publications.map((p) => p.year)))
                      ).toFixed(1)}
                    </span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Citações por publicação</span>
                    <span className="font-semibold">
                      {profile.publications.length > 0
                        ? (getTotalCitationsForCalculation() / profile.publications.length).toFixed(1)
                        : "-"}
                    </span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Publicação mais citada</span>
                    <span className="font-semibold">
                      {(() => {
                        const numericCitations = getNumericCitations(profile.publications)
                        return numericCitations.length > 0 ? Math.max(...numericCitations) : "-"
                      })()}
                    </span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Últimos 5 anos</span>
                    <span className="font-semibold">
                      {profile.publications.filter((p) => p.year >= new Date().getFullYear() - 5).length || "-"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chat Interface */}
            <div className="sticky top-8">
              <ChatInterface researcherName={profile.name} researcherData={profile} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
