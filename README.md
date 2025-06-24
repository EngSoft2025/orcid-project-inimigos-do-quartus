# Interface Centralizada para Pesquisadores ORCID

Uma aplicação web moderna e intuitiva para busca, visualização e análise de perfis de pesquisadores através da API pública do ORCID, desenvolvida como parte do Trabalho da Disciplina SCC0130 - Engenharia de Software.

## 🚀 Sobre o Projeto

Esta aplicação foi desenvolvida para resolver as limitações de usabilidade da interface oficial do ORCID, oferecendo uma experiência mais moderna e intuitiva para pesquisadores e acadêmicos. O sistema permite:

- **Busca Inteligente**: Encontre pesquisadores por nome, área de atuação ou país
- **Perfis Detalhados**: Visualize informações completas sobre publicações, citações e colaborações
- **Chat com IA**: Interface conversacional para obter insights sobre o trabalho de pesquisadores
- **Exportação de Relatórios**: Gere PDFs com informações detalhadas dos perfis
- **Interface Responsiva**: Design moderno que funciona em desktop e mobile

## 🛠️ Tecnologias Utilizadas

- **Framework**: Next.js 15 com App Router
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Componentes**: Radix UI + shadcn/ui
- **IA**: OpenAI GPT para funcionalidades de chat
- **Geração de PDF**: jsPDF
- **Gerenciador de Pacotes**: pnpm

## 📋 Pré-requisitos

- Node.js 18+ 
- pnpm (recomendado) ou npm
- Chaves de API válidas (ORCID e OpenAI)

## ⚙️ Instalação e Execução

### 1. Clone o repositório
```bash
git clone git@github.com:EngSoft2025/orcid-project-inimigos-do-quartus.git
cd orcid-project-inimigos-do-quartus
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
Copie o arquivo de exemplo e configure suas credenciais:

```bash
cp .env.example .env.local
```

Em seguida, edite o arquivo `.env.local` com suas chaves reais (veja seção [Configuração do .env](#configuração-do-env) abaixo):

```bash
ORCID_CLIENT_ID=seu_client_id_orcid
ORCID_CLIENT_SECRET=seu_client_secret_orcid
OPENAI_API_KEY=sua_chave_openai
```

### 4. Execute o projeto em modo de desenvolvimento
```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) para ver a aplicação funcionando.

### 5. Build para produção
```bash
npm run build
```

## 🔐 Configuração do .env

O arquivo `.env.local` é **essencial** para o funcionamento da aplicação. Ele contém as chaves de API necessárias:

### Variáveis Obrigatórias:

1. **`ORCID_CLIENT_ID`** e **`ORCID_CLIENT_SECRET`**:
   - Obtidas registrando uma aplicação no [ORCID Developer Tools](https://orcid.org/developer-tools)
   - Necessárias para acessar a API pública do ORCID
   - Permitem buscar e recuperar dados de pesquisadores

2. **`OPENAI_API_KEY`**:
   - Chave de API da OpenAI para funcionalidades de chat com IA
   - Obtida em [OpenAI API Keys](https://platform.openai.com/api-keys)
   - Usada para gerar respostas inteligentes sobre pesquisadores

## 🎯 Funcionalidades Principais

### Página Inicial
- Interface de boas-vindas com informações sobre o projeto
- Acesso direto à funcionalidade de busca

### Busca de Pesquisadores
- Busca por nome, palavras-chave ou área de pesquisa
- Filtros por país e ordenação por relevância
- Resultados com informações resumidas de cada pesquisador

### Perfil Detalhado
- Informações completas do pesquisador
- Lista de publicações com detalhes
- Estatísticas de citações e impacto
- Interface de chat com IA para perguntas sobre o pesquisador

### Chat com IA
- Perguntas pré-sugeridas sobre o pesquisador
- Respostas contextualizadas baseadas nos dados do ORCID
- Interface conversacional intuitiva

### Exportação PDF
- Relatórios em PDF com informações completas
- Design profissional para uso acadêmico

## 📁 Estrutura do Projeto

```
/
├── app/                    # App Router do Next.js
│   ├── api/               # API Routes
│   │   ├── chat/          # Endpoint do chat com IA
│   │   ├── export-pdf/    # Geração de PDFs
│   │   ├── researcher/    # Dados de pesquisadores
│   │   └── search/        # Busca de pesquisadores
│   ├── researcher/[id]/   # Página de perfil individual
│   ├── search/           # Página de busca
│   └── page.tsx          # Página inicial
├── components/           # Componentes reutilizáveis
│   ├── ui/              # Componentes base (shadcn/ui)
│   └── chat-interface.tsx
├── lib/                 # Utilitários e configurações
│   ├── orcid-auth.ts   # Autenticação ORCID
│   └── utils.ts        # Funções auxiliares
└── styles/             # Estilos globais
```

## 🤝 Contexto Acadêmico

### Objetivos do Trabalho

Este projeto foi desenvolvido como parte dos requisitos da disciplina SCC0130 - Engenharia de Software, com os seguintes objetivos:

1. **Entrevistar 3 professores** para coletar requisitos e necessidades
2. **Desenvolver uma solução** que melhore a experiência com dados do ORCID
3. **Aplicar metodologias** de engenharia de software na prática

### Motivação

O [ORCID](https://orcid.org) é essencial para pesquisadores, mas sua interface pode ser melhorada. Nossa solução oferece:
- Interface mais moderna e intuitiva e responsiva para dispositivos móveis
- Funcionalidades de busca de pesquisadores por nome e por área de atuação
- Visualização de dados de pesquisadores aprimoradas
- Integração com IA para fazer perguntas sobre o pesquisador

## 📝 Licença

Este projeto foi desenvolvido para fins acadêmicos como parte da disciplina SCC0130 - Engenharia de Software.

## 👥 Equipe

Desenvolvido pelo grupo "Inimigos do Quartus" da disciplina SCC0130.
