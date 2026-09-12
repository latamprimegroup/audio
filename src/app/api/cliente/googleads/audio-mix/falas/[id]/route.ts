import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { canUseAudioStudio } from '@/lib/googleads-portal/audio-studio-access'
import { isFalaId } from '@/lib/googleads-portal/audio-mix'
import { resolveFalaPath } from '@/lib/googleads-portal/falas'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await canUseAudioStudio(req))) {
    return NextResponse.json({ error: 'Acesso inválido.' }, { status: 401 })
  }
  if (!isFalaId(params.id)) {
    return NextResponse.json({ error: 'Fala inexistente.' }, { status: 404 })
  }
  const path = resolveFalaPath(params.id)
  if (!path) {
    return NextResponse.json(
      { error: 'Falas ainda não geradas. Rode scripts/generate-portal-falas.py no servidor.' },
      { status: 503 },
    )
  }
  const buf = await readFile(path)
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
