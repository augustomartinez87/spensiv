import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from 'next-themes'
import { TRPCProvider } from '@/lib/contexts/trpc-client'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://spensiv.vercel.app'),
  title: 'Spensiv - Tu motor de cashflow personal',
  description: 'Control inteligente de tarjetas de crédito, seguimiento de gastos e ingresos, y proyección de deuda.',
  openGraph: {
    title: 'Spensiv - Tu motor de cashflow personal',
    description: 'Control inteligente de tarjetas de crédito y proyección de deuda.',
    siteName: 'Spensiv',
    locale: 'es_AR',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="es" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <TRPCProvider>
              {children}
              <Toaster />
            </TRPCProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
