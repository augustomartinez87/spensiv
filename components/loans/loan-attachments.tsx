'use client'

import { useState, useRef } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Upload,
  Trash2,
  FileText,
  Loader2,
  ExternalLink,
} from 'lucide-react'

const ATTACHMENT_TYPES = [
  { value: 'transfer_receipt' as const, label: 'Transferencia', icon: '💸' },
  { value: 'pagare' as const, label: 'Pagaré', icon: '📝' },
  { value: 'mutual' as const, label: 'Mutual', icon: '📄' },
  { value: 'other' as const, label: 'Otro', icon: '📎' },
]

type AttachmentType = 'transfer_receipt' | 'pagare' | 'mutual' | 'other'

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export function LoanAttachments({ loanId }: { loanId: string }) {
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState<AttachmentType | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: attachments = [], isLoading } =
    trpc.loans.listAttachments.useQuery({ loanId })

  const createAttachment = trpc.loans.createAttachment.useMutation({
    onSuccess: () => {
      utils.loans.listAttachments.invalidate({ loanId })
      toast({ title: 'Archivo subido correctamente' })
    },
    onError: (err) => {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' })
    },
  })

  const deleteAttachment = trpc.loans.deleteAttachment.useMutation({
    onSuccess: () => {
      utils.loans.listAttachments.invalidate({ loanId })
      setDeletingId(null)
      toast({ title: 'Archivo eliminado' })
    },
    onError: (err) => {
      setDeletingId(null)
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' })
    },
  })

  const handleUploadClick = (type: AttachmentType) => {
    if (uploading) return
    setUploadType(type)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadType || uploading) return

    // Reset input so same file can be re-selected
    e.target.value = ''

    setUploading(true)
    let blobUrl: string | null = null
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pathname', `loan-attachments/${loanId}/${uploadType}/${file.name}`)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al subir archivo')
      }
      const { url } = await res.json()
      blobUrl = url

      await createAttachment.mutateAsync({
        loanId,
        type: uploadType,
        fileName: file.name,
        fileUrl: url,
        fileSize: file.size,
        mimeType: file.type,
      })
    } catch (err) {
      // Clean up orphaned blob if upload succeeded but metadata save failed
      if (blobUrl) {
        fetch('/api/upload', { method: 'DELETE', body: JSON.stringify({ url: blobUrl }) }).catch(() => {})
      }
      toast({
        title: 'Error al subir archivo',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      setUploadType(null)
    }
  }

  const handleDelete = (attachmentId: string) => {
    setDeletingId(attachmentId)
    deleteAttachment.mutate({ attachmentId })
  }

  const isImage = (mimeType?: string | null) =>
    mimeType?.startsWith('image/')

  const typeConfig = (type: string) =>
    ATTACHMENT_TYPES.find((t) => t.value === type) || ATTACHMENT_TYPES[3]

  // Group attachments by type
  const grouped = ATTACHMENT_TYPES.map((t) => ({
    ...t,
    files: attachments.filter((a) => a.type === t.value),
  }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Cargando documentos...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />

      {grouped.map((group) => (
        <div key={group.value} className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span>{group.icon}</span>
              {group.label}
              {group.files.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {group.files.length}
                </Badge>
              )}
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUploadClick(group.value)}
              disabled={uploading}
            >
              {uploading && uploadType === group.value ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-1.5" />
              )}
              Subir
            </Button>
          </div>

          {group.files.length === 0 ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/25 p-4 text-center text-xs text-muted-foreground">
              Sin archivos
            </div>
          ) : (
            <div className="grid gap-2">
              {group.files.map((file) => (
                <Card key={file.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Thumbnail or icon */}
                      {isImage(file.mimeType) ? (
                        <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <img
                            src={file.fileUrl}
                            alt={file.fileName}
                            className="h-12 w-12 rounded object-cover border"
                          />
                        </a>
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(file.createdAt), "d MMM yyyy", { locale: es })}
                          {file.fileSize && (
                            <span> · {(file.fileSize / 1024).toFixed(0)} KB</span>
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(file.id)}
                          disabled={deletingId === file.id}
                        >
                          {deletingId === file.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
