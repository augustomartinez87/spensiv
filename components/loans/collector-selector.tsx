'use client'

import { useState } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

interface CollectorSelectorProps {
    value: string
    onChange: (id: string) => void
}

export function CollectorSelector({ value, onChange }: CollectorSelectorProps) {
    const utils = trpc.useUtils()
    const { data: collectors } = trpc.collectors.list.useQuery()
    const [createOpen, setCreateOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newPhone, setNewPhone] = useState('')

    const createMutation = trpc.collectors.create.useMutation({
        onSuccess: (created) => {
            utils.collectors.list.invalidate()
            onChange(created.id)
            setCreateOpen(false)
            setNewName('')
            setNewPhone('')
        },
    })

    if (!collectors || collectors.length === 0) {
        return (
            <div className="space-y-2">
                <Label>Cobrador (opcional)</Label>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" type="button" className="w-full justify-start text-muted-foreground">
                            <Plus className="h-4 w-4 mr-2" />
                            Crear cobrador
                        </Button>
                    </DialogTrigger>
                    <CreateCollectorContent
                        newName={newName}
                        setNewName={setNewName}
                        newPhone={newPhone}
                        setNewPhone={setNewPhone}
                        onSubmit={() => createMutation.mutate({ name: newName, phone: newPhone || undefined })}
                        isPending={createMutation.isPending}
                    />
                </Dialog>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <Label>Cobrador (opcional)</Label>
            <div className="flex gap-2">
                <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sin cobrador" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">Sin cobrador</SelectItem>
                        {collectors.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                                {c.name} {c.activeLoanCount > 0 ? `(${c.activeLoanCount})` : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" type="button" className="shrink-0">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <CreateCollectorContent
                        newName={newName}
                        setNewName={setNewName}
                        newPhone={newPhone}
                        setNewPhone={setNewPhone}
                        onSubmit={() => createMutation.mutate({ name: newName, phone: newPhone || undefined })}
                        isPending={createMutation.isPending}
                    />
                </Dialog>
            </div>
        </div>
    )
}

function CreateCollectorContent({
    newName,
    setNewName,
    newPhone,
    setNewPhone,
    onSubmit,
    isPending,
}: {
    newName: string
    setNewName: (v: string) => void
    newPhone: string
    setNewPhone: (v: string) => void
    onSubmit: () => void
    isPending: boolean
}) {
    return (
        <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
                <DialogTitle>Nuevo Cobrador</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
                <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Ej: Tello"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Teléfono (opcional)</Label>
                    <Input
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Ej: 1126369767"
                    />
                </div>
                <Button
                    className="w-full"
                    disabled={!newName.trim() || isPending}
                    onClick={onSubmit}
                >
                    Crear cobrador
                </Button>
            </div>
        </DialogContent>
    )
}
