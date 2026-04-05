'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CollectorSelectorProps {
    value: string
    onChange: (id: string) => void
}

export function CollectorSelector({ value, onChange }: CollectorSelectorProps) {
    const { data: persons } = trpc.persons.list.useQuery()

    if (!persons || persons.length === 0) return null

    return (
        <div className="space-y-2">
            <Label>Cobrador (opcional)</Label>
            <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                    <SelectValue placeholder="Sin cobrador" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="__none__">Sin cobrador</SelectItem>
                    {persons.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.alias ? `(${p.alias})` : ''}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
