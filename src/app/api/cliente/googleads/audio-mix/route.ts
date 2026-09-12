import { NextResponse } from 'next/server'
import { canUseAudioStudio } from '@/lib/googleads-portal/audio-studio-access'
import { assemblyAiConfigured } from '@/lib/googleads-portal/assemblyai'
import { ffmpegAvailable } from '@/lib/googleads-portal/audio-mix-run'
import {
  DEFAULT_MONO_DB,
  FALA_FALLBACK_URL,
  MAX_MONO_DB,
  MIN_MONO_DB,
  MIX_MAX_BYTES,
  falaUrl,
  listFalas,
} from '@/lib/googleads-portal/audio-mix'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!(await canUseAudioStudio(req))) {
    return NextResponse.json({ error: 'Acesso inválido.' }, { status: 401 })
  }

  return NextResponse.json({
    falas: listFalas().map((f) => ({ ...f, url: falaUrl(f.id) })),
    fallbackUrl: FALA_FALLBACK_URL,
    volume: { min: MIN_MONO_DB, max: MAX_MONO_DB, default: DEFAULT_MONO_DB },
    maxBytes: MIX_MAX_BYTES,
    transcribe: assemblyAiConfigured(),
    ffmpeg: await ffmpegAvailable(),
  })
}
