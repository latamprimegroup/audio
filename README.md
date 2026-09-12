# 🎙️ Studio de Áudio

Mixer de vídeo: o áudio original entra no canal **estéreo**, uma fala extra
(voz gravada) entra no canal **mono**, em **loop até o fim do vídeo**. Roda
inteiramente no servidor via `ffmpeg` (chamado direto pelo binário do
sistema, sem wrapper npm).

Extraído do ERP **War Room OS** (ADS Ativos) em 2026-09-12. Lá o mesmo
componente (`AudioMixPanel`) é usado em dois lugares: no portal do cliente
(aba "Studio de Áudio") e na tela admin `/dashboard/admin/googleads-portal`,
para a equipe conferir um criativo sem precisar logar como o cliente.

Este repo contém **só o módulo de áudio** — a camada de acesso do projeto
de origem (sessão do portal + Prisma `GoogleAdsAccount`/`ClientProfile`) foi
deixada de fora de propósito. Veja "Autenticação" abaixo.

## O que tem aqui

```
src/
  lib/googleads-portal/
    audio-mix.ts              # regra pura: filtro ffmpeg, catálogo de falas, clamp de volume
    audio-mix-run.ts          # roda o ffmpeg de verdade (execFile), probe de duração
    audio-mix-falas.ts        # resolve/escreve o mp3 da fala no disco
    falas.ts                  # resolvedor alternativo (data/ ou public/) + fallback padrão
    assemblyai.ts             # proxy AssemblyAI, só para o botão "Testar" (transcrição)
    audio-studio-access.ts    # gate de acesso — STANDALONE, adapte à sua auth (ver abaixo)
    audio-mix.test.ts         # testes (vitest) da régua pura
  components/googleads-portal/
    AudioMixPanel.tsx         # UI completa: upload, escolha de fala, volume, processar, testar
  app/api/cliente/googleads/audio-mix/
    route.ts                  # GET  — config (falas, limites, disponibilidade de ffmpeg)
    process/route.ts          # POST — faz o mix e devolve o vídeo processado
    falas/route.ts            # GET  — lista o catálogo de falas
    falas/[id]/route.ts       # GET  — serve um mp3 de fala
    transcribe/route.ts       # GET/POST — transcreve o mix para conferência
public/googleads-portal/
  falas/{en,de}{1..5}.mp3      # 10 falas (5 variações × 2 idiomas)
  falas/index.json
  audio_padrao.mp3             # fallback quando a fala pedida não existe no disco
scripts/generate-portal-falas.py  # gerador offline das falas via edge-tts (Python)
```

Não existe implementação duplicada — o painel do cliente e a tela admin só
importam/remontam este mesmo `AudioMixPanel`.

## Como integrar num projeto Next.js (App Router)

1. Copie as pastas `src/lib/googleads-portal`, `src/components/googleads-portal`
   e `src/app/api/cliente/googleads/audio-mix` para dentro do `src/` do seu
   projeto (mantendo os mesmos caminhos relativos — o componente já chama
   `fetch('/api/cliente/googleads/audio-mix...')` com esses caminhos
   hard-coded; se for renomear a rota, ajuste as 3 chamadas `fetch` em
   `AudioMixPanel.tsx`).
2. Copie `public/googleads-portal/` para o `public/` do seu projeto (o player
   de preview do painel toca `/googleads-portal/falas/{id}.mp3` direto).
3. Garanta que o alias `@/*` aponte para `src/*` no seu `tsconfig.json`
   (`compilerOptions.paths`) — todos os imports internos usam `@/lib/...`.
4. Monte o painel em qualquer página/rota:
   ```tsx
   import { AudioMixPanel } from '@/components/googleads-portal/AudioMixPanel'

   export default function Page() {
     return <AudioMixPanel />
   }
   ```
5. Garanta `ffmpeg` instalado no servidor (ou defina `FFMPEG_PATH` apontando
   pro binário). Sem isso a rota de config já avisa `ffmpeg: false` e o botão
   "Processar" fica desabilitado — o app não quebra, só desliga o mixer.

## Variáveis de ambiente

| Variável | Obrigatória | Efeito |
|---|---|---|
| `FFMPEG_PATH` | não | Caminho do binário ffmpeg. Padrão: `/usr/bin/ffmpeg`. |
| `ASSEMBLYAI_API_KEY` | não | Liga o botão "Testar" (transcreve o canal mono pra conferir o que o fingerprint ouve). Sem ela, o botão fica desabilitado e a UI avisa. |
| `AUDIO_STUDIO_TOKEN` | não | Ver "Autenticação" abaixo. |

## Autenticação — **leia antes de subir em produção**

No projeto de origem, `canUseAudioStudio()` verificava sessão do portal do
cliente (JWT + Prisma) OU sessão ERP com role `ADMIN`/`PRODUCTION_MANAGER`.
Essa parte é específica daquele schema e **não foi trazida** — traria junto
os modelos `GoogleAdsAccount`/`ClientProfile` e o módulo inteiro de
browser-automation (`browser-core/profile-store`) só para resolver "de quem
é essa conta", o que não faz sentido fora daquele projeto.

O que veio no lugar (`src/lib/googleads-portal/audio-studio-access.ts`) é um
gate mínimo：

- Sem `AUDIO_STUDIO_TOKEN` definido → libera geral (bom só para rodar local).
- Com `AUDIO_STUDIO_TOKEN` definido → exige header
  `Authorization: Bearer <token>` batendo com o valor configurado.

**Troque esse arquivo pela autenticação real do projeto que for hospedar
este módulo** (sessão própria, outro JWT, API key de serviço — o que fizer
sentido lá). Todas as 5 rotas em `app/api/cliente/googleads/audio-mix/`
chamam só essa função — é o único lugar que precisa mudar.

## Rodando os testes

A régua de mix (`audio-mix.ts`) é pura e testada (`audio-mix.test.ts`):

```bash
npm i -D vitest typescript @types/node
npx vitest run
```

## Detalhe conhecido (não corrigido nesta extração)

`falas.ts` e `audio-mix-falas.ts` fazem uma coisa parecida (resolver o
caminho do mp3 de uma fala no disco) de formas ligeiramente diferentes —
duplicação que já existia no projeto de origem. Funciona como está; vale
reconciliar num refactor futuro se for mexer nessa área.

## Origem

Extraído de `latamprimegroup/new_erp_latam` (ERP War Room OS / ADS Ativos)
em 2026-09-12, a pedido da equipe, para reuso num outro projeto da Latam
Prime Group. Uso interno — não distribuir externamente.
