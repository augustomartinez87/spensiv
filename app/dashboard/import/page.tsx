'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileUp, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function ImportPage() {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [step, setStep] = useState<'upload' | 'mapping' | 'success'>('upload')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = () => {
        if (!file) return
        setIsUploading(true)

        // Simulate processing
        setTimeout(() => {
            setIsUploading(false)
            setStep('success')
            toast({
                title: "¡Importación exitosa!",
                description: `Se han procesado 42 movimientos correctamente.`,
            })
        }, 2000)
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Importar Movimientos</h1>
                <p className="text-slate-500 mt-1">Sube tus resúmenes bancarios o planillas Excel para procesar en bloque</p>
            </div>

            <div className="max-w-2xl mx-auto">
                {step === 'upload' && (
                    <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <div className="bg-white p-4 rounded-full shadow-sm mb-6">
                                <FileUp className="h-8 w-8 text-blue-600" />
                            </div>

                            <h3 className="text-lg font-bold text-slate-900">Sube tu archivo</h3>
                            <p className="text-sm text-slate-500 text-center max-w-sm mt-1 mb-8">
                                Arrastra tu archivo CSV o Excel aquí, o haz clic para seleccionar uno de tu computadora.
                            </p>

                            <div className="flex flex-col items-center gap-4 w-full px-8">
                                <input
                                    type="file"
                                    id="file-upload"
                                    className="hidden"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileChange}
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="cursor-pointer bg-white border border-slate-200 text-slate-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition w-full text-center"
                                >
                                    {file ? file.name : 'Seleccionar Archivo'}
                                </label>

                                <Button
                                    className="w-full h-11"
                                    disabled={!file || isUploading}
                                    onClick={handleUpload}
                                >
                                    {isUploading ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
                                    ) : (
                                        'Continuar Importación'
                                    )}
                                </Button>
                            </div>

                            <div className="mt-8 flex items-center gap-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> CSV</span>
                                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> EXCEL</span>
                                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> TXT</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {step === 'success' && (
                    <Card className="border-slate-200">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-green-100 p-4 rounded-full mb-6">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">¡Todo listo!</h2>
                            <p className="text-slate-500 mt-2 mb-8 max-w-sm">
                                Tus movimientos han sido importados y clasificados. Ya puedes verlos en tu dashboard o historial.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setStep('upload')}>Importar otro</Button>
                                <Button onClick={() => window.location.href = '/dashboard'}>Ir al Dashboard</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Template info */}
                <div className="mt-8 p-6 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="flex gap-4">
                        <div className="bg-blue-100 p-2 rounded-lg shrink-0 h-fit">
                            <Download className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900">¿No tienes el formato?</h4>
                            <p className="text-sm text-slate-600 mt-1">
                                Descarga nuestra plantilla oficial para asegurarte de que tus datos se importen correctamente.
                            </p>
                            <Button variant="link" className="text-blue-600 p-0 h-auto mt-2 text-sm font-bold">
                                Descargar plantilla .CSV
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
