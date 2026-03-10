'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type CurrencyMode = 'ARS' | 'USD'

interface CurrencyContextType {
  mode: CurrencyMode
  setMode: (mode: CurrencyMode) => void
  mepRate: number | null
  setMepRate: (rate: number) => void
  convert: (arsAmount: number) => number
  symbol: string
}

const CurrencyContext = createContext<CurrencyContextType>({
  mode: 'ARS',
  setMode: () => {},
  mepRate: null,
  setMepRate: () => {},
  convert: (v) => v,
  symbol: '$',
})

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<CurrencyMode>('ARS')
  const [mepRate, setMepRate] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('spensiv-currency-mode') as CurrencyMode | null
    if (stored === 'USD' || stored === 'ARS') setModeState(stored)
  }, [])

  const setMode = (m: CurrencyMode) => {
    setModeState(m)
    localStorage.setItem('spensiv-currency-mode', m)
  }

  const convert = (arsAmount: number): number => {
    if (mode === 'USD' && mepRate && mepRate > 0) {
      return arsAmount / mepRate
    }
    return arsAmount
  }

  const symbol = mode === 'USD' ? 'US$' : '$'

  return (
    <CurrencyContext.Provider value={{ mode, setMode, mepRate, setMepRate, convert, symbol }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
