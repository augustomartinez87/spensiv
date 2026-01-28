'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileUp, Download, CheckCircle2, AlertCircle, Loader2, Copy, FileSpreadsheet } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { trpc } from '@/lib/trpc-client'
import { parseExcelPaste, generateTemplateCSV } from '@/lib/importer'
import { Textarea } from '@/components/ui/textarea'

export default function ImportPage() {
    const [pasteData, setPasteData] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [step, setStep] = useState<'upload' | 'mapping' | 'success'>('upload')
    const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null)

    const utils = trpc.useUtils()
    const importMutation = trpc.import.bulkTransactions.useMutation({
        onSuccess: (data) => {
            setResults(data)
            setStep('success')
            utils.transactions.list.invalidate()
            utils.dashboard.getMonthlyBalance.invalidate()
            toast({
                title: "¡Importación finalizada!",
                description: `Se procesaron ${data.success} movimientos correctamente.`,
            })
        },
        onError: (error) => {
            toast({
                title: "Error en la importación",
                description: error.message,
                variant: "destructive",
            })
        }
    })

    const handleImport = async () => {
        if (!pasteData.trim()) return

        setIsUploading(true)
        try {
            const parsedData = parseExcelPaste(pasteData)
            if (parsedData.length === 0) {
                throw new Error("No se encontraron datos válidos para importar. Asegúrate de copiar las columnas correctas desde Excel.")
            }

            await importMutation.mutateAsync(parsedData as any)
        } catch (error: any) {
            toast({
                title: "Error de formato",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsUploading(false)
        }
    }

    const downloadTemplate = () => {
        const csvContent = generateTemplateCSV()
        const blob = new Blob([csvContent], { type: 'text/tab-separated-values;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', 'spensiv_template.txt')
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Importar Movimientos</h1>
                <p className="text-slate-500 mt-1">Pega tus datos directamente desde Excel o sube un archivo</p>
            </div>

            <div className="max-w-4xl mx-auto">
                {step === 'upload' && (
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Paste Option */}
                        <Card className="border-slate-200 shadow-sm border-2 border-blue-100 bg-blue-50/10">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Copy className="h-5 w-5 text-blue-600" />
                                    <CardTitle className="text-lg">Pegar desde Excel</CardTitle>
                                </div>
                                <CardDescription>Copia las celdas de tu planilla y pégalas aquí directamente.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea
                                    placeholder="Pega aquí (Fecha | Descripción | Categoría | Subcategoría | Tipo | Medio | Banco | Tarjeta | Monto | Cuotas)"
                                    className="min-h-[200px] font-mono text-xs bg-white"
                                    value={pasteData}
                                    onChange={(e) => setPasteData(e.target.value)}
                                />
                                <Button
                                    className="w-full h-11"
                                    disabled={!pasteData.trim() || isUploading}
                                    onClick={handleImport}
                                >
                                    {isUploading ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
                                    ) : (
                                        'Importar ahora'
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Template Info & File option */}
                        <div className="space-y-6">
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                        <CardTitle className="text-lg">Instrucciones</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-sm text-slate-600 space-y-4">
                                    <p>Para una importación exitosa, asegúrate de que las columnas coincidan con este orden:</p>
                                    <ol className="list-decimal list-inside space-y-1 bg-slate-50 p-3 rounded-lg text-[11px] font-semibold text-slate-700">
                                        <li>Fecha (DD/MM/YYYY)</li>
                                        <li>Descripción</li>
                                        <li>Categoría</li>
                                        <li>Subcategoría</li>
                                        <li>Tipo (Estructural/Emocional)</li>
                                        <li>Medio (Crédito/Efectivo/Transfer)</li>
                                        <li>Banco</li>
                                        <li>Tarjeta</li>
                                        <li>Monto (Sin letras ni $)</li>
                                        <li>Cuotas</li>
                                    </ol>
                                    <Button
                                        variant="outline"
                                        className="w-full flex items-center gap-2"
                                        onClick={downloadTemplate}
                                    >
                                        <Download className="h-4 w-4" /> Descargar Plantilla .TXT
                                    </Button>
                                </CardContent>
                            </Card>

                            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg flex gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
                                <p className="text-xs text-yellow-700">
                                    <strong>Importante:</strong> Si el medio de pago es "Crédito", asegúrate de que el nombre de la tarjeta coincida con una de tus tarjetas creadas en la sección "Tarjetas".
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'success' && results && (
                    <Card className="border-slate-200">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-green-100 p-4 rounded-full mb-6">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">¡Importación Completada!</h2>
                            <p className="text-slate-500 mt-2 mb-4">
                                Se han importado <strong>{results.success}</strong> movimientos con éxito.
                            </p>

                            {results.errors.length > 0 && (
                                <div className="w-full max-w-md bg-red-50 p-4 rounded-lg text-left mb-8 max-h-[200px] overflow-y-auto">
                                    <p className="text-xs font-bold text-red-700 mb-2">Errores encontrados ({results.errors.length}):</p>
                                    <ul className="text-[11px] text-red-600 list-disc list-inside">
                                        {results.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => { setStep('upload'); setPasteData(''); }}>Importar más</Button>
                                <Button onClick={() => window.location.href = '/dashboard'}>Ir al Dashboard</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
