import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message, researcherData, conversationHistory } =
      await request.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Enhanced researcher context preparation
    const researcherContext = buildEnhancedResearcherContext(researcherData);

    // Prepare messages for OpenAI API
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `Você é um assistente especializado em pesquisa acadêmica e análise de perfis científicos. Sua função é responder perguntas sobre pesquisadores com base nas informações detalhadas do perfil ORCID fornecidas.

CONTEXTO DETALHADO DO PESQUISADOR:
${researcherContext}

INSTRUÇÕES AVANÇADAS:
- Responda sempre em português brasileiro com linguagem técnica mas acessível
- Base suas respostas exclusivamente nas informações fornecidas acima
- Quando perguntado sobre trabalhos mais citados, consulte a seção "PRINCIPAIS PUBLICAÇÕES" ordenada por citações
- Para análises de impacto, utilize as métricas acadêmicas e o nível de impacto fornecido
- Ao discutir áreas de pesquisa, referencie tanto as palavras-chave quanto as categorizações fornecidas
- Para questões sobre carreira, use as informações de formação e afiliações profissionais
- Se uma informação específica não estiver disponível, seja transparente sobre as limitações dos dados
- Forneça contexto adicional quando relevante (ex: explicar o que significa índice H, significado de métricas)
- Para comparações ou rankings, use apenas os dados disponíveis do pesquisador
- Mantenha um tom profissional, analítico e objetivo
- Sugira consultar o perfil ORCID completo para informações não disponíveis nos dados fornecidos

CAPACIDADES ANALÍTICAS:
- Identificar padrões nas publicações e carreira do pesquisador
- Avaliar produtividade acadêmica com base nas métricas disponíveis
- Contextualizar a pesquisa dentro das áreas de expertise identificadas
- Analisar a evolução temporal da carreira acadêmica
- Identificar colaborações baseadas em afiliações institucionais`,
      },
    ];

    // Add conversation history
    conversationHistory.forEach((msg: any) => {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    });

    // Add current user message
    messages.push({
      role: "user",
      content: message,
    });

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response =
      completion.choices[0]?.message?.content ||
      "Desculpe, não consegui gerar uma resposta.";

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Chat error:", error);

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "Erro de configuração da API" },
          { status: 500 }
        );
      }
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          {
            error:
              "Limite de requisições excedido. Tente novamente em alguns minutos.",
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * Builds enhanced context about the researcher for better chatbot responses
 * @param researcherData - The researcher data from ORCID API
 * @returns Formatted context string with detailed analysis
 */
function buildEnhancedResearcherContext(researcherData: any): string {
  // Basic researcher information
  const basicInfo = `
INFORMAÇÕES BÁSICAS DO PESQUISADOR:
- Nome: ${researcherData.name || "Não informado"}
- País: ${researcherData.country || "Não informado"}
- ORCID ID: ${researcherData.orcidId || "Não informado"}
- Email: ${researcherData.email || "Não informado"}
- Website: ${researcherData.website || "Não informado"}
`;

  // Academic metrics with analysis
  const metricsAnalysis = buildMetricsAnalysis(researcherData);

  // Publications analysis
  const publicationsAnalysis = buildPublicationsAnalysis(
    researcherData.publications || []
  );

  // Career timeline analysis
  const careerAnalysis = buildCareerTimelineAnalysis(researcherData);

  // Keywords and research areas
  const researchAreasInfo = buildResearchAreasInfo(
    researcherData.keywords || []
  );

  // Professional background
  const professionalBackground = buildProfessionalBackground(
    researcherData.employments || [],
    researcherData.educations || []
  );

  // Biography and additional context
  const biographySection = researcherData.biography
    ? `\nBIOGRAFIA:\n${researcherData.biography}`
    : "\nBIOGRAFIA: Não disponível";

  return [
    basicInfo,
    metricsAnalysis,
    publicationsAnalysis,
    careerAnalysis,
    researchAreasInfo,
    professionalBackground,
    biographySection,
  ].join("\n");
}

/**
 * Analyzes academic metrics and provides context
 */
function buildMetricsAnalysis(researcherData: any): string {
  const totalCitations = researcherData.totalCitations || 0;
  const hIndex = researcherData.hIndex || 0;
  const publicationCount = researcherData.publications?.length || 0;

  let analysis = `\nMÉTRICAS ACADÊMICAS DETALHADAS:
- Total de citações: ${totalCitations}
- Índice H: ${hIndex}
- Número de publicações: ${publicationCount}`;

  // Enhanced contextual analysis
  if (publicationCount > 0) {
    const avgCitationsPerPaper = totalCitations / publicationCount;
    analysis += `\n- Média de citações por publicação: ${avgCitationsPerPaper.toFixed(
      2
    )}`;

    // Productivity classification
    let productivityLevel = "Baixa";
    if (publicationCount >= 50) productivityLevel = "Muito Alta";
    else if (publicationCount >= 20) productivityLevel = "Alta";
    else if (publicationCount >= 10) productivityLevel = "Média";

    analysis += `\n- Produtividade de publicação: ${productivityLevel}`;
  }

  // Enhanced impact level assessment with more detailed criteria
  let impactLevel = "Emergente";
  let impactDescription = "";

  if (hIndex >= 20 && totalCitations >= 2000) {
    impactLevel = "Muito Alto";
    impactDescription = "Pesquisador de referência internacional";
  } else if (hIndex >= 15 && totalCitations >= 1000) {
    impactLevel = "Alto";
    impactDescription = "Pesquisador estabelecido com forte impacto";
  } else if (hIndex >= 10 && totalCitations >= 500) {
    impactLevel = "Médio-Alto";
    impactDescription = "Pesquisador consolidado";
  } else if (hIndex >= 5 && totalCitations >= 100) {
    impactLevel = "Médio";
    impactDescription = "Pesquisador em consolidação";
  } else if (hIndex >= 2 || totalCitations >= 25) {
    impactLevel = "Baixo-Médio";
    impactDescription = "Pesquisador em desenvolvimento";
  } else {
    impactLevel = "Emergente";
    impactDescription =
      "Pesquisador iniciante ou com pouca visibilidade online";
  }

  analysis += `\n- Nível de impacto acadêmico: ${impactLevel}`;
  analysis += `\n- Classificação: ${impactDescription}`;

  // H-index contextual information
  if (hIndex > 0) {
    analysis += `\n- Interpretação do índice H: O pesquisador tem ${hIndex} publicações com pelo menos ${hIndex} citações cada`;
  }

  // Citation distribution insights if we have publications data
  if (researcherData.publications && researcherData.publications.length > 0) {
    const pubsWithCitations = researcherData.publications.filter((pub: any) => {
      const citations =
        typeof pub.citations === "number"
          ? pub.citations
          : typeof pub.citations === "string" && !isNaN(Number(pub.citations))
          ? Number(pub.citations)
          : 0;
      return citations > 0;
    });

    const citationCoverage = (
      (pubsWithCitations.length / publicationCount) *
      100
    ).toFixed(1);
    analysis += `\n- Cobertura de citações: ${citationCoverage}% das publicações têm dados de citação`;
  }

  return analysis;
}

/**
 * Analyzes publications and identifies patterns
 */
function buildPublicationsAnalysis(publications: any[]): string {
  if (!publications || publications.length === 0) {
    return "\nANÁLISE DE PUBLICAÇÕES:\n- Nenhuma publicação encontrada no ORCID";
  }

  // Sort publications by citations (handle both number and string types)
  const sortedPubs = publications
    .map((pub) => ({
      ...pub,
      citationNumber:
        typeof pub.citations === "number"
          ? pub.citations
          : typeof pub.citations === "string" && !isNaN(Number(pub.citations))
          ? Number(pub.citations)
          : 0,
    }))
    .sort((a, b) => b.citationNumber - a.citationNumber);

  const mostCitedPaper = sortedPubs[0];
  const recentPapers = publications.filter((pub) => {
    const year = pub.year || 0;
    return year >= new Date().getFullYear() - 3;
  });

  // Publication years analysis
  const years = publications.map((pub) => pub.year).filter(Boolean);
  const earliestYear = Math.min(...years);
  const latestYear = Math.max(...years);
  const careerSpan = latestYear - earliestYear;

  // Journal analysis
  const journals = publications.map((pub) => pub.journal).filter(Boolean);
  const uniqueJournals = [...new Set(journals)];

  // Citation statistics
  const validCitations = sortedPubs
    .map((pub) => pub.citationNumber)
    .filter((citations) => citations > 0);

  const totalValidCitations = validCitations.reduce(
    (sum, citations) => sum + citations,
    0
  );
  const avgCitations =
    validCitations.length > 0 ? totalValidCitations / validCitations.length : 0;
  const medianCitations =
    validCitations.length > 0
      ? validCitations.sort((a, b) => a - b)[
          Math.floor(validCitations.length / 2)
        ]
      : 0;

  // Productivity analysis
  const currentYear = new Date().getFullYear();
  const last5Years = publications.filter(
    (pub) => pub.year >= currentYear - 5
  ).length;
  const last10Years = publications.filter(
    (pub) => pub.year >= currentYear - 10
  ).length;

  let analysis = `\nANÁLISE DETALHADA DE PUBLICAÇÕES:
- Total de publicações: ${publications.length}
- Período de carreira: ${earliestYear} - ${latestYear} (${careerSpan} anos)
- Publicações últimos 3 anos: ${recentPapers.length}
- Publicações últimos 5 anos: ${last5Years}
- Publicações últimos 10 anos: ${last10Years}
- Revistas distintas: ${uniqueJournals.length}
- Produtividade média: ${
    careerSpan > 0 ? (publications.length / careerSpan).toFixed(2) : 0
  } publicações/ano`;

  if (validCitations.length > 0) {
    analysis += `\n\nESTATÍSTICAS DE CITAÇÕES:
- Publicações com citações conhecidas: ${validCitations.length}/${
      publications.length
    }
- Média de citações: ${avgCitations.toFixed(2)}
- Mediana de citações: ${medianCitations}
- Total de citações válidas: ${totalValidCitations}`;
  }

  if (mostCitedPaper && mostCitedPaper.citationNumber > 0) {
    const impactPercentage = (
      (mostCitedPaper.citationNumber / totalValidCitations) *
      100
    ).toFixed(1);
    analysis += `\n- Trabalho mais citado representa ${impactPercentage}% do total de citações`;
    analysis += `\n- TRABALHO MAIS CITADO: "${mostCitedPaper.title}" (${
      mostCitedPaper.citationNumber
    } citações, ${mostCitedPaper.year || "ano não informado"})`;
  }

  // Publication trend analysis
  if (years.length > 1) {
    const recentYears = years.filter((year) => year >= currentYear - 5);
    const earlierYears = years.filter((year) => year < currentYear - 5);

    if (recentYears.length > 0 && earlierYears.length > 0) {
      const recentAvg = recentYears.length / 5;
      const earlierAvg =
        earlierYears.length / Math.max(1, earliestYear - (currentYear - 5));

      const trend =
        recentAvg > earlierAvg
          ? "crescente"
          : recentAvg < earlierAvg
          ? "decrescente"
          : "estável";
      analysis += `\n- Tendência de produtividade: ${trend}`;
    }
  }

  // Top publications with detailed info
  const topPublications = sortedPubs.slice(0, 5);
  analysis += "\n\nTOP 5 PUBLICAÇÕES (ordenadas por citações):";
  topPublications.forEach((pub, index) => {
    const citations =
      pub.citationNumber > 0
        ? `${pub.citationNumber} citações`
        : "Citações não disponíveis";
    analysis += `\n${index + 1}. "${pub.title || "Título não disponível"}"`;
    analysis += `\n   Ano: ${
      pub.year || "Não informado"
    } | Citações: ${citations}`;
    if (pub.journal) {
      analysis += `\n   Revista: ${pub.journal}`;
    }
    if (pub.doi) {
      analysis += `\n   DOI: ${pub.doi}`;
    }
    analysis += "";
  });

  // Impact distribution analysis
  if (validCitations.length >= 3) {
    const highImpact = validCitations.filter((c) => c >= 50).length;
    const mediumImpact = validCitations.filter((c) => c >= 10 && c < 50).length;
    const lowImpact = validCitations.filter((c) => c < 10).length;

    analysis += `\n\nDISTRIBUIÇÃO DE IMPACTO:
- Publicações alta influência (≥50 citações): ${highImpact}
- Publicações média influência (10-49 citações): ${mediumImpact}
- Publicações baixa influência (<10 citações): ${lowImpact}`;
  }

  return analysis;
}

/**
 * Analyzes research areas and keywords
 */
function buildResearchAreasInfo(keywords: string[]): string {
  if (!keywords || keywords.length === 0) {
    return "\nÁREAS DE PESQUISA:\n- Não há palavras-chave registradas";
  }

  let analysis = `\nÁREAS DE PESQUISA E EXPERTISE:
- Número de palavras-chave: ${keywords.length}
- Principais áreas: ${keywords.slice(0, 10).join(", ")}`;

  if (keywords.length > 10) {
    analysis += `\n- Outras áreas: ${keywords.slice(10).join(", ")}`;
  }

  // Categorize keywords (basic categorization)
  const methodKeywords = keywords.filter(
    (k) =>
      k.toLowerCase().includes("method") ||
      k.toLowerCase().includes("analysis") ||
      k.toLowerCase().includes("technique")
  );

  const fieldKeywords = keywords.filter(
    (k) =>
      k.toLowerCase().includes("science") ||
      k.toLowerCase().includes("engineering") ||
      k.toLowerCase().includes("medicine") ||
      k.toLowerCase().includes("biology")
  );

  if (methodKeywords.length > 0) {
    analysis += `\n- Métodos/Técnicas: ${methodKeywords.join(", ")}`;
  }

  if (fieldKeywords.length > 0) {
    analysis += `\n- Campos científicos: ${fieldKeywords.join(", ")}`;
  }

  return analysis;
}

/**
 * Builds professional background information
 */
function buildProfessionalBackground(
  employments: any[],
  educations: any[]
): string {
  let background = "\nFORMAÇÃO E CARREIRA PROFISSIONAL:";

  // Current employment
  if (employments && employments.length > 0) {
    const currentEmployment = employments[0];
    background += `\n\nAFILIAÇÃO ATUAL:
- Instituição: ${currentEmployment.organization || "Não informado"}
- Cargo: ${currentEmployment.role || "Não informado"}`;

    if (currentEmployment.startDate) {
      background += `\n- Início: ${currentEmployment.startDate}`;
    }

    // Previous employments
    if (employments.length > 1) {
      background += "\n\nAFILIAÇÕES ANTERIORES:";
      employments.slice(1, 4).forEach((emp, index) => {
        background += `\n${index + 1}. ${
          emp.organization || "Não informado"
        } - ${emp.role || "Não informado"}`;
        if (emp.startDate || emp.endDate) {
          background += ` (${emp.startDate || "?"} - ${
            emp.endDate || "Presente"
          })`;
        }
      });
    }
  }

  // Education
  if (educations && educations.length > 0) {
    background += "\n\nFORMAÇÃO ACADÊMICA:";
    educations.slice(0, 5).forEach((edu, index) => {
      background += `\n${index + 1}. ${edu.degree || "Grau não informado"} - ${
        edu.organization || "Instituição não informada"
      }`;
      if (edu.year) {
        background += ` (${edu.year})`;
      }
    });
  }

  return background;
}

/**
 * Analyzes career timeline and academic progression
 */
function buildCareerTimelineAnalysis(researcherData: any): string {
  const publications = researcherData.publications || [];
  const employments = researcherData.employments || [];
  const educations = researcherData.educations || [];

  if (
    publications.length === 0 &&
    employments.length === 0 &&
    educations.length === 0
  ) {
    return "\nANÁLISE TEMPORAL DA CARREIRA:\n- Dados insuficientes para análise temporal";
  }

  let analysis = "\nANÁLISE TEMPORAL DA CARREIRA:";

  // Publication timeline analysis
  if (publications.length > 0) {
    const years = publications
      .map((pub: any) => pub.year)
      .filter(Boolean)
      .sort((a: number, b: number) => a - b);
    if (years.length > 0) {
      const firstPublication = years[0];
      const latestPublication = years[years.length - 1];
      const careerSpan = latestPublication - firstPublication;
      const currentYear = new Date().getFullYear();

      analysis += `\n\nTRAJETÓRIA DE PUBLICAÇÕES:
- Primeira publicação registrada: ${firstPublication}
- Publicação mais recente: ${latestPublication}
- Tempo de carreira acadêmica: ${careerSpan} anos
- Tempo desde última publicação: ${currentYear - latestPublication} anos`;

      // Analyze publication periods
      const periods = {
        early: years.filter(
          (y: number) => y <= firstPublication + Math.floor(careerSpan * 0.33)
        ).length,
        middle: years.filter(
          (y: number) =>
            y > firstPublication + Math.floor(careerSpan * 0.33) &&
            y <= firstPublication + Math.floor(careerSpan * 0.66)
        ).length,
        recent: years.filter(
          (y: number) => y > firstPublication + Math.floor(careerSpan * 0.66)
        ).length,
      };

      if (careerSpan >= 6) {
        analysis += `\n- Distribuição por período:
  • Período inicial (primeiros 33%): ${periods.early} publicações
  • Período médio: ${periods.middle} publicações  
  • Período recente (últimos 33%): ${periods.recent} publicações`;

        // Identify the most productive period
        const mostProductivePeriod =
          periods.early >= periods.middle && periods.early >= periods.recent
            ? "inicial"
            : periods.middle >= periods.recent
            ? "médio"
            : "recente";
        analysis += `\n- Período mais produtivo: ${mostProductivePeriod}`;
      }

      // Recent activity analysis
      const last3Years = publications.filter(
        (pub: any) => pub.year >= currentYear - 3
      ).length;
      const last5Years = publications.filter(
        (pub: any) => pub.year >= currentYear - 5
      ).length;

      if (last3Years === 0) {
        analysis += "\n- Status atual: Sem publicações nos últimos 3 anos";
      } else if (last3Years >= 3) {
        analysis +=
          "\n- Status atual: Pesquisador ativo (3+ publicações nos últimos 3 anos)";
      } else {
        analysis += `\n- Status atual: Atividade moderada (${last3Years} publicações nos últimos 3 anos)`;
      }
    }
  }

  // Career milestones analysis
  let milestones: Array<{ year: number; event: string; type: string }> = [];

  // Add education milestones
  educations.forEach((edu: any) => {
    if (edu.year) {
      milestones.push({
        year: parseInt(edu.year),
        event: `${edu.degree} - ${edu.organization}`,
        type: "educação",
      });
    }
  });

  // Add employment milestones
  employments.forEach((emp: any) => {
    if (emp.startDate) {
      const year =
        parseInt(emp.startDate.split("-")[0]) || parseInt(emp.startDate);
      if (!isNaN(year)) {
        milestones.push({
          year: year,
          event: `Início: ${emp.role} - ${emp.organization}`,
          type: "carreira",
        });
      }
    }
  });

  // Sort milestones by year
  milestones = milestones.sort((a, b) => a.year - b.year);

  if (milestones.length > 0) {
    analysis += "\n\nPRINCIPAIS MARCOS DA CARREIRA:";
    milestones.slice(0, 8).forEach((milestone) => {
      analysis += `\n- ${milestone.year}: ${milestone.event}`;
    });
  }

  // Career stage assessment
  const currentYear = new Date().getFullYear();
  const publicationYears = publications
    .map((pub: any) => pub.year)
    .filter(Boolean);
  const firstPubYear = Math.min(...publicationYears);

  if (publicationYears.length > 0) {
    const yearsActive = currentYear - firstPubYear;
    let careerStage = "";

    if (yearsActive <= 5) {
      careerStage = "Início de carreira (0-5 anos)";
    } else if (yearsActive <= 15) {
      careerStage = "Carreira estabelecida (6-15 anos)";
    } else if (yearsActive <= 25) {
      careerStage = "Carreira consolidada (16-25 anos)";
    } else {
      careerStage = "Carreira sênior (25+ anos)";
    }

    analysis += `\n\nESTÁGIO DA CARREIRA:
- Classificação: ${careerStage}
- Anos de atividade acadêmica: ${yearsActive}`;
  }

  return analysis;
}
