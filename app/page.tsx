import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, TrendingUp, PieChart } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💳</span>
            <span className="font-bold text-xl">Spensiv</span>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard">
              <Button>Ingresar al Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Tu motor de <span className="text-primary">cashflow personal</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Control inteligente de tarjetas de crédito, seguimiento de gastos e ingresos, 
              y proyección de deuda para tomar mejores decisiones financieras.
            </p>
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-8">
                Comenzar Ahora
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-muted/50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Características</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CreditCard className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Control de Tarjetas</CardTitle>
                  <CardDescription>
                    Gestiona múltiples tarjetas de crédito, fechas de cierre y vencimiento.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <PieChart className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Análisis de Gastos</CardTitle>
                  <CardDescription>
                    Visualiza tus gastos por categoría y tipo (estructural, emocional).
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <TrendingUp className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Proyección a 6 Meses</CardTitle>
                  <CardDescription>
                    Planifica tu futuro financiero con proyecciones de cashflow.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-4 bg-card">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          © 2026 Spensiv - Tu motor de cashflow personal
        </div>
      </footer>
    </div>
  )
}
