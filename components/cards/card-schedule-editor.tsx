'use client'

import { useState, useEffect } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/hooks/use-toast'
import { Loader2, Calendar, Copy, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CardScheduleEditorProps {
  cardId: string
}

interface MonthSchedule {
  month: number
  closingDay: number
  dueDay: number
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export function CardScheduleEditor({ cardId }: CardScheduleEditorProps) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [schedules, setSchedules] = useState<MonthSchedule[]>([])
  const [useDefaults, setUseDefaults] = useState<boolean[]>(new Array(12).fill(true))
  const [detectWeekends, setDetectWeekends] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const utils = trpc.useUtils()
  
  const { data: scheduleData, isLoading } = trpc.cards.getClosingSchedule.useQuery({
    cardId,
    year,
  })

  const saveMutation = trpc.cards.saveClosingSchedule.useMutation({
    onSuccess: () => {
      toast({
        title: 'Calendario guardado',
        description: 'Los cambios se guardaron exitosamente',
      })
      setHasChanges(false)
      utils.cards.getClosingSchedule.invalidate({ cardId, year })
    },
    onError: (error) => {
      toast({
        title: 'Error al guardar',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Inicializar schedules cuando llegan los datos
  useEffect(() => {
    if (scheduleData) {
      const initialSchedules: MonthSchedule[] = []
      const initialUseDefaults: boolean[] = []

      for (let month = 1; month <= 12; month++) {
        const existingSchedule = scheduleData.schedules.find((s: { month: number }) => s.month === month)
        
        if (existingSchedule) {
          initialSchedules.push({
            month,
            closingDay: existingSchedule.closingDay,
            dueDay: existingSchedule.dueDay,
          })
          initialUseDefaults.push(false)
        } else {
          initialSchedules.push({
            month,
            closingDay: scheduleData.defaultClosingDay,
            dueDay: scheduleData.defaultDueDay,
          })
          initialUseDefaults.push(true)
        }
      }

      setSchedules(initialSchedules)
      setUseDefaults(initialUseDefaults)
    }
  }, [scheduleData])

  const handleScheduleChange = (monthIndex: number, field: 'closingDay' | 'dueDay', value: number) => {
    const newSchedules = [...schedules]
    newSchedules[monthIndex] = {
      ...newSchedules[monthIndex],
      [field]: Math.min(31, Math.max(1, value)),
    }
    setSchedules(newSchedules)
    setHasChanges(true)

    // Si cambia manualmente, desmarcar "usar defaults"
    if (useDefaults[monthIndex]) {
      const newUseDefaults = [...useDefaults]
      newUseDefaults[monthIndex] = false
      setUseDefaults(newUseDefaults)
    }
  }

  const handleUseDefaultChange = (monthIndex: number, checked: boolean) => {
    const newUseDefaults = [...useDefaults]
    newUseDefaults[monthIndex] = checked
    setUseDefaults(newUseDefaults)
    setHasChanges(true)

    if (checked && scheduleData) {
      // Restaurar valores por defecto
      const newSchedules = [...schedules]
      newSchedules[monthIndex] = {
        ...newSchedules[monthIndex],
        closingDay: scheduleData.defaultClosingDay,
        dueDay: scheduleData.defaultDueDay,
      }
      setSchedules(newSchedules)
    }
  }

  const copyToAllMonths = (sourceMonthIndex: number) => {
    const sourceSchedule = schedules[sourceMonthIndex]
    const newSchedules = schedules.map((s, i) => 
      i === sourceMonthIndex ? s : { ...s, closingDay: sourceSchedule.closingDay, dueDay: sourceSchedule.dueDay }
    )
    const newUseDefaults = useDefaults.map((u, i) => i === sourceMonthIndex ? u : false)
    
    setSchedules(newSchedules)
    setUseDefaults(newUseDefaults)
    setHasChanges(true)

    toast({
      title: 'Valores copiados',
      description: `Los valores de ${MONTH_NAMES[sourceMonthIndex]} se copiaron a todos los meses`,
    })
  }

  const handleSave = () => {
    // Preparar datos para guardar (solo los que no usan defaults)
    const schedulesToSave: MonthSchedule[] = []
    
    schedules.forEach((schedule, index) => {
      if (!useDefaults[index]) {
        schedulesToSave.push(schedule)
      }
    })

    saveMutation.mutate({
      cardId,
      year,
      schedules: schedulesToSave,
    })
  }

  // Detectar si una fecha cae en fin de semana
  const isWeekend = (year: number, month: number, day: number): boolean => {
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6 // 0 = Domingo, 6 = Sábado
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con selector de año */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-primary" />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setYear(y => y - 1)}
            >
              ←
            </Button>
            <span className="text-lg font-semibold min-w-[80px] text-center">
              {year}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setYear(y => y + 1)}
            >
              →
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="detectWeekends"
              checked={detectWeekends}
                    onCheckedChange={(checked: boolean | 'indeterminate') => setDetectWeekends(checked === true)}
            />
            <Label htmlFor="detectWeekends" className="text-sm cursor-pointer">
              Mostrar fines de semana
            </Label>
          </div>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Guardar
          </Button>
        </div>
      </div>

      {/* Info de defaults */}
      {scheduleData && (
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
          Valores por defecto de la tarjeta: Cierre día {scheduleData.defaultClosingDay}, 
          Vencimiento día {scheduleData.defaultDueDay}
        </div>
      )}

      {/* Grilla de meses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {schedules.map((schedule, index) => {
          const isDefault = useDefaults[index]
          const closingIsWeekend = detectWeekends && isWeekend(year, schedule.month, schedule.closingDay)
          const dueIsWeekend = detectWeekends && isWeekend(year, schedule.month, schedule.dueDay)

          return (
            <div
              key={schedule.month}
              className={cn(
                "border rounded-lg p-4 space-y-3 transition-all",
                isDefault ? "bg-muted/50 border-muted" : "bg-card border-border",
                hasChanges && !isDefault && "ring-1 ring-primary/20"
              )}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{MONTH_NAMES[index]}</h4>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`default-${index}`}
                    checked={isDefault}
                    onCheckedChange={(checked: boolean | 'indeterminate') => handleUseDefaultChange(index, checked === true)}
                  />
                  <Label 
                    htmlFor={`default-${index}`} 
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    Usar default
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cierre</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={schedule.closingDay}
                      onChange={(e) => handleScheduleChange(index, 'closingDay', parseInt(e.target.value) || 1)}
                      disabled={isDefault}
                      className={cn(
                        "h-9",
                        closingIsWeekend && "border-yellow-500/50 bg-yellow-500/10"
                      )}
                    />
                    {closingIsWeekend && (
                      <AlertTriangle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                  {closingIsWeekend && (
                    <p className="text-[10px] text-yellow-600">Es fin de semana</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vencimiento</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={schedule.dueDay}
                      onChange={(e) => handleScheduleChange(index, 'dueDay', parseInt(e.target.value) || 1)}
                      disabled={isDefault}
                      className={cn(
                        "h-9",
                        dueIsWeekend && "border-yellow-500/50 bg-yellow-500/10"
                      )}
                    />
                    {dueIsWeekend && (
                      <AlertTriangle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                  {dueIsWeekend && (
                    <p className="text-[10px] text-yellow-600">Es fin de semana</p>
                  )}
                </div>
              </div>

              {!isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => copyToAllMonths(index)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar a todos
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
