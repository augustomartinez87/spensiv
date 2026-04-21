import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, TrendingUp, PieChart } from 'lucide-react'

function SpensivoLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v10M9 9.5h4.5a2 2 0 010 4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 5l2-2M18 7l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-teal-400" />
    </svg>
  )
}

export default function LandingPage() {
  const currentYear = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <SpensivoLogo size={28} />
            <span className="font-bold text-xl">Spensiv</span>
          </div>
          <div className="flex gap-2">
            <Link href="/sign-in">
              <Button variant="ghost">Iniciar sesión</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Crear cuenta</Button>
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
            <div className="flex gap-3 justify-center">
              <Link href="/sign-up">
                <Button size="lg" className="text-lg px-8">Comenzar gratis</Button>
              </Link>
              <Link href="/sign-in">
                <Button size="lg" variant="outline" className="text-lg px-8">Ingresar</Button>
              </Link>
            </div>
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
          © {currentYear} Spensiv — Tu motor de cashflow personal
        </div>
      </footer>
    </div>
  )
}
