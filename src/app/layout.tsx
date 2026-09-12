import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Studio de Áudio · Latam Prime',
  description:
    'Mixer de vídeo: áudio original em estéreo + fala extra em mono, em loop até o fim do vídeo.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
