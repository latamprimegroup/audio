'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_MONO_DB,
  FALA_LANGS,
  FALA_VARIATIONS,
  MAX_MONO_DB,
  MIN_MONO_DB,
  MIX_MAX_BYTES,
  type FalaLang,
  falaId,
  mixOutputName,
} from '@/lib/googleads-portal/audio-mix'

type JobState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'
type TestState = 'idle' | 'uploading' | 'transcribing' | 'done' | 'error'

type DoneItem = { name: string; url: string }

type Transcript = {
  text: string
  language_code: string | null
  confidence: number | null
}

const LANG_LABEL: Record<FalaLang, string> = { en: 'Inglês', de: 'Alemão' }

export function AudioMixPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [queue, setQueue] = useState<File[]>([])
  const [batchTotal, setBatchTotal] = useState(0)
  const [done, setDone] = useState<DoneItem[]>([])
  const autoRef = useRef(false)

  const [lang, setLang] = useState<FalaLang>('en')
  const [variant, setVariant] = useState(1)
  const [volume, setVolume] = useState(DEFAULT_MONO_DB)
  const [dragging, setDragging] = useState(false)

  const [job, setJob] = useState<JobState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DoneItem | null>(null)

  const [test, setTest] = useState<TestState>('idle')
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [transcribeReady, setTranscribeReady] = useState<boolean | null>(null)
  const [ffmpegReady, setFfmpegReady] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/cliente/googleads/audio-mix')
      .then((r) => (r.ok ? r.json() : {}))
      .then((raw: unknown) => {
        const d = (raw && typeof raw === 'object' ? raw : {}) as {
          transcribe?: boolean
          configured?: boolean
          ffmpeg?: boolean
        }
        setTranscribeReady(Boolean(d.transcribe ?? d.configured))
        setFfmpegReady(d.ffmpeg === true)
      })
      .catch(() => {
        setTranscribeReady(false)
        setFfmpegReady(null)
      })
  }, [])

  const takeFiles = useCallback((list: FileList | File[] | null) => {
    const arr = Array.from(list ?? []).filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|mkv|webm)$/i.test(f.name))
    if (!arr.length) return
    setFile(arr[0])
    setQueue(arr.slice(1))
    setBatchTotal(arr.length)
    setDone([])
    setResult(null)
    setJob('idle')
    setError(null)
    setTest('idle')
    setTranscript(null)
  }, [])

  const processOne = useCallback(
    async (video: File) => {
      if (video.size > MIX_MAX_BYTES) {
        setJob('error')
        setError(`Vídeo acima do teto (${Math.round(MIX_MAX_BYTES / 1024 / 1024)} MB).`)
        return
      }
      const id = falaId(lang, variant)
      if (!id) return
      setJob('uploading')
      setProgress(8)
      setError(null)
      const body = new FormData()
      body.append('file', video)
      body.append('falaId', id)
      body.append('volumeDb', String(volume))
      try {
        setJob('processing')
        setProgress(20)
        const res = await fetch('/api/cliente/googleads/audio-mix/process', { method: 'POST', body })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Falha ao processar.')
        }
        const blob = await res.blob()
        const name = mixOutputName(video.name)
        const url = URL.createObjectURL(blob)
        const item = { name, url }
        setResult(item)
        setDone((prev) => (prev.some((x) => x.url === url) ? prev : prev.concat(item)))
        setProgress(100)
        setJob('done')
      } catch (e) {
        setJob('error')
        setError(e instanceof Error ? e.message : 'Falha ao processar.')
      }
    },
    [lang, variant, volume],
  )

  useEffect(() => {
    if (job === 'done' && queue.length > 0 && !autoRef.current) {
      autoRef.current = true
      const next = queue[0]
      setQueue((q) => q.slice(1))
      setFile(next)
    }
  }, [job, queue])

  useEffect(() => {
    if (autoRef.current && file && job === 'done') {
      autoRef.current = false
      void processOne(file)
    }
  }, [file, job, processOne])

  const runTest = useCallback(async () => {
    if (!result || test === 'uploading' || test === 'transcribing') return
    setTest('uploading')
    setTestError(null)
    setTranscript(null)
    try {
      const blob = await fetch(result.url).then((r) => r.blob())
      const body = new FormData()
      body.append('file', new File([blob], result.name, { type: 'video/mp4' }))
      setTest('transcribing')
      const res = await fetch('/api/cliente/googleads/audio-mix/transcribe', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Falha na transcrição.')
      setTranscript({
        text: data.text ?? '',
        language_code: data.language_code ?? null,
        confidence: data.confidence ?? null,
      })
      setTest('done')
    } catch (e) {
      setTest('error')
      setTestError(e instanceof Error ? e.message : 'Falha na transcrição.')
    }
  }, [result, test])

  const busy = job === 'uploading' || job === 'processing'
  const currentFala = falaId(lang, variant)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Processar criativo</h2>
        <p className="text-sm text-slate-500">
          O áudio original vai para o canal estéreo e a fala escolhida entra no mono, em loop até o
          fim do vídeo.
        </p>
      </div>

      {ffmpegReady === false && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          O mixer está desligado neste servidor (FFmpeg não encontrado). Peça à gestão para instalar
          o pacote <code className="rounded bg-black/30 px-1">ffmpeg</code> ou definir{' '}
          <code className="rounded bg-black/30 px-1">FFMPEG_PATH</code>.
        </p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          takeFiles(e.dataTransfer.files)
        }}
        className={`flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragging
            ? 'border-blue-400 bg-blue-500/10'
            : file
              ? 'border-blue-500/40 bg-slate-900/80'
              : 'border-white/15 bg-slate-950/40 hover:border-white/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => takeFiles(e.target.files)}
        />
        {file ? (
          <>
            <span className="text-2xl">🎬</span>
            <span className="max-w-full truncate text-sm font-semibold text-white">{file.name}</span>
            <span className="text-xs text-slate-500">
              {(file.size / 1024 / 1024).toFixed(1)} MB · clique para trocar
              {queue.length > 0 ? ` · +${queue.length} na fila` : ''}
            </span>
          </>
        ) : (
          <>
            <span className="text-2xl">📁</span>
            <span className="text-sm text-slate-400">Arraste um ou mais vídeos ou clique para selecionar</span>
            <span className="text-xs text-slate-600">até {Math.round(MIX_MAX_BYTES / 1024 / 1024)} MB por arquivo</span>
          </>
        )}
      </button>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Fala extra</p>
          <div className="flex gap-1.5">
            {FALA_LANGS.map((id) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => setLang(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                  lang === id
                    ? 'bg-blue-600 text-white'
                    : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {LANG_LABEL[id]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {Array.from({ length: FALA_VARIATIONS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => setVariant(n)}
              className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition disabled:opacity-40 ${
                variant === n
                  ? 'bg-blue-600 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              Variação {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {currentFala
            ? `Fala ${currentFala} · repete em loop até o fim do vídeo`
            : 'Escolha idioma e variação'}
        </p>
        {currentFala && (
          <audio
            key={currentFala}
            controls
            preload="none"
            src={`/googleads-portal/falas/${currentFala}.mp3`}
            className="mt-3 w-full"
          />
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Volume do mono</p>
          <span className="font-mono text-lg font-bold text-blue-300">{volume.toFixed(1)} dB</span>
        </div>
        <input
          type="range"
          min={MIN_MONO_DB}
          max={MAX_MONO_DB}
          step={0.5}
          value={volume}
          disabled={busy}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="mt-3 w-full accent-blue-500 disabled:opacity-40"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-600">
          <span>−60 dB (inaudível)</span>
          <span>−10 dB (alto)</span>
        </div>
      </section>

      <button
        type="button"
        disabled={!file || busy || ffmpegReady === false}
        onClick={() => file && void processOne(file)}
        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-500 hover:to-blue-400 disabled:opacity-40"
      >
        {busy ? (job === 'uploading' ? 'Enviando…' : 'Processando…') : 'Processar'}
      </button>

      {busy && (
        <div>
          {batchTotal > 1 && (
            <p className="mb-1 text-xs text-slate-500">
              Vídeo {batchTotal - queue.length} de {batchTotal}
            </p>
          )}
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {result && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4">
          <span className="text-2xl">✅</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-emerald-100">{result.name}</p>
            <p className="text-xs text-emerald-300/80">Pronto para download</p>
          </div>
          <a
            href={result.url}
            download={result.name}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Baixar
          </a>
        </div>
      )}

      {done.length > 1 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs font-semibold text-slate-400">
            Concluídos ({done.length}/{batchTotal})
          </p>
          <ul className="mt-2 space-y-1.5">
            {done.map((item) => (
              <li key={item.url} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-300">{item.name}</span>
                <a href={item.url} download={item.name} className="shrink-0 text-xs font-semibold text-emerald-400 hover:underline">
                  Baixar
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Verificar áudio</p>
              <p className="text-xs text-slate-500">Transcreve o que o fingerprint ouve (canal mono).</p>
            </div>
            <button
              type="button"
              disabled={test === 'uploading' || test === 'transcribing' || transcribeReady === false}
              onClick={() => void runTest()}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40"
            >
              {test === 'uploading'
                ? 'Enviando…'
                : test === 'transcribing'
                  ? 'Transcrevendo…'
                  : test === 'done'
                    ? 'Testar de novo'
                    : 'Testar'}
            </button>
          </div>
          {transcribeReady === false && (
            <p className="mt-3 text-xs text-amber-300/80">
              Transcrição desligada neste servidor (falta <code>ASSEMBLYAI_API_KEY</code>).
            </p>
          )}
          {(test === 'uploading' || test === 'transcribing') && (
            <p className="mt-3 text-xs text-slate-500">
              {test === 'uploading' ? 'Enviando para transcrição…' : 'Transcrevendo…'}
            </p>
          )}
          {test === 'done' && transcript && (
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <div className="mb-2 flex gap-4 text-[11px] text-slate-500">
                <span>
                  Idioma:{' '}
                  <strong className="text-slate-300">{transcript.language_code?.toUpperCase() ?? '?'}</strong>
                </span>
                <span>
                  Confiança:{' '}
                  <strong className="text-slate-300">
                    {transcript.confidence != null ? `${Math.round(transcript.confidence * 100)}%` : '?'}
                  </strong>
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-200">
                {transcript.text.trim() || (
                  <em className="text-emerald-300">(nada detectado — áudio inaudível)</em>
                )}
              </p>
            </div>
          )}
          {test === 'error' && <p className="mt-3 text-sm text-red-300">{testError}</p>}
        </section>
      )}
    </div>
  )
}
