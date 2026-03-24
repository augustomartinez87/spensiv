'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Algo salió mal</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Ocurrió un error inesperado. Podés intentar de nuevo o volver al dashboard.
        </p>
      </div>
      <Button onClick={reset}>
        Intentar de nuevo
      </Button>
    </div>
  )
}
