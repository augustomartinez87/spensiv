'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface PrivacyContextType {
  isPrivate: boolean
  togglePrivacy: () => void
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivate: false,
  togglePrivacy: () => {},
})

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('spensiv-privacy-mode')
    if (stored === 'true') setIsPrivate(true)
  }, [])

  const togglePrivacy = () => {
    setIsPrivate((prev) => {
      const next = !prev
      localStorage.setItem('spensiv-privacy-mode', String(next))
      return next
    })
  }

  return (
    <PrivacyContext.Provider value={{ isPrivate, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  return useContext(PrivacyContext)
}

export function PrivateAmount({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { isPrivate } = usePrivacy()
  if (isPrivate) {
    return (
      <span className={`text-muted-foreground select-none blur-[2px] ${className || ''}`}>
        $•••••
      </span>
    )
  }
  return <>{children}</>
}
