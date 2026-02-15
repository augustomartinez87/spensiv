'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileUp, Download, CheckCircle2, AlertCircle, Loader2, Copy, FileSpreadsheet } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { trpc } from '@/lib/trpc-client'
import { parseExcelPaste, parseIncomesPaste, generateTemplateCSV } from '@/lib/importer'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type ImportTab = 'gastos' | 'ingresos'

export default function ImportPage() {
    const [activeTab, setActiveTab] = useState<ImportTab>('gastos')
    const [pasteData, setPasteData] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [step, setStep] = useState<'upload' | 'success'>('upload')
    const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null)

    const utils = trpc.useUtils()

    const importTransactionsMutation = trpc.import.bulkTransactions.useMutation({
        onSuccess: (data) => {
            setResults(data)
            setStep('success')
            utils.transactions.list.invalidate()
            utils.dashboard.getMonthlyBalance.invalidate()
            toast({
                title: "Importacion finalizada!",
                description: `Se procesaron ${data.success} movimientos correctamente.`,
            })
        },
        onError: (error) => {
            toast({
                title: "Error en la importacion",
                description: error.message,
                variant: "destructive",
            })
        }
    })

    const importIncomesMutation = trpc.import.bulkIncomes.useMutation({
        onSuccess: (data) => {
            setResults(data)
            setStep('success')
            utils.dashboard.getMonthlyBalance.invalidate()
            toast({
                title: "Importacion finalizada!",
                description: `Se procesaron ${data.success} ingresos correctamente.`,
            })
        },
        onError: (error) => {
            toast({
                title: "Error en la importacion",
                description: error.message,
                variant: "destructive",
            })
        }
    })

    const handleImport = async () => {
        if (!pasteData.trim()) return

        setIsUploading(true)
        try {
            if (activeTab === 'gastos') {
                const parsedData = parseExcelPaste(pasteData)
                if (parsedData.length === 0) {
                    throw new Error("No se encontraron datos validos para importar. Asegurate de copiar las columnas correctas desde Excel.")
                }
                await importTransactionsMutation.mutateAsync(parsedData as any)
            } else {
                const parsedData = parseIncomesPaste(pasteData)
                if (parsedData.length === 0) {
                    throw new Error("No se encontraron ingresos validos para importar. Asegurate de copiar las columnas correctas desde Excel.")
                }
                await importIncomesMutation.mutateAsync(parsedData as any)
            }
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

    const handleTabChange = (tab: ImportTab) => {
        setActiveTab(tab)
        setPasteData('')
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Importar Movimientos</h1>
                <p className="text-slate-500 mt-1">Pega tus datos directamente desde Excel o sube un archivo</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => handleTabChange('gastos')}
                    className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                        activeTab === 'gastos'
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Gastos
                </button>
                <button
                    onClick={() => handleTabChange('ingresos')}
                    className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                        activeTab === 'ingresos'
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Ingresos
                </button>
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
                                <CardDescription>
                                    {activeTab === 'gastos'
                                        ? 'Copia las celdas de tu planilla y pegalas aqui directamente.'
                                        : 'Copia tus ingresos desde la planilla y pegalos aqui.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea
                                    placeholder={activeTab === 'gastos'
                                        ? "Pega aqui (Fecha | Descripcion | Categoria | Subcategoria | Tipo | Medio | Banco | Tarjeta | Monto | Cuotas)"
                                        : "Pega aqui (Fecha | Descripcion | Categoria | Subcategoria | Monto | Mes_Impacto)"}
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
                                        activeTab === 'gastos' ? 'Importar gastos' : 'Importar ingresos'
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
                                    <p>Para una importacion exitosa, asegurate de que las columnas coincidan con este orden:</p>
                                    {activeTab === 'gastos' ? (
                                        <ol className="list-decimal list-inside space-y-1 bg-slate-50 p-3 rounded-lg text-[11px] font-semibold text-slate-700">
                                            <li>Fecha (DD/MM/YYYY)</li>
                                            <li>Descripcion</li>
                                            <li>Categoria</li>
                                            <li>Subcategoria</li>
                                            <li>Tipo (Estructural/Emocional)</li>
                                            <li>Medio (Credito/Efectivo/Transfer)</li>
                                            <li>Banco</li>
                                            <li>Tarjeta</li>
                                            <li>Monto (Sin letras ni $)</li>
                                            <li>Cuotas</li>
                                        </ol>
                                    ) : (
                                        <ol className="list-decimal list-inside space-y-1 bg-slate-50 p-3 rounded-lg text-[11px] font-semibold text-slate-700">
                                            <li>Fecha (DD/MM/YYYY)</li>
                                            <li>Descripcion</li>
                                            <li>Categoria (Sueldo/Otro)</li>
                                            <li>Subcategoria (opcional)</li>
                                            <li>Monto (Sin letras ni $)</li>
                                            <li>Mes Impacto (YYYY-MM, opcional)</li>
                                        </ol>
                                    )}
                                    {activeTab === 'gastos' && (
                                        <Button
                                            variant="outline"
                                            className="w-full flex items-center gap-2"
                                            onClick={downloadTemplate}
                                        >
                                            <Download className="h-4 w-4" /> Descargar Plantilla .TXT
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg flex gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
                                <p className="text-xs text-yellow-700">
                                    {activeTab === 'gastos' ? (
                                        <><strong>Importante:</strong> Si el medio de pago es "Credito", asegurate de que el nombre de la tarjeta coincida con una de tus tarjetas creadas en la seccion "Tarjetas".</>
                                    ) : (
                                        <><strong>Importante:</strong> Si especificas un Mes de Impacto, el ingreso se registrara en el primer dia de ese mes. Si no, se usa la fecha original.</>
                                    )}
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
                            <h2 className="text-2xl font-bold text-slate-900">Importacion Completada!</h2>
                            <p className="text-slate-500 mt-2 mb-4">
                                Se han importado <strong>{results.success}</strong> {activeTab === 'gastos' ? 'movimientos' : 'ingresos'} con exito.
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
                                <Button variant="outline" onClick={() => { setStep('upload'); setPasteData(''); }}>Importar mas</Button>
                                <Button onClick={() => window.location.href = '/dashboard'}>Ir al Dashboard</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
