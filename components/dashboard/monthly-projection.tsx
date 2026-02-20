'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, cn } from '@/lib/utils'
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface MonthlyProjectionProps {
  balance: number
  totalIncome: number
  totalExpense: number
  cardBalances?: {
    cards: Array<{
      currentPeriodBalance: number
    }>
    totalDebt: number
  } | null
}

export function MonthlyProjection({ 
  balance, 
  totalIncome, 
  totalExpense,
  cardBalances 
}: MonthlyProjectionProps) {
  // Calcular el porcentaje de gastos vs ingresos
  const expensePercentage = totalIncome > 0 
    ? (totalExpense / totalIncome) * 100 
    : 0

  // Calcular potencial de ahorro (ingresos - gastos estimados al cierre)
  // Estimamos que los gastos pueden aumentar un 10% por gastos imprevistos
  const estimatedTotalExpense = totalExpense * 1.1
  const savingsPotential = totalIncome - estimatedTotalExpense

  // Determinar el mensaje basado en el superávit
  const getStatusMessage = () => {
    if (balance < 0) {
      return {
        message: 'Estás en déficit',
        submessage: 'Tus gastos superan tus ingresos',
        icon: AlertTriangle,
        color: 'text-red-200',
        bgColor: 'from-red-950 to-red-800/50',
        borderColor: 'border-red-700/30',
        progressColor: 'bg-red-500',
      }
    }
    
    if (expensePercentage > 80) {
      return {
        message: 'Cuidado con los gastos',
        submessage: 'Has usado más del 80% de tus ingresos',
        icon: AlertTriangle,
        color: 'text-yellow-200',
        bgColor: 'from-yellow-950 to-yellow-800/50',
        borderColor: 'border-yellow-700/30',
        progressColor: 'bg-yellow-500',
      }
    }
    
    return {
      message: 'Vas por buen camino',
      submessage: savingsPotential > 0 
        ? `Podrías ahorrar ${formatCurrency(savingsPotential)}`
        : 'Mantén el control de tus gastos',
      icon: CheckCircle2,
      color: 'text-emerald-200',
      bgColor: 'from-emerald-950 to-emerald-800/50',
      borderColor: 'border-emerald-700/30',
      progressColor: 'bg-emerald-500',
    }
  }

  const status = getStatusMessage()
  const Icon = status.icon

  return (
    <Card className={cn(
      "overflow-hidden bg-gradient-to-br border",
      status.bgColor,
      status.borderColor
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className={cn("text-xs font-medium uppercase tracking-wider", status.color)}>
              Proyección Mensual
            </p>
            <p className="text-[10px] text-white/60 mt-0.5">
              Estimado al cierre del mes
            </p>
          </div>
          <Icon className={cn("h-5 w-5", status.color)} />
        </div>

        <p className="text-3xl font-bold text-white mt-3 tracking-tight">
          {formatCurrency(balance)}
        </p>

        {/* Barra de progreso */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-white/70 mb-1">
            <span>Gastos</span>
            <span>{expensePercentage.toFixed(0)}% de ingresos</span>
          </div>
          <Progress 
            value={Math.min(expensePercentage, 100)} 
            className="h-1.5 bg-white/20"
          />
        </div>

        <div className="mt-4 space-y-1">
          <p className={cn("text-sm font-medium", status.color)}>
            {status.message}
          </p>
          <p className="text-xs text-white/70">
            {status.submessage}
          </p>
        </div>

        {/* Resumen rápido */}
        <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-white/60">Ingresos</p>
            <p className="text-sm font-semibold text-emerald-300">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/60">Gastos</p>
            <p className="text-sm font-semibold text-red-300">
              {formatCurrency(totalExpense)}
            </p>
          </div>
        </div>

        {/* Info de tarjetas este mes */}
        {cardBalances && cardBalances.cards.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-[10px] text-white/60">En tarjetas este mes</p>
            <p className="text-sm font-semibold text-white">
              {formatCurrency(
                cardBalances.cards.reduce((sum, card) => sum + card.currentPeriodBalance, 0)
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
