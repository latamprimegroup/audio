/**
 * Mixer CKv3 no portal Google Ads — régua pura (filtro, falas, volume).
 * O mix em si roda no servidor (ffmpeg do SO). Nada de chave AssemblyAI aqui.
 */

export const FALA_LANGS = ['en', 'de'] as const
export type FalaLang = (typeof FALA_LANGS)[number]

export const FALA_VARIATIONS = 5
export const FALA_VAR_COUNT = FALA_VARIATIONS
export const FALA_VARS = [1, 2, 3, 4, 5] as const

export const MIN_MONO_DB = -60
export const MAX_MONO_DB = -10
export const DEFAULT_MONO_DB = -31.6
export const VOLUME_MIN_DB = MIN_MONO_DB
export const VOLUME_MAX_DB = MAX_MONO_DB
export const VOLUME_DEFAULT_DB = DEFAULT_MONO_DB

export const DEFAULT_DURATION_SEC = 60
export const ORIG_DUCK_DB = -4
/** Teto abaixo do `client_max_body_size 50m` do nginx de adsativos.com. */
export const MIX_MAX_BYTES = 45 * 1024 * 1024
export const MAX_VIDEO_BYTES = MIX_MAX_BYTES

export const FALA_PUBLIC_DIR = '/googleads-portal/falas'
export const FALA_FALLBACK_URL = '/googleads-portal/audio_padrao.mp3'

export type FalaId = `${FalaLang}${1 | 2 | 3 | 4 | 5}`

export type FalaOption = {
  id: string
  lang: FalaLang
  variant: number
  label: string
}

export function ffmpegBin(): string {
  return process.env.FFMPEG_PATH?.trim() || '/usr/bin/ffmpeg'
}

export function isFalaLang(value: string): value is FalaLang {
  return (FALA_LANGS as readonly string[]).includes(value)
}

/** `en` + variação 1 → `en1`. Fora de 1..5 devolve null. */
export function falaId(lang: string, variant: number): string | null {
  if (!isFalaLang(lang)) return null
  if (!Number.isInteger(variant) || variant < 1 || variant > FALA_VARIATIONS) return null
  return `${lang}${variant}`
}

/** Sempre devolve um id do catálogo (prende a faixa). */
export function falaIdOf(lang: FalaLang, variant: number): string {
  const n = Math.min(FALA_VARIATIONS, Math.max(1, Math.floor(variant) || 1))
  return `${lang}${n}`
}

export function parseFalaId(raw: unknown): { lang: FalaLang; variant: number } | null {
  if (typeof raw !== 'string') return null
  const m = /^(en|de)([1-5])$/.exec(raw.trim().toLowerCase())
  if (!m) return null
  return { lang: m[1] as FalaLang, variant: Number(m[2]) }
}

export function isFalaId(value: string): value is FalaId {
  return parseFalaId(value) !== null
}

export function listFalas(): FalaOption[] {
  return FALA_LANGS.flatMap((lang) =>
    FALA_VARS.map((variant) => ({
      id: `${lang}${variant}`,
      lang,
      variant,
      label: `Variação ${variant}`,
    })),
  )
}

export const FALA_CATALOG = listFalas()

export function falaUrl(id: string): string {
  return parseFalaId(id) ? `${FALA_PUBLIC_DIR}/${id}.mp3` : FALA_FALLBACK_URL
}

export function falaFileName(id: string): string | null {
  return parseFalaId(id) ? `${id}.mp3` : null
}

export function clampMonoDb(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  if (!Number.isFinite(n)) return DEFAULT_MONO_DB
  const clamped = Math.min(MAX_MONO_DB, Math.max(MIN_MONO_DB, n))
  return Math.round(clamped * 2) / 2
}

export const clampVolumeDb = clampMonoDb

export function parseFfmpegDuration(log: string): number | null {
  const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(log)
  if (!m) return null
  const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
  return Number.isFinite(sec) && sec > 0 ? sec : null
}

export const parseDurationFromFfmpegLog = parseFfmpegDuration

export function resolveMixDuration(
  logOrSec: string | number | null | undefined,
  fallback = DEFAULT_DURATION_SEC,
): number {
  if (typeof logOrSec === 'number') return logOrSec > 0 && Number.isFinite(logOrSec) ? logOrSec : fallback
  if (typeof logOrSec === 'string') return parseFfmpegDuration(logOrSec) ?? fallback
  return fallback
}

export function sanitizeDurationSec(raw: unknown, fallback = DEFAULT_DURATION_SEC): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.max(n, 0.1), 60 * 60)
}

export function buildMixFilter(durationSec: number, monoVolumeDb: number): string {
  const duration = sanitizeDurationSec(durationSec)
  const vol = clampMonoDb(monoVolumeDb).toFixed(1)
  return [
    `[0:a]pan=mono|c0=0.5*c0+0.5*c1,volume=${ORIG_DUCK_DB.toFixed(1)}dB[orig_mono]`,
    `[1:a]atrim=duration=${duration},asetpts=PTS-STARTPTS,volume=${vol}dB[mp3]`,
    `[mp3][orig_mono]amerge=inputs=2,pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0-0.5*c1[a]`,
  ].join(';')
}

type MixFiles = { video?: string; fala?: string; output?: string }

type MixOpts = {
  videoPath: string
  falaPath: string
  outPath: string
  durationSec: number
  volumeDb: number
}

export function buildMixArgs(durationSec: number, monoVolumeDb?: number, files?: MixFiles): string[]
export function buildMixArgs(opts: MixOpts): string[]
export function buildMixArgs(
  durationOrOpts: number | MixOpts,
  monoVolumeDb = DEFAULT_MONO_DB,
  files: MixFiles = {},
): string[] {
  if (typeof durationOrOpts === 'object') {
    return buildMixArgs(durationOrOpts.durationSec, durationOrOpts.volumeDb, {
      video: durationOrOpts.videoPath,
      fala: durationOrOpts.falaPath,
      output: durationOrOpts.outPath,
    })
  }
  return [
    '-y',
    '-i',
    files.video ?? 'input_video',
    '-stream_loop',
    '-1',
    '-i',
    files.fala ?? 'input_audio',
    '-filter_complex',
    buildMixFilter(durationOrOpts, monoVolumeDb),
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-map_metadata',
    '-1',
    '-map_metadata:s:v',
    '-1',
    '-map_metadata:s:a',
    '-1',
    '-map_chapters',
    '-1',
    '-fflags',
    '+bitexact',
    '-shortest',
    files.output ?? 'output.mp4',
  ]
}

export function mixOutputName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'video'
  return `${base}_processado.mp4`
}
