/**
 * Conferência do mix CKv3. A chave da AssemblyAI fica só no servidor.
 */
import { NextResponse } from 'next/server'
import { canUseAudioStudio } from '@/lib/googleads-portal/audio-studio-access'
import { MIX_MAX_BYTES } from '@/lib/googleads-portal/audio-mix'
import { assemblyAiConfigured, transcribeAudio } from '@/lib/googleads-portal/assemblyai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  if (!(await canUseAudioStudio(req))) {
    return NextResponse.json({ error: 'Acesso inválido.' }, { status: 401 })
  }
  return NextResponse.json({ configured: assemblyAiConfigured() })
}

export async function POST(req: Request) {
  if (!(await canUseAudioStudio(req))) {
    return NextResponse.json({ error: 'Acesso inválido.' }, { status: 401 })
  }
  if (!assemblyAiConfigured()) {
    return NextResponse.json(
      { error: 'Transcrição desligada. Configure ASSEMBLYAI_API_KEY no servidor.' },
      { status: 503 },
    )
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Envie o vídeo processado no campo file.' }, { status: 422 })
  }
  if (file.size > MIX_MAX_BYTES) {
    return NextResponse.json({ error: 'Arquivo grande demais para transcrever.' }, { status: 413 })
  }

  try {
    const result = await transcribeAudio(Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({
      ok: true,
      text: result.text,
      confidence: result.confidence,
      language_code: result.language_code,
      empty: result.text.length === 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha na transcrição.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
