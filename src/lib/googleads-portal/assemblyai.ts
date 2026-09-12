/**
 * Proxy AssemblyAI — a chave NUNCA sai do servidor.
 * Usado só pelo teste de transcrição do mixer CKv3 no portal.
 */

const UPLOAD = 'https://api.assemblyai.com/v2/upload'
const TRANSCRIPT = 'https://api.assemblyai.com/v2/transcript'
const TIMEOUT_MS = 90_000

export function assemblyAiConfigured(): boolean {
  return Boolean(process.env.ASSEMBLYAI_API_KEY?.trim())
}

function apiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY?.trim()
  if (!key) throw new Error('Transcrição desligada: defina ASSEMBLYAI_API_KEY no servidor.')
  return key
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

export type TranscriptResult = {
  text: string
  confidence: number | null
  language_code: string | null
  id: string
}

export async function transcribeAudio(buf: Buffer): Promise<TranscriptResult> {
  const key = apiKey()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    const uploaded = await fetch(UPLOAD, {
      method: 'POST',
      headers: { authorization: key },
      body: new Uint8Array(buf),
      signal: ac.signal,
    })
    const upJson = (await uploaded.json().catch(() => ({}))) as { upload_url?: string; error?: string }
    if (!uploaded.ok || !upJson.upload_url) {
      throw new Error(upJson.error || 'Falha ao enviar o áudio para transcrição.')
    }

    const created = await fetch(TRANSCRIPT, {
      method: 'POST',
      headers: { authorization: key, 'content-type': 'application/json' },
      body: JSON.stringify({ audio_url: upJson.upload_url, language_detection: true }),
      signal: ac.signal,
    })
    const createdJson = (await created.json().catch(() => ({}))) as { id?: string; error?: string }
    if (!created.ok || !createdJson.id) {
      throw new Error(createdJson.error || 'Falha ao iniciar a transcrição.')
    }

    for (let i = 0; i < 24; i++) {
      await sleep(2500)
      const polled = await fetch(`${TRANSCRIPT}/${createdJson.id}`, {
        headers: { authorization: key },
        signal: ac.signal,
      })
      const data = (await polled.json().catch(() => ({}))) as {
        status?: string
        text?: string
        confidence?: number
        language_code?: string
        error?: string
      }
      if (data.status === 'completed') {
        return {
          id: createdJson.id,
          text: (data.text ?? '').trim(),
          confidence: typeof data.confidence === 'number' ? data.confidence : null,
          language_code: data.language_code ?? null,
        }
      }
      if (data.status === 'error') throw new Error(data.error || 'Transcrição recusada.')
    }
    throw new Error('A transcrição demorou demais. Tente um vídeo mais curto.')
  } finally {
    clearTimeout(timer)
  }
}
