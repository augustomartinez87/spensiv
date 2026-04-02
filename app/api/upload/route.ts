import { put, del } from '@vercel/blob'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const pathname = formData.get('pathname') as string | null

    if (!file || !pathname) {
      return NextResponse.json({ error: 'Archivo y pathname requeridos' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'El archivo excede 10MB' }, { status: 400 })
    }

    const blob = await put(pathname, file, { access: 'public' })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const { url } = await request.json()
    if (typeof url === 'string' && url.includes('.vercel-storage.com')) {
      await del(url)
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 400 })
  }
}
