# Spensiv - Deploy en Vercel

## Configuración de Variables de Entorno

En el dashboard de Vercel, agregá estas variables de entorno:

### Requeridas:

```
# Base de datos PostgreSQL (Neon, Supabase, Railway, etc.)
DATABASE_URL="postgresql://usuario:contraseña@host:puerto/nombre_db?schema=public"

# Clerk Authentication (obtené de https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# URLs de Clerk
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

## Pasos para Deploy

1. **Conectar repositorio a Vercel:**
   - Importá el proyecto desde GitHub/GitLab
   - Seleccioná el framework: Next.js

2. **Configurar variables de entorno:**
   - Agregá todas las variables listadas arriba
   - Asegurate de que `DATABASE_URL` apunte a una DB PostgreSQL válida

3. **Configurar comandos de build (si es necesario):**
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

4. **Deploy:**
   - Click en "Deploy"
   - Esperá a que termine el build

## Configuración de Base de Datos

### Opción 1: Neon (Recomendado - Gratis)
1. Crear cuenta en https://neon.tech
2. Crear un nuevo proyecto
3. Copiar el "Connection String" (DATABASE_URL)

### Opción 2: Supabase
1. Crear proyecto en https://supabase.com
2. Ir a Settings > Database
3. Copiar la "Connection string" para Prisma

### Opción 3: Railway
1. Crear proyecto en https://railway.app
2. Agregar PostgreSQL
3. Copiar la DATABASE_URL

## Configuración de Clerk

1. Crear cuenta en https://clerk.com
2. Crear una nueva aplicación
3. En Settings > API Keys, copiar:
   - Publishable key (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
   - Secret key (CLERK_SECRET_KEY)
4. Configurar URLs de redirección:
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in: `/dashboard`
   - After sign-up: `/dashboard`

## Comandos Útiles

```bash
# Generar cliente Prisma (se ejecuta automáticamente en postinstall)
npx prisma generate

# Push schema a la base de datos
npx prisma db push

# Ver base de datos (desarrollo local)
npx prisma studio
```

## Notas Importantes

- La primera vez que un usuario inicia sesión, se crea automáticamente en la DB
- Las migraciones de Prisma se manejan automáticamente con `prisma db push`
- El schema de Prisma ya incluye todas las tablas necesarias

## Troubleshooting

### Error: "User not found"
- Verificar que CLERK_SECRET_KEY sea correcta
- Verificar que el usuario haya iniciado sesión correctamente

### Error: "Database connection failed"
- Verificar DATABASE_URL
- Asegurarse de que la DB esté accesible desde Vercel
- Verificar que el schema esté sincronizado: `npx prisma db push`

### Error: "Build failed"
- Verificar que todas las variables de entorno estén configuradas
- Revisar logs de build en Vercel
