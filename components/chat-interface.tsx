"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Send, MessageCircle, Bot, User } from "lucide-react"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  researcherName: string
  researcherData: any
}

export function ChatInterface({ researcherName, researcherData }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const suggestedQuestions = [
    `Quais são as principais áreas de pesquisa de ${researcherName}?`,
    `Qual é o trabalho mais citado de ${researcherName}?`,
    `Resuma as contribuições científicas de ${researcherName}`,
    `Em que projetos ${researcherName} está trabalhando atualmente?`,
    `Qual é o impacto acadêmico de ${researcherName}?`,
  ]

  // Auto-scroll to bottom when new messages are added (only for desktop)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (message: string) => {
    if (!message.trim()) return

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          researcherData,
          conversationHistory: messages,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <Card className="lg:h-[600px] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          Chat sobre {researcherName}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 lg:min-h-0">
        {/* Messages Container - Dynamic height on mobile, fixed with scroll on desktop */}
        <div className="flex-1 lg:overflow-y-auto p-4 space-y-4 lg:min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              <Bot className="h-8 w-8 mx-auto mb-3 text-gray-400" />
              <p className="mb-3 text-sm">Faça uma pergunta sobre {researcherName}</p>
              <div className="space-y-2">
                {suggestedQuestions.slice(0, 3).map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="block w-full text-left text-xs p-2 h-auto whitespace-normal leading-relaxed"
                    onClick={() => sendMessage(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={index} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-2 max-w-[85%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className="flex-shrink-0 mt-1">
                    {message.role === "user" ? (
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div
                    className={`p-3 rounded-lg text-sm leading-relaxed ${
                      message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center mt-1">
                <Bot className="h-3 w-3 text-white" />
              </div>
              <div className="bg-gray-100 p-3 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          {/* Invisible div to scroll to (only for desktop) */}
          <div ref={messagesEndRef} className="hidden lg:block" />
        </div>
        {/* Input Container - Fixed at bottom */}
        <div className="border-t p-3 flex-shrink-0 bg-white">
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua pergunta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} size="sm">
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
