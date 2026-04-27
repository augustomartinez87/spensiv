import type { AfipPersona } from '@/lib/consulta-360/types'
import { Building2, MapPin, Briefcase, Hash } from 'lucide-react'

export function AfipSection({
  data,
  status,
}: {
  data: AfipPersona | null
  status: 'ok' | 'unavailable' | 'error'
}) {
  if (!data || status !== 'ok') {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-muted-foreground">
        Datos AFIP no disponibles
        {status === 'unavailable' && ' (servicio público intermitente)'}
        {status === 'error' && ' (error de comunicación)'}
        . El resto del informe se calcula con BCRA igualmente.
      </div>
    )
  }

  const nombre =
    data.razonSocial ||
    [data.apellido, data.nombre].filter(Boolean).join(', ') ||
    '—'
  const dom = data.domicilioFiscal
  const domStr = dom
    ? [dom.direccion, dom.localidad, dom.descripcionProvincia].filter(Boolean).join(' · ')
    : null
  const actividadPrincipal = data.actividad?.find((a) => a.orden === 1) ?? data.actividad?.[0]

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Item
        icon={<Building2 className="h-4 w-4" />}
        label="Nombre / Razón Social"
        value={nombre}
      />
      <Item
        icon={<Hash className="h-4 w-4" />}
        label="Tipo / Estado"
        value={`${data.tipoPersona ?? '—'} · ${data.estadoClave ?? '—'}`}
      />
      <Item
        icon={<MapPin className="h-4 w-4" />}
        label="Domicilio fiscal"
        value={domStr ?? '—'}
        wide
      />
      <Item
        icon={<Briefcase className="h-4 w-4" />}
        label="Actividad principal"
        value={
          actividadPrincipal
            ? `${actividadPrincipal.idActividad ?? '—'} · ${actividadPrincipal.descripcionActividad ?? '—'}`
            : '—'
        }
        wide
      />
      {data.monotributo?.categoriaMonotributo && (
        <Item
          icon={<Briefcase className="h-4 w-4" />}
          label="Monotributo"
          value={`Categoría ${data.monotributo.categoriaMonotributo}${
            data.monotributo.descripcionActividadMonotributo
              ? ` · ${data.monotributo.descripcionActividadMonotributo}`
              : ''
          }`}
        />
      )}
      {data.impuesto && data.impuesto.length > 0 && (
        <Item
          icon={<Briefcase className="h-4 w-4" />}
          label="Impuestos activos"
          value={data.impuesto
            .filter((i) => i.estado === 'ACTIVO')
            .map((i) => i.descripcionImpuesto)
            .filter(Boolean)
            .join(' · ') || '—'}
          wide
        />
      )}
    </div>
  )
}

function Item({
  icon,
  label,
  value,
  wide,
}: {
  icon: React.ReactNode
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div
      className={`rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 ${
        wide ? 'md:col-span-2' : ''
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  )
}
