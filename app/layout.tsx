import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Interface Centralizada para Pesquisadores",
  description: "Plataforma moderna para busca e visualização de perfis de pesquisadores usando dados ORCID",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body 
        className={inter.className}
        suppressHydrationWarning={true}
      >
        {children}
      </body>
    </html>
  )
}
