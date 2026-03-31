import {
  Home,
  Sparkles,
  GraduationCap,
  CreditCard,
  TrendingUp,
  HelpCircle,
  Car,
  Heart,
  PawPrint,
  Wifi,
  Building,
  Shield,
  Dumbbell,
  Scissors,
  DollarSign,
  type LucideIcon,
} from 'lucide-react'

interface CategoryIconInfo {
  icon: LucideIcon
  color: string
}

const SUBCATEGORY_ICONS: Record<string, CategoryIconInfo> = {
  Transporte: { icon: Car, color: '#22c55e' },
  Salud: { icon: Heart, color: '#22c55e' },
  Mascotas: { icon: PawPrint, color: '#22c55e' },
  Servicios: { icon: Wifi, color: '#22c55e' },
  Alquiler: { icon: Building, color: '#22c55e' },
  Seguros: { icon: Shield, color: '#22c55e' },
  'Deporte y Bienestar': { icon: Dumbbell, color: '#22c55e' },
  'Belleza y Cuidado Personal': { icon: Scissors, color: '#22c55e' },
}

const CATEGORY_ICONS: Record<string, CategoryIconInfo> = {
  'Gastos Fijos': { icon: Home, color: '#22c55e' },
  Lujos: { icon: Sparkles, color: '#f43f5e' },
  Educacion: { icon: GraduationCap, color: '#a855f7' },
  'Educación': { icon: GraduationCap, color: '#a855f7' },
  Deudas: { icon: CreditCard, color: '#f97316' },
  Inversiones: { icon: TrendingUp, color: '#06b6d4' },
  'Pendiente de clasificar': { icon: HelpCircle, color: '#6b7280' },
  'Sin categoría': { icon: HelpCircle, color: '#6b7280' },
  // Income categories
  'Ingresos Activos': { icon: DollarSign, color: '#22c55e' },
  'Ingresos Pasivos': { icon: DollarSign, color: '#22c55e' },
  'Otros Ingresos': { icon: DollarSign, color: '#22c55e' },
  Ingresos: { icon: DollarSign, color: '#22c55e' },
}

export function getCategoryIconInfo(
  categoryName: string,
  subcategoryName?: string | null
): CategoryIconInfo {
  if (subcategoryName && SUBCATEGORY_ICONS[subcategoryName]) {
    return SUBCATEGORY_ICONS[subcategoryName]
  }
  return CATEGORY_ICONS[categoryName] || { icon: HelpCircle, color: '#6b7280' }
}
