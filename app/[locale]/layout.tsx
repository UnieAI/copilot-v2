import type React from "react"
import type { Metadata } from "next"
import "../../styles/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from 'sonner';
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { notFound } from "next/navigation"
import { routing } from "@/i18n/routing"
import { Providers } from "@/components/providers"
export const metadata: Metadata = {
    title: "UnieAI Copilot V2",
    description: "Next Generation AI Chat Interface",
}

export default async function RootLayout({
    children,
    params
}: Readonly<{
    children: React.ReactNode
    params: Promise<{ locale: string }>
}>) {
    const locale = (await params).locale;

    // Validate that the incoming `locale` parameter is valid
    if (!routing.locales.includes(locale as any)) {
        notFound();
    }

    // Providing all messages to the client
    // side is the easiest way to get started
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
            <body className="antialiased h-screen w-screen overflow-hidden">
                <NextIntlClientProvider messages={messages}>
                    <Providers>
                        <ThemeProvider
                            attribute="class"
                            defaultTheme="system"
                            enableSystem
                            disableTransitionOnChange
                        >
                            <Toaster position="top-center" />
                            {children}
                        </ThemeProvider>
                    </Providers>
                </NextIntlClientProvider>
            </body>
        </html>
    )
}
