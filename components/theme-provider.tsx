"use client"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from 'next-themes/dist/types';
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "next-auth/react";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <SessionProvider>
        <Toaster richColors />
        {children}
      </SessionProvider>
    </NextThemesProvider>
  )
}
