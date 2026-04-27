'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { saveAs } from 'file-saver'
import type { ReportPdfProps } from './report-pdf'

export function ExportPdfButton(props: ReportPdfProps) {
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const onClick = async () => {
    setBusy(true)
    try {
      const [{ pdf }, { ReportPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./report-pdf'),
      ])
      const blob = await pdf(<ReportPdf {...props} />).toBlob()
      const filename = `consulta-360_${props.consulta.cuit}_${new Date(props.consulta.consultadoEn)
        .toISOString()
        .slice(0, 10)}.pdf`
      saveAs(blob, filename)
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo generar el PDF',
        description: e instanceof Error ? e.message : 'Error desconocido',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={busy} className="gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {busy ? 'Generando…' : 'Exportar PDF'}
    </Button>
  )
}
