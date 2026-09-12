import { AudioMixPanel } from '@/components/googleads-portal/AudioMixPanel'

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 md:px-8 md:py-14">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
            Latam Prime Group · Studio
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Studio de Áudio
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            O áudio original do criativo fica no canal <strong className="text-slate-200">estéreo</strong>.
            A fala escolhida entra em <strong className="text-slate-200">mono</strong>, em loop até o
            fim do vídeo — processado no servidor com ffmpeg.
          </p>
        </header>

        <AudioMixPanel />
      </div>
    </main>
  )
}
