import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { TRPCProvider } from '@/lib/contexts/trpc-client'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Spensiv - Tu motor de cashflow personal',
  description: 'Control inteligente de tarjetas de crédito y proyección de deuda',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="es" className="dark" suppressHydrationWarning>
        <body className={inter.className}>
          <TRPCProvider>
            {children}
            <Toaster />
          </TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
