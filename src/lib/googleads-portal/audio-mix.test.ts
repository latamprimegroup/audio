import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DURATION_SEC,
  DEFAULT_MONO_DB,
  MAX_MONO_DB,
  MIN_MONO_DB,
  buildMixArgs,
  buildMixFilter,
  clampMonoDb,
  falaId,
  falaFileName,
  listFalas,
  mixOutputName,
  parseFalaId,
  parseFfmpegDuration,
  resolveMixDuration,
} from './audio-mix'

describe('falaId / parseFalaId', () => {
  it('monta en1..de5 e recusa o resto', () => {
    expect(falaId('en', 1)).toBe('en1')
    expect(falaId('de', 5)).toBe('de5')
    expect(falaId('en', 0)).toBeNull()
    expect(falaId('pt', 1)).toBeNull()
    expect(falaId('en', 1.5)).toBeNull()
  })

  it('parseia só o catálogo', () => {
    expect(parseFalaId('en3')).toEqual({ lang: 'en', variant: 3 })
    expect(parseFalaId(' de2 ')).toEqual({ lang: 'de', variant: 2 })
    expect(parseFalaId('en6')).toBeNull()
    expect(parseFalaId('en1.mp3')).toBeNull()
    expect(falaFileName('en1')).toBe('en1.mp3')
    expect(falaFileName('../en1')).toBeNull()
  })
})

describe('listFalas', () => {
  it('tem as 10 variações na ordem en→de', () => {
    const ids = listFalas().map((f) => f.id)
    expect(ids).toEqual(['en1', 'en2', 'en3', 'en4', 'en5', 'de1', 'de2', 'de3', 'de4', 'de5'])
  })
})

describe('clampMonoDb', () => {
  it('prende na faixa e arredonda em 0,5', () => {
    expect(clampMonoDb(-31.6)).toBe(-31.5)
    expect(clampMonoDb(-100)).toBe(MIN_MONO_DB)
    expect(clampMonoDb(0)).toBe(MAX_MONO_DB)
    expect(clampMonoDb(Number.NaN)).toBe(DEFAULT_MONO_DB)
  })
})

describe('parseFfmpegDuration', () => {
  it('lê o Duration do probe', () => {
    const log = 'Input #0\n  Duration: 00:01:05.12, start: 0.000000, bitrate: 1200 kb/s\n'
    expect(parseFfmpegDuration(log)).toBeCloseTo(65.12)
  })

  it('ignora lixo e duração zero', () => {
    expect(parseFfmpegDuration('no duration here')).toBeNull()
    expect(parseFfmpegDuration('Duration: 00:00:00.00,')).toBeNull()
  })
})

describe('resolveMixDuration', () => {
  it('cai em 60s quando o probe não fala', () => {
    expect(resolveMixDuration('')).toBe(DEFAULT_DURATION_SEC)
  })
})

describe('buildMixFilter / buildMixArgs', () => {
  it('reproduz o grafo do CKv3', () => {
    const filter = buildMixFilter(12.5, -31.6)
    expect(filter).toContain('volume=-4.0dB[orig_mono]')
    expect(filter).toContain('atrim=duration=12.5')
    expect(filter).toContain('volume=-31.5dB[mp3]')
    expect(filter).toContain('amerge=inputs=2')
  })

  it('não deixa duração negativa no filtro — cai nos 60s do CKv3', () => {
    expect(buildMixFilter(-3, -20)).toContain(`atrim=duration=${DEFAULT_DURATION_SEC}`)
    expect(buildMixFilter(-3, -20)).not.toContain('atrim=duration=-')
  })

  it('string maliciosa no volume não atravessa o filtro', () => {
    const filter = buildMixFilter(10, '; rm -rf /' as unknown as number)
    expect(filter).toContain(`volume=${DEFAULT_MONO_DB.toFixed(1)}dB[mp3]`)
    expect(filter).not.toContain('rm')
  })

  it('mapeia vídeo original + áudio misturado', () => {
    const args = buildMixArgs(8, -40)
    expect(args).toContain('-stream_loop')
    expect(args).toContain('output.mp4')
    expect(args[args.indexOf('-filter_complex') + 1]).toBe(buildMixFilter(8, -40))
  })
})

describe('mixOutputName', () => {
  it('troca a extensão e aguenta nome sem ela', () => {
    expect(mixOutputName('anuncio.mov')).toBe('anuncio_processado.mp4')
    expect(mixOutputName('clip')).toBe('clip_processado.mp4')
  })
})
