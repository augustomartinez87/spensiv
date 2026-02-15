'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon, Edit2, Check, X, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc-client'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

interface BillingCycleEditorProps {
    cardId: string
}

export function BillingCycleEditor({ cardId }: BillingCycleEditorProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editData, setEditData] = useState<{ closeDate: Date; dueDate: Date } | null>(null)

    const utils = trpc.useUtils()
    const { data: cycles, isLoading } = trpc.cards.listBillingCycles.useQuery(cardId)

    const updateMutation = trpc.cards.updateBillingCycle.useMutation({
        onSuccess: () => {
            utils.cards.listBillingCycles.invalidate(cardId)
            setEditingId(null)
            toast({ title: "Ciclo actualizado" })
        },
        onError: (err) => {
            toast({ title: "Error al actualizar", description: err.message, variant: "destructive" })
        }
    })

    if (isLoading) return <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground px-1">Ciclos de Facturación</h3>
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted border-b text-muted-foreground font-medium">
                        <tr>
                            <th className="px-4 py-3">Periodo</th>
                            <th className="px-4 py-3">Cierre</th>
                            <th className="px-4 py-3">Vencimiento</th>
                            <th className="px-4 py-3 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {cycles?.map((cycle) => {
                            const isEditing = editingId === cycle.id

                            return (
                                <tr key={cycle.id} className="hover:bg-accent transition-colors">
                                    <td className="px-4 py-3 font-medium text-foreground">{cycle.period}</td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <DatePicker
                                                date={editData?.closeDate || cycle.closeDate}
                                                setDate={(d) => setEditData(prev => ({ ...prev!, closeDate: d! }))}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">{format(cycle.closeDate, 'dd MMM', { locale: es })}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <DatePicker
                                                date={editData?.dueDate || cycle.dueDate}
                                                setDate={(d) => setEditData(prev => ({ ...prev!, dueDate: d! }))}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">{format(cycle.dueDate, 'dd MMM', { locale: es })}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-green-400"
                                                    onClick={() => updateMutation.mutate({ id: cycle.id, ...editData! })}
                                                    disabled={updateMutation.isPending}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-red-400"
                                                    onClick={() => setEditingId(null)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground"
                                                onClick={() => {
                                                    setEditingId(cycle.id)
                                                    setEditData({ closeDate: cycle.closeDate, dueDate: cycle.dueDate })
                                                }}
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function DatePicker({ date, setDate }: { date: Date; setDate: (d: Date | undefined) => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "h-8 px-2 text-xs font-normal justify-start text-left",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {date ? format(date, "P", { locale: es }) : <span>Pick</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
