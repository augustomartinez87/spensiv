export const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  'Educación': 'bg-purple-500/20 text-purple-400',
  'Educacion': 'bg-purple-500/20 text-purple-400',
  'Lujos': 'bg-pink-500/20 text-pink-400',
  'Gastos Fijos': 'bg-slate-500/20 text-slate-400',
  'Servicios': 'bg-blue-500/20 text-blue-400',
  'Transporte': 'bg-cyan-500/20 text-cyan-400',
  'Salud': 'bg-yellow-500/20 text-yellow-400',
  'Comida': 'bg-orange-500/20 text-orange-400',
  'Compras': 'bg-amber-500/20 text-amber-400',
  'Deudas': 'bg-red-500/20 text-red-400',
  'Inversiones': 'bg-teal-500/20 text-teal-400',
  'Ingresos Activos': 'bg-green-500/20 text-green-400',
  'Ingresos Pasivos': 'bg-emerald-500/20 text-emerald-400',
  'Ingresos': 'bg-green-500/20 text-green-400',
}

export function getCategoryBadgeClass(category: string): string {
  return CATEGORY_BADGE_CLASSES[category] || 'bg-zinc-500/20 text-zinc-400'
}

export const CATEGORY_DONUT_COLORS: Record<string, string> = {
  'Gastos Fijos': '#22c55e',
  'Servicios': '#2a89bf',
  'Transporte': '#348bb5',
  'Educacion': '#a855f7',
  'Educación': '#a855f7',
  'Salud': '#feb92e',
  'Comida': '#e8a820',
  'Compras': '#f0953a',
  'Deudas': '#f97316',
  'Lujos': '#f43f5e',
  'Inversiones': '#06b6d4',
  'Ingresos Activos': '#22c55e',
  'Ingresos Pasivos': '#10b981',
  'Otros Ingresos': '#3b82f6',
  'Ingresos': '#22c55e',
}

export const CATEGORY_FALLBACK_COLORS = [
  '#1f6c9c', '#feb92e', '#e54352', '#2a89bf', '#e8a820', '#f0953a', '#348bb5',
]
