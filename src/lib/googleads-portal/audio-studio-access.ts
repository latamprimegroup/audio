/**
 * Gate de acesso do Studio de Áudio — versão STANDALONE.
 *
 * No projeto de origem (ERP War Room) este arquivo verificava sessão do
 * portal do cliente (Prisma: `GoogleAdsAccount`/`ClientProfile`) OU sessão
 * ERP com role ADMIN/PRODUCTION_MANAGER. Essa parte foi deixada de fora
 * desta extração de propósito — este módulo é só o mixer de áudio, sem
 * levar o schema/autenticação daquele projeto junto.
 *
 * Substitua a implementação abaixo pela autenticação real deste projeto
 * (sessão, JWT, API key de serviço, etc.). O padrão aqui é o mínimo
 * necessário para não deixar as rotas abertas por padrão:
 *
 *   - Se `AUDIO_STUDIO_TOKEN` não estiver definido no ambiente, o acesso é
 *     liberado (conveniente para rodar localmente) — troque isso antes de
 *     subir em produção.
 *   - Se estiver definido, exige `Authorization: Bearer <token>` batendo com
 *     o valor configurado.
 */
export async function canUseAudioStudio(req: Request): Promise<boolean> {
  const token = process.env.AUDIO_STUDIO_TOKEN?.trim()
  if (!token) return true

  const header = req.headers.get('authorization') ?? ''
  const provided = header.replace(/^Bearer\s+/i, '').trim()
  return provided === token
}
