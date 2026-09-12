import { NextResponse } from 'next/server'
import { canUseAudioStudio } from '@/lib/googleads-portal/audio-studio-access'
import { FALA_FALLBACK_URL, falaUrl, listFalas } from '@/lib/googleads-portal/audio-mix'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!(await canUseAudioStudio(req))) {
    return NextResponse.json({ error: 'Acesso inválido.' }, { status: 401 })
  }

  return NextResponse.json({
    items: listFalas().map((f) => ({
      id: f.id,
      lang: f.lang,
      variant: f.variant,
      label: f.label,
      url: falaUrl(f.id),
    })),
    fallbackUrl: FALA_FALLBACK_URL,
  })
}
