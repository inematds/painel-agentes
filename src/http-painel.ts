// Rotas de leitura do painel. Chamadas pelo servidor (servidor-painel.ts) DEPOIS
// da autenticação:
//   GET  /api/painel                       todos os grupos + alertas
//   GET  /api/painel/<grupo>               um grupo
//   GET  /api/painel/alertas               só os alertas
//   GET  /api/painel/terminal?id=&n=       conversa de uma sessão conhecida, só leitura
//   GET  /api/painel/terminal/tela?id=     tela ao vivo (tmux do painel)
//   GET  /api/painel/falha?bot=&id=        resultado completo de uma falha (aberto no clique)
//   GET  /api/painel/chat?desde=           mensagens da conversa com o seu bot (se ligada)
// No modo demonstração tudo sai de demo.ts: nenhum arquivo, comando ou rede é tocado.
import type { ServerResponse } from 'node:http';

import { montarPainel, type Painel } from './agregador.js';
import { conversaDemo, falhaDemo, painelDemo, telaDemo } from './demo.js';
import { falhaCompleta } from './fontes/bots.js';
import { acharTranscript, lerConversa, SID } from './fontes/sessoes.js';
import { enviarAoPane, paneDoId, telaDoPane } from './fontes/assumir.js';
import { lerFim } from './util.js';
import type { DepsPainel } from './tipos.js';

const GRUPOS = new Set(['maquina', 'bots', 'producao', 'publicacao', 'creditos', 'sites', 'vagas', 'terminais', 'esperando']);

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

/** Painel inteiro com cache de 5 s (várias telas abertas dividem a mesma coleta). */
export function painelEmCache(d: DepsPainel): Promise<Painel> {
  return d.cache.obter('painel', 5000, async () => (d.demo ? painelDemo(d.agora(), d.versao, d.cfg) : montarPainel(d)));
}

const semTmux = (d: DepsPainel) => `esta sessão não está no tmux do painel (abra com: tmux -L ${d.cfg.assumir.tmux_servidor} new -s nome claude)`;

/** Envio do Assumir: acha o pane pelo id do corpo e digita. */
export async function enviarComId(d: DepsPainel, bruto: string, quem: string) {
  if (d.demo) return { status: 403, corpo: { erro: 'modo demonstração: nada é digitado' } };
  let id = '';
  try { id = String((JSON.parse(bruto || '{}') as { id?: unknown }).id ?? ''); } catch { return { status: 400, corpo: { erro: 'JSON inválido' } }; }
  if (!SID.test(id)) return { status: 400, corpo: { erro: 'id inválido' } };
  const pane = paneDoId((await painelEmCache(d)).grupos.terminais.dados?.vivos ?? [], id);
  if (!pane) return { status: 404, corpo: { erro: semTmux(d) } };
  return enviarAoPane(d, pane, bruto, quem, id);
}

/** Trata as rotas GET de dados. Devolve `true` se a rota era dele. */
export async function tratarPainel(res: ServerResponse, url: URL, d: DepsPainel): Promise<boolean> {
  const p = url.pathname;
  if (p === '/api/painel/chat') {
    const ligado = !d.demo && !!d.conversa;
    json(res, 200, { ligado, nome: d.cfg.chat.bot_nome, msgs: ligado && d.conversa ? d.conversa.desde(Number(url.searchParams.get('desde')) || 0) : [] });
    return true;
  }
  if (p === '/api/painel/terminal/tela') {
    const id = url.searchParams.get('id') ?? '';
    if (!SID.test(id)) { json(res, 400, { erro: 'id inválido' }); return true; }
    if (d.demo) { json(res, 200, { tela: telaDemo(id) }); return true; }
    const pane = paneDoId((await painelEmCache(d)).grupos.terminais.dados?.vivos ?? [], id);
    if (!pane) { json(res, 404, { erro: semTmux(d) }); return true; }
    const r = await telaDoPane(d, pane);
    json(res, r.status, r.corpo); return true;
  }
  if (p === '/api/painel/terminal') {
    // Conversa de uma sessão conhecida, SÓ LEITURA (últimas mensagens, segredos mascarados).
    const id = url.searchParams.get('id') ?? '';
    const n = Math.min(300, Math.max(10, Number(url.searchParams.get('n')) || 80));
    if (!SID.test(id)) { json(res, 400, { erro: 'id inválido' }); return true; }
    if (d.demo) { json(res, 200, { id, mensagens: conversaDemo(id, d.agora()) }); return true; }
    const painel = await painelEmCache(d);
    const t = painel.grupos.terminais.dados;
    const conhecida = [...(t?.vivos ?? []), ...(t?.interrompidos ?? [])].some((s) => s.session_id === id);
    if (!conhecida) { json(res, 404, { erro: 'sessão desconhecida' }); return true; }
    const arq = acharTranscript(d.cfg.terminais.projetos_claude, id);
    if (!arq) { json(res, 404, { erro: 'conversa não encontrada' }); return true; }
    json(res, 200, { id, mensagens: lerConversa(lerFim(arq, 1_500_000) ?? '', n) });
    return true;
  }
  if (p === '/api/painel/falha') {
    const id = Number(url.searchParams.get('id'));
    const bot = url.searchParams.get('bot') ?? '';
    if (!Number.isInteger(id) || id < 1) { json(res, 400, { erro: 'id inválido' }); return true; }
    if (d.demo) { json(res, 200, falhaDemo(bot, id)); return true; }
    try {
      const f = await falhaCompleta(d.cfg.bots, bot, id);
      if (f) json(res, 200, f); else json(res, 404, { erro: 'não achei esse job' });
    } catch (e) { json(res, 200, { erro: 'sem dados', detalhe: (e as Error).message }); }
    return true;
  }
  if (p === '/api/painel' || p.startsWith('/api/painel/')) {
    const painel = await painelEmCache(d);
    if (p === '/api/painel') { json(res, 200, painel); return true; }
    const nome = p.slice('/api/painel/'.length);
    if (nome === 'alertas') { json(res, 200, painel.alertas); return true; }
    if (!GRUPOS.has(nome)) { json(res, 404, { erro: 'grupo' }); return true; }
    json(res, 200, painel.grupos[nome as keyof Painel['grupos']]);
    return true;
  }
  return false;
}
