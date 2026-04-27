import { cn } from '@/lib/utils'

type SituacionStyle = { label: string; bg: string; text: string; ring: string; dot: string }

const SITUACION_CONFIG: Record<number, SituacionStyle> = {
  1: { label: 'Normal', bg: 'bg-green-500/15', text: 'text-green-300', ring: 'ring-green-500/30', dot: 'bg-green-300' },
  2: { label: 'Riesgo bajo', bg: 'bg-yellow-500/15', text: 'text-yellow-300', ring: 'ring-yellow-500/30', dot: 'bg-yellow-300' },
  3: { label: 'Con problemas', bg: 'bg-orange-500/15', text: 'text-orange-300', ring: 'ring-orange-500/30', dot: 'bg-orange-300' },
  4: { label: 'Alto riesgo', bg: 'bg-red-500/15', text: 'text-red-300', ring: 'ring-red-500/30', dot: 'bg-red-300' },
  5: { label: 'Irrecuperable', bg: 'bg-zinc-700/40', text: 'text-zinc-300', ring: 'ring-zinc-500/40', dot: 'bg-zinc-300' },
  6: { label: 'Irrec. téc.', bg: 'bg-zinc-700/40', text: 'text-zinc-300', ring: 'ring-zinc-500/40', dot: 'bg-zinc-300' },
}

export function SituacionBadge({ situacion, size = 'sm' }: { situacion: number; size?: 'sm' | 'md' }) {
  const cfg = SITUACION_CONFIG[situacion] ?? SITUACION_CONFIG[1]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium ring-1 ring-inset',
        cfg.bg,
        cfg.text,
        cfg.ring,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {situacion} · {cfg.label}
    </span>
  )
}

export function situacionColor(situacion: number | null): string {
  if (situacion === 1) return 'bg-green-500'
  if (situacion === 2) return 'bg-yellow-500'
  if (situacion === 3) return 'bg-orange-500'
  if (situacion === 4) return 'bg-red-500'
  if (situacion === 5 || situacion === 6) return 'bg-zinc-500'
  return 'bg-zinc-800'
}
