'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { cn } from '@/lib/utils'

const CONFIG = {
  ok: {
    dot: 'bg-green-400',
    ring: 'bg-green-400/40',
    text: 'text-green-300',
    label: 'BCRA online',
    pulse: true,
  },
  mantenimiento: {
    dot: 'bg-amber-400',
    ring: 'bg-amber-400/40',
    text: 'text-amber-300',
    label: 'BCRA en mantenimiento',
    pulse: false,
  },
  error: {
    dot: 'bg-red-400',
    ring: 'bg-red-400/40',
    text: 'text-red-300',
    label: 'BCRA no responde',
    pulse: false,
  },
  loading: {
    dot: 'bg-zinc-400',
    ring: 'bg-zinc-400/40',
    text: 'text-zinc-400',
    label: 'Verificando…',
    pulse: false,
  },
} as const

export function BcraStatus({ compact = false }: { compact?: boolean }) {
  // Refetch cada 60s, mantener fresh por 30s, no refetchear en focus para no martillar.
  const { data, isLoading } = trpc.consulta360.health.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const status = isLoading ? 'loading' : (data?.status ?? 'error')
  const cfg = CONFIG[status]

  const tooltipText = (() => {
    if (isLoading || !data) return cfg.label
    const lat = data.latencyMs != null ? ` (${data.latencyMs}ms)` : ''
    const ts = new Date(data.checkedAt).toLocaleTimeString('es-AR')
    return `${cfg.label}${lat} · chequeado a las ${ts}`
  })()

  if (compact) {
    return (
      <span
        className="relative inline-flex h-2 w-2 shrink-0"
        title={tooltipText}
        aria-label={tooltipText}
      >
        {cfg.pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              cfg.ring
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', cfg.dot)} />
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 text-[11px]"
      title={tooltipText}
      aria-label={tooltipText}
    >
      <span className="relative inline-flex h-2 w-2 shrink-0">
        {cfg.pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              cfg.ring
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', cfg.dot)} />
      </span>
      <span className={cn('font-medium', cfg.text)}>{cfg.label}</span>
    </span>
  )
}
