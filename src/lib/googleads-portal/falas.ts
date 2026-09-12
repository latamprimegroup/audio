import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { isFalaId, listFalas as catalog } from './audio-mix'

/**
 * MP3s do CKv3. Procura em `data/` (deploy) e em `public/` (dev/repo).
 * Sem a variação, cai no áudio padrão — o mix não quebra por fala faltando.
 */
const DIRS = [
  ['data', 'googleads-portal', 'falas'],
  ['public', 'googleads-portal', 'falas'],
] as const

const FALLBACKS = [
  ['data', 'googleads-portal', 'audio_padrao.mp3'],
  ['data', 'googleads-portal', 'falas', 'audio_padrao.mp3'],
  ['public', 'googleads-portal', 'audio_padrao.mp3'],
] as const

export function falasDir(): string {
  return join(process.cwd(), ...DIRS[0])
}

function firstExisting(relatives: readonly (readonly string[])[]): string | null {
  for (const parts of relatives) {
    const path = join(process.cwd(), ...parts)
    if (existsSync(path)) return path
  }
  return null
}

export function resolveFalaPath(id: string): string | null {
  if (!isFalaId(id)) return null
  const exact = firstExisting(DIRS.map((dir) => [...dir, `${id}.mp3`]))
  if (exact) return exact
  return firstExisting(FALLBACKS)
}

export function listFalas(): Array<{ id: string; idioma: string; rotulo: string; ready: boolean }> {
  const fallback = firstExisting(FALLBACKS)
  return catalog().map((f) => ({
    id: f.id,
    idioma: f.lang,
    rotulo: f.label,
    ready: Boolean(firstExisting(DIRS.map((dir) => [...dir, `${f.id}.mp3`])) || fallback),
  }))
}
