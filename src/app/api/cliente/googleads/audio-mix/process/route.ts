import { NextResponse } from 'next/server'
import { canUseAudioStudio } from '@/lib/googleads-portal/audio-studio-access'
import { clampMonoDb, MIX_MAX_BYTES, mixOutputName, parseFalaId } from '@/lib/googleads-portal/audio-mix'
import { ffmpegAvailable, runCkv3Mix } from '@/lib/googleads-portal/audio-mix-run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  if (!(await canUseAudioStudio(req))) {
    return NextResponse.json({ error: 'Acesso inválido.' }, { status: 401 })
  }

  if (!(await ffmpegAvailable())) {
    return NextResponse.json(
      { error: 'FFmpeg não está instalado neste servidor. Peça à gestão para instalar o pacote ffmpeg ou definir FFMPEG_PATH.' },
      { status: 503 },
    )
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Envie um vídeo no campo file.' }, { status: 422 })
  }
  if (file.size > MIX_MAX_BYTES) {
    return NextResponse.json(
      { error: `Vídeo acima do limite de ${Math.round(MIX_MAX_BYTES / 1024 / 1024)} MB.` },
      { status: 413 },
    )
  }
  if (!/^video\//i.test(file.type) && !/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name)) {
    return NextResponse.json({ error: 'Envie um arquivo de vídeo.' }, { status: 422 })
  }

  const parsed = parseFalaId(String(form?.get('falaId') ?? 'en1'))
  if (!parsed) {
    return NextResponse.json({ error: 'Fala inválida.' }, { status: 422 })
  }

  const volumeDb = clampMonoDb(form?.get('volumeDb'))
  const video = Buffer.from(await file.arrayBuffer())

  try {
    const out = await runCkv3Mix({
      video,
      falaId: `${parsed.lang}${parsed.variant}`,
      lang: parsed.lang,
      volumeDb,
    })
    const name = mixOutputName(file.name)
    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
        'X-File-Name': encodeURIComponent(name),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao processar o vídeo.'
    const status = /acima do limite/i.test(message) ? 413 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
