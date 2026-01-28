# 💳 Spensiv

**Tu motor de cashflow personal basado en tarjetas de crédito y cuotas.**

Spensiv no es una simple app de gastos. Es un sistema completo de proyección de deuda que calcula automáticamente cuándo impacta cada cuota según las fechas de cierre de tus tarjetas.

---

## 🚀 Features

✅ **Motor de cuotas automático**
- Calcula automáticamente el mes de impacto de cada cuota
- Basado en la lógica: Si día_compra <= día_cierre → mismo mes, sino → mes siguiente

✅ **Proyección de cashflow**
- Visualiza tu deuda proyectada a 6, 12, 18 meses
- Cuotas activas distribuidas por mes

✅ **Múltiples tarjetas**
- Soporta todas tus tarjetas (Visa, Mastercard, Amex)
- Configuración flexible de cierre y vencimiento

✅ **Tipos de gasto customizados**
- Estructural (gastos fijos necesarios)
- Emocional Recurrente (placeres regulares)
- Emocional Impulsivo (compras espontáneas)

✅ **Sistema de anulación**
- Anula gastos sin perder datos
- Auditoría completa de todas las transacciones

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript
- **Backend:** tRPC (type-safe API)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Clerk
- **UI:** Tailwind CSS + shadcn/ui
- **Deployment:** Vercel

---

## 📦 Instalación

### 1. Clonar el proyecto

```bash
git clone <tu-repo>
cd spensiv
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Creá un archivo `.env` en la raíz del proyecto:

```env
# Database (puedes usar Supabase, Neon, o cualquier PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/spensiv?schema=public"

# Clerk Authentication (obtené las keys en https://clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### 4. Configurar base de datos

**Opción A: Supabase (Recomendado para desarrollo)**

1. Ir a [https://supabase.com](https://supabase.com)
2. Crear un nuevo proyecto
3. Ir a Settings → Database
4. Copiar la Connection String (URI)
5. Pegarla en `DATABASE_URL`

**Opción B: PostgreSQL local**

```bash
# Instalar PostgreSQL en tu máquina
brew install postgresql  # macOS
# o
sudo apt install postgresql  # Linux

# Crear base de datos
createdb spensiv

# Configurar .env con:
DATABASE_URL="postgresql://localhost:5432/spensiv?schema=public"
```

### 5. Push del schema a la DB

```bash
npm run db:push
```

Este comando:
- Lee el schema de Prisma
- Crea todas las tablas en la DB
- Genera el Prisma Client

### 6. Configurar Clerk

1. Ir a [https://clerk.com](https://clerk.com) y crear una cuenta
2. Crear una nueva aplicación
3. Ir a API Keys
4. Copiar:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → `CLERK_SECRET_KEY`
5. Pegar en tu `.env`

### 7. Ejecutar en desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📖 Uso

### 1. Crear tu primera tarjeta

1. Ir a **Dashboard → Tarjetas**
2. Click en "Agregar tarjeta"
3. Completar:
   - Nombre (ej: "CIUDAD Visa")
   - Banco (ej: "CIUDAD")
   - Marca (Visa/Mastercard/Amex)
   - Día de cierre (ej: 19)
   - Día de vencimiento (ej: 3)
4. Guardar

### 2. Registrar tu primer gasto

1. Ir a **Dashboard → Gastos**
2. Click en "Nuevo gasto"
3. Completar:
   - Descripción
   - Monto
   - Cantidad de cuotas
   - Tarjeta
   - Fecha de compra
4. Guardar

El sistema automáticamente:
- Calcula en qué mes impacta cada cuota
- Genera todas las cuotas
- Actualiza tu deuda proyectada

### 3. Ver tu cashflow

Ve a **Dashboard** para ver:
- Impacto del mes actual
- Deuda total
- Próximos vencimientos
- Proyección a futuro

---

## 🧮 Lógica del Motor de Cuotas

**Regla de cálculo del mes de impacto:**

```
SI día_compra <= día_cierre:
    → La cuota 1 impacta ESTE MES
    
SI día_compra > día_cierre:
    → La cuota 1 impacta MES SIGUIENTE
```

**Ejemplo:**

```
Tarjeta: CIUDAD Visa
Cierre: Día 19
Vencimiento: Día 3

Compra 1: 6 de Junio, $100k, 3 cuotas
  → Día 6 < 19 (antes del cierre)
  → Cuota 1: Impacta Junio
  → Cuota 2: Impacta Julio
  → Cuota 3: Impacta Agosto

Compra 2: 20 de Junio, $50k, 2 cuotas
  → Día 20 > 19 (después del cierre)
  → Cuota 1: Impacta Julio
  → Cuota 2: Impacta Agosto
```

---

## 🗂️ Estructura del Proyecto

```
spensiv/
├── app/                      # Next.js App Router
│   ├── api/
│   │   └── trpc/            # tRPC endpoint
│   ├── dashboard/           # Dashboard pages
│   │   ├── page.tsx         # Main dashboard
│   │   ├── cards/           # Tarjetas
│   │   └── transactions/    # Gastos
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home (redirect)
├── components/
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── prisma.ts            # Prisma client
│   ├── trpc.ts              # tRPC setup
│   ├── trpc-client.tsx      # tRPC React provider
│   ├── installment-engine.ts # Motor de cuotas
│   └── utils.ts             # Utilities
├── prisma/
│   └── schema.prisma        # Database schema
├── server/
│   ├── routers/             # tRPC routers
│   │   ├── cards.ts
│   │   ├── transactions.ts
│   │   └── dashboard.ts
│   └── index.ts             # Main router
├── .env                     # Variables de entorno
├── middleware.ts            # Clerk auth middleware
└── package.json
```

---

## 🔧 Scripts disponibles

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Start en producción
npm start

# Linter
npm run lint

# Prisma commands
npm run db:push       # Push schema a DB
npm run db:studio     # Abrir Prisma Studio (GUI)
npm run db:generate   # Generar Prisma Client
```

---

## 🚀 Deploy en Vercel

1. Push tu código a GitHub
2. Ir a [https://vercel.com](https://vercel.com)
3. Import tu repositorio
4. Agregar las variables de entorno:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
5. Deploy!

---

## 📊 Modelo de Datos

```
User
├── CreditCard (Tarjetas)
│   └── BillingCycle (Ciclos de facturación)
│       └── Installment (Cuotas)
│
└── Transaction (Compras)
    └── Installment (Cuotas generadas)
```

**Relación clave:**
- Una **Transaction** genera N **Installments**
- Cada **Installment** se asigna a un **BillingCycle** según su `impactDate`
- Los **BillingCycles** se crean automáticamente según la configuración de la tarjeta

---

## 🎯 Roadmap

### ✅ MVP (Actual)
- [x] Auth con Clerk
- [x] CRUD de tarjetas
- [x] CRUD de transacciones
- [x] Motor de cuotas
- [x] Dashboard básico
- [x] Proyección de cashflow

### 🚧 Próximos pasos
- [ ] Comparación con resumen bancario
- [ ] Upload de PDF bancario
- [ ] Matching automático de cuotas
- [ ] Alertas por email
- [ ] Categorías customizables
- [ ] IA: Clasificación automática
- [ ] IA: Sugerir mejor tarjeta
- [ ] Mobile app (React Native)

---

## 🤝 Contribuir

Si encontrás un bug o querés proponer una feature:
1. Abrí un issue
2. O mejor, hacé un PR!

---

## 📝 Licencia

MIT

---

## 👨‍💻 Autor

Creado con ❤️ para tomar control de tu cashflow personal.

**¿Preguntas?** Abrí un issue en GitHub.
