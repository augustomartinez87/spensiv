'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { cn, formatDateToInput } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Phone, Banknote, Handshake, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const TAG_CONFIG: Record<string, { label: string; color: string; icon: typeof Phone }> = {
    llamada: { label: 'Llamada', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Phone },
    pago: { label: 'Pago', color: 'bg-green-500/15 text-green-400 border-green-500/30', icon: Banknote },
    acuerdo: { label: 'Acuerdo', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Handshake },
    otro: { label: 'Otro', color: 'bg-muted text-muted-foreground border-border', icon: MessageCircle },
}

import type { ActivityLog } from './types'

export function LoanActivityTimeline({ loanId, logs }: { loanId: string; logs: ActivityLog[] }) {
    const utils = trpc.useUtils()
    const [note, setNote] = useState('')
    const [tag, setTag] = useState<string>('otro')
    const [logDate, setLogDate] = useState(formatDateToInput(new Date()))

    const addMutation = trpc.loans.addActivityLog.useMutation({
        onSuccess: () => {
            utils.loans.getById.invalidate({ id: loanId })
            setNote('')
            setTag('otro')
            setLogDate(formatDateToInput(new Date()))
        },
    })

    const deleteMutation = trpc.loans.deleteActivityLog.useMutation({
        onSuccess: () => utils.loans.getById.invalidate({ id: loanId }),
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Actividad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add form */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={tag} onValueChange={setTag}>
                        <SelectTrigger className="w-full sm:w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(TAG_CONFIG).map(([key, cfg]) => (
                                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        value={logDate}
                        onChange={(e) => setLogDate(e.target.value)}
                        className="w-full sm:w-36"
                    />
                    <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Agregar nota..."
                        className="flex-1 min-h-[38px] h-[38px] resize-none"
                    />
                    <Button
                        size="sm"
                        disabled={!note.trim() || addMutation.isPending}
                        onClick={() => addMutation.mutate({ loanId, note: note.trim(), tag: tag as 'llamada' | 'pago' | 'acuerdo' | 'otro', logDate })}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                    </Button>
                </div>

                {/* Timeline */}
                {logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 italic">Sin actividad registrada</p>
                ) : (
                    <div className="relative pl-6 space-y-3">
                        {/* Vertical line */}
                        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

                        {logs.map((log) => {
                            const cfg = TAG_CONFIG[log.tag] || TAG_CONFIG.otro
                            const TagIcon = cfg.icon
                            return (
                                <div key={log.id} className="relative group">
                                    {/* Dot */}
                                    <div className="absolute -left-6 top-1.5 h-[18px] w-[18px] rounded-full bg-background border-2 border-border flex items-center justify-center">
                                        <TagIcon className="h-2.5 w-2.5 text-muted-foreground" />
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", cfg.color)}>
                                                    {cfg.label}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {format(new Date(log.logDate), "d MMM yyyy", { locale: es })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-foreground mt-0.5">{log.note}</p>
                                        </div>
                                        <button
                                            onClick={() => deleteMutation.mutate({ logId: log.id })}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
