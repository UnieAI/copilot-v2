import type React from "react"
import type { Metadata } from "next"
import "../styles/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from 'sonner';
import { NextIntlClientProvider } from "next-intl"

export const metadata: Metadata = {
  title: "UnieAI Agent",
  description: "Powered by UnieAI",
  generator: 'UnieAI'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased h-screen w-screen overflow-hidden" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster position="top-center" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
