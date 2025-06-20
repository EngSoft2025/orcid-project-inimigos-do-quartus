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

    // Prepare context about the researcher
    const researcherContext = `
Informações sobre o pesquisador ${researcherData.name}:
- País: ${researcherData.country}
- Total de citações: ${researcherData.totalCitations}
- Índice H: ${researcherData.hIndex}
- Número de publicações: ${researcherData.publications.length}
- Áreas de expertise: ${researcherData.keywords.join(", ")}
- ORCID ID: ${researcherData.orcidId}

Publicações principais:
${researcherData.publications
  .slice(0, 10)
  .map((pub: any) => `- ${pub.title} (${pub.year}) - ${pub.citations} citações`)
  .join("\n")}

${researcherData.biography ? `Biografia: ${researcherData.biography}` : ""}
`;

    // Prepare messages for OpenAI API
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `Você é um assistente especializado em pesquisa acadêmica. Sua função é responder perguntas sobre pesquisadores com base nas informações do perfil ORCID fornecidas. 

Contexto do pesquisador:
${researcherContext}

Instruções:
- Responda em português brasileiro
- Seja preciso e baseie suas respostas nas informações fornecidas
- Se não souber algo específico, seja honesto sobre as limitações
- Mantenha um tom profissional e acadêmico
- Forneça respostas detalhadas mas concisas
- Se perguntado sobre áreas não cobertas pelos dados, sugira consultar o perfil ORCID completo`,
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
      model: "gpt-4o-mini", // Using gpt-4o-mini as gpt-4.1-nano doesn't exist
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
