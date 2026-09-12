import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FALA_FALLBACK_URL, falaFileName, parseFalaId } from './audio-mix'
import { resolveFalaPath as resolveOnDisk } from './falas'

const PUBLIC_FALAS = join(process.cwd(), 'public', 'googleads-portal', 'falas')

export function falasDir(): string {
  return PUBLIC_FALAS
}

/** Caminho da fala no disco. Sem o mp3 da variação, cai no áudio padrão. */
export async function resolveFalaPath(id: string): Promise<string> {
  const path = resolveOnDisk(id)
  if (path) return path
  throw new Error(
    parseFalaId(id)
      ? 'Falas ainda não foram geradas neste servidor. Rode o gerador de TTS ou envie os MP3.'
      : 'Fala inválida.',
  )
}

export function fallbackPublicUrl(): string {
  return FALA_FALLBACK_URL
}

export async function ensureFalasDir(): Promise<string> {
  await mkdir(PUBLIC_FALAS, { recursive: true })
  return PUBLIC_FALAS
}

export async function writeFalaMp3(id: string, buf: Buffer): Promise<string> {
  const file = falaFileName(id)
  if (!file) throw new Error('Fala inválida.')
  const dir = await ensureFalasDir()
  const dest = join(dir, file)
  await writeFile(dest, buf)
  return dest
}
