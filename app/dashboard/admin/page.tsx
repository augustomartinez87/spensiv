'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ShieldCheck, ShieldOff, Users } from 'lucide-react'
import { trpc } from '@/lib/trpc-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

type UserRow = {
  id: string
  email: string
  fullName: string
  imageUrl: string
  role: string
  createdAt: Date
}

export default function AdminUsersPage() {
  const { user: currentUser } = useUser()
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data: users, isLoading, refetch } = trpc.admin.listUsers.useQuery()

  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: (_, variables) => {
      toast({
        title: 'Rol actualizado',
        description: `El usuario ahora tiene rol "${variables.role}".`,
      })
      refetch()
      setPendingId(null)
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el rol.',
        variant: 'destructive',
      })
      setPendingId(null)
    },
  })

  function handleToggleRole(user: UserRow) {
    const newRole = user.role === 'admin' ? 'viewer' : 'admin'
    setPendingId(user.id)
    updateRole.mutate({ targetUserId: user.id, role: newRole })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administrá los roles de acceso de cada usuario.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users?.length ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Total usuarios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users?.filter(u => u.role === 'admin').length ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">Administradores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <ShieldOff className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users?.filter(u => u.role !== 'admin').length ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">Usuarios normales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users?.map(user => {
                const isCurrentUser = user.id === currentUser?.id
                const isUpdating = pendingId === user.id

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-3 gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={user.imageUrl}
                        alt={user.fullName}
                        className="h-9 w-9 rounded-full shrink-0 bg-muted"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{user.fullName}</p>
                          {isCurrentUser && (
                            <span className="text-[10px] text-muted-foreground">(vos)</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        variant={user.role === 'admin' ? 'default' : 'secondary'}
                        className="text-[11px]"
                      >
                        {user.role === 'admin' ? 'Admin' : 'Viewer'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        disabled={isCurrentUser || isUpdating}
                        onClick={() => handleToggleRole(user)}
                      >
                        {isUpdating
                          ? 'Guardando...'
                          : user.role === 'admin'
                          ? 'Quitar admin'
                          : 'Dar admin'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
