import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Users, FileText, MessageCircle, TrendingUp, Globe } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
      {/* Header */}
      <header className="container mx-auto px-4 py-4 md:py-6">
        <nav className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 text-center sm:text-left">
            <Users className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mx-auto sm:mx-0" />
            <h1 className="text-base md:text-2xl font-bold text-gray-900 leading-tight">
              Interface Centralizada para Pesquisadores
            </h1>
          </div>
          <Link href="/search" className="w-full sm:w-auto hidden md:flex">
            <Button className="w-full sm:w-auto">Começar Busca</Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-8 md:py-16">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 md:mb-6 leading-tight">
            Descubra Pesquisadores de Forma <span className="text-blue-600">Inteligente</span>
          </h2>
          <p className="text-base md:text-xl text-gray-600 mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed px-2">
            Uma plataforma moderna e intuitiva para buscar e visualizar perfis de pesquisadores, oferecendo uma
            alternativa mais funcional e rica em informações ao ORCID tradicional.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <Link href="/search" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base md:text-lg px-6 md:px-8 py-3">
                <Search className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                Iniciar Busca
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="w-full sm:w-auto text-base md:text-lg px-6 md:px-8 py-3">
              <FileText className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Saiba Mais
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12 md:mb-16">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <Search className="h-10 w-10 md:h-12 md:w-12 text-blue-600 mb-3 md:mb-4" />
              <CardTitle className="text-lg md:text-xl">Busca Inteligente</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Encontre pesquisadores por nome ou área de expertise com tolerância a erros de digitação
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <TrendingUp className="h-10 w-10 md:h-12 md:w-12 text-green-600 mb-3 md:mb-4" />
              <CardTitle className="text-lg md:text-xl">Ranking por Impacto</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Resultados ordenados por relevância acadêmica baseada em citações e impacto científico
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow md:col-span-2 lg:col-span-1">
            <CardHeader className="p-4 md:p-6">
              <FileText className="h-10 w-10 md:h-12 md:w-12 text-purple-600 mb-3 md:mb-4" />
              <CardTitle className="text-lg md:text-xl">Currículo Visual</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Visualização clara e organizada do perfil do pesquisador com exportação em PDF
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <MessageCircle className="h-10 w-10 md:h-12 md:w-12 text-orange-600 mb-3 md:mb-4" />
              <CardTitle className="text-lg md:text-xl">Chatbot Inteligente</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Faça perguntas sobre pesquisadores e obtenha respostas contextualizadas
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <Globe className="h-10 w-10 md:h-12 md:w-12 text-teal-600 mb-3 md:mb-4" />
              <CardTitle className="text-lg md:text-xl">Dados ORCID</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Informações sempre atualizadas diretamente da base de dados oficial ORCID
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow md:col-span-2 lg:col-span-1">
            <CardHeader className="p-4 md:p-6">
              <Users className="h-10 w-10 md:h-12 md:w-12 text-red-600 mb-3 md:mb-4" />
              <CardTitle className="text-lg md:text-xl">Interface Intuitiva</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Design moderno e navegação fluida, superando limitações de plataformas existentes
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Value Proposition */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-xl p-6 md:p-12 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">
            Por que usar nossa plataforma?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="p-4">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">100%</div>
              <p className="text-sm md:text-base text-gray-600">Dados atualizados em tempo real do ORCID</p>
            </div>
            <div className="p-4">
              <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">Smart</div>
              <p className="text-sm md:text-base text-gray-600">Busca inteligente com ranking por impacto</p>
            </div>
            <div className="p-4">
              <div className="text-3xl md:text-4xl font-bold text-purple-600 mb-2">Easy</div>
              <p className="text-sm md:text-base text-gray-600">Interface simples e navegação intuitiva</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 md:py-12 mt-12 md:mt-16">
        <div className="container mx-auto px-4 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
            <Users className="h-5 w-5 md:h-6 md:w-6" />
            <span className="text-base md:text-lg font-semibold">Interface Centralizada para Pesquisadores</span>
          </div>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto">
            Facilitando a descoberta e visualização de perfis de pesquisadores através de dados ORCID
          </p>
        </div>
      </footer>
    </div>
  )
}
