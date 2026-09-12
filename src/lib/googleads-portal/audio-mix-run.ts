import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import {
  buildMixArgs,
  MIX_MAX_BYTES,
  resolveMixDuration,
  type FalaLang,
} from './audio-mix'
import { resolveFalaPath } from './audio-mix-falas'

const execFileAsync = promisify(execFile)

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH?.trim() || '/usr/bin/ffmpeg'
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync(ffmpegBin(), ['-version'], { timeout: 8_000 })
    return true
  } catch {
    return false
  }
}

function asExecError(err: unknown): { stderr?: string; message: string } {
  if (err && typeof err === 'object') {
    const e = err as { stderr?: Buffer | string; message?: string }
    const stderr = typeof e.stderr === 'string' ? e.stderr : e.stderr?.toString()
    return { stderr, message: e.message || 'ffmpeg falhou' }
  }
  return { message: 'ffmpeg falhou' }
}

async function probeDuration(cwd: string): Promise<number> {
  let log = ''
  try {
    const { stderr } = await execFileAsync(ffmpegBin(), ['-i', 'input_video', '-f', 'null', '-'], {
      cwd,
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    })
    log = stderr?.toString() ?? ''
  } catch (err) {
    log = asExecError(err).stderr ?? ''
  }
  return resolveMixDuration(log)
}

export async function runCkv3Mix(opts: {
  video: Buffer
  falaId: string
  lang: FalaLang
  volumeDb: number
}): Promise<Buffer> {
  if (opts.video.length > MIX_MAX_BYTES) {
    throw new Error(`Vídeo acima do limite de ${Math.round(MIX_MAX_BYTES / 1024 / 1024)} MB.`)
  }
  const falaPath = await resolveFalaPath(opts.falaId)
  const work = await mkdtemp(join(tmpdir(), 'ckv3-'))
  try {
    await writeFile(join(work, 'input_video'), opts.video)
    const fala = await readFile(falaPath)
    await writeFile(join(work, 'input_audio'), fala)
    const duration = await probeDuration(work)
    const args = buildMixArgs(duration, opts.volumeDb)
    try {
      await execFileAsync(ffmpegBin(), args, {
        cwd: work,
        timeout: 240_000,
        maxBuffer: 8 * 1024 * 1024,
      })
    } catch (err) {
      const { stderr, message } = asExecError(err)
      const hint = stderr?.split('\n').filter(Boolean).slice(-6).join(' ') || message
      throw new Error(
        hint.includes('Stream map') || hint.includes('matches no streams')
          ? 'O vídeo precisa ter faixa de áudio para o mixer.'
          : `Falha no FFmpeg: ${hint.slice(0, 280)}`,
      )
    }
    return await readFile(join(work, 'output.mp4'))
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {})
  }
}
