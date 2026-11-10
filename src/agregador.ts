// Agregador do /api/painel: coleta cada grupo isolado (erro de um grupo vira
// `ok:false` naquele grupo, nunca 500), deriva "Esperando você" e aplica as
// regras de alerta. Custo por chamada: leituras de /proc, SQLite com LIMIT,
// fim de arquivos e comandos curtos com cache.
import { avaliarAlertas, type GruposColetados } from './alertas.js';
import { coletarBots } from './fontes/bots.js';
import { coletarCreditos } from './fontes/creditos.js';
import { coletarMaquina } from './fontes/maquina.js';
import { coletarProducao } from './fontes/producao.js';
import { coletarPublicacao } from './fontes/publicacao.js';
import { coletarSites } from './fontes/sites.js';
import { coletarPendencias, coletarTerminais } from './fontes/terminais.js';
import { coletarVagas, type DadosVagas } from './fontes/vagas.js';
import type { AlertaPainel, Coleta, DepsPainel, Grupo, NomeGrupo } from './tipos.js';

async function grupo<T>(d: DepsPainel, f: () => Promise<Coleta<T>> | Coleta<T>): Promise<Grupo<T>> {
  try {
    const r = await f();
    return { ok: true, gerado_em: d.agora(), dados: r.dados, ...(r.naoConfigurado ? { nao_configurado: true } : {}), ...(r.ausentes.length ? { ausentes: r.ausentes } : {}) };
  } catch (e) {
    return { ok: false, gerado_em: d.agora(), erro: (e as Error).message };
  }
}

export interface ItemEsperando { tipo: string; texto: string; nivel: 'erro' | 'aviso' | 'info'; grupo: NomeGrupo }

export function montarEsperando(g: GruposColetados, pendencias: { titulo: string }[] | null): ItemEsperando[] {
  const out: ItemEsperando[] = [];
  for (const b of g.bots.dados?.bots ?? []) for (const f of b.falhas_24h) out.push({ tipo: 'falha', nivel: 'erro', grupo: 'bots', texto: `${b.nome} #${f.id}${f.tarefa ? ' ' + f.tarefa : ''} falhou` });
  for (const r of g.producao.dados?.falhas ?? []) out.push({ tipo: 'falha', nivel: 'erro', grupo: 'producao', texto: `${r.unidade} falhou${r.motivo ? ': ' + r.motivo : ''}` });
  for (const r of g.producao.dados?.presas ?? []) out.push({ tipo: 'presa', nivel: 'erro', grupo: 'producao', texto: `${r.unidade} parada há ${r.aberta_min} min` });
  for (const e of g.producao.dados?.esperas ?? []) if (((e.estado === 'falhou' || e.estado === 'parado') && e.recente) || e.passou_teto) out.push({ tipo: 'espera', nivel: 'aviso', grupo: 'producao', texto: `Espera ${e.chave}: ${e.passou_teto ? 'passou do teto' : e.estado}` });
  for (const t of g.terminais.dados?.interrompidos ?? []) out.push({ tipo: 'terminal', nivel: 'aviso', grupo: 'terminais', texto: `Terminal interrompido em ${t.projeto}` });
  for (const a of g.creditos.dados?.avisos ?? []) out.push({ tipo: 'manual', nivel: a.vencido || a.nivel === 'erro' ? 'erro' : a.nivel === 'info' ? 'info' : 'aviso', grupo: 'creditos', texto: a.ate && /^\d{4}-\d{2}-\d{2}/.test(a.ate) ? `${a.titulo} até ${a.ate.slice(8, 10)}/${a.ate.slice(5, 7)}` : a.ate ? `${a.titulo} até ${a.ate}` : a.titulo });
  for (const p of pendencias ?? []) out.push({ tipo: 'pendencia', nivel: 'info', grupo: 'esperando', texto: p.titulo });
  return out;
}

/** O que a tela precisa saber da config (nada de caminho nem segredo). */
export interface TelaCfg { titulo: string; nome_falado: string; demo: boolean; chat: { bot: boolean; bot_nome: string; novo_terminal: boolean; raiz: string } }

export interface Painel {
  versao: string; gerado_em: number; ms: number;
  tela: TelaCfg;
  grupos: GruposColetados & { vagas: Grupo<DadosVagas>; esperando: Grupo<{ itens: ItemEsperando[] }> };
  alertas: AlertaPainel[];
}

const curto = (p: string) => p.replace(/^\/(home|Users)\/[^/]+/, '~');
export const telaCfg = (d: DepsPainel): TelaCfg => ({
  titulo: d.cfg.titulo, nome_falado: d.cfg.nome_falado, demo: !!d.demo,
  chat: { bot: !d.demo && !!d.conversa, bot_nome: d.cfg.chat.bot_nome, novo_terminal: !d.demo && !!d.assumir, raiz: curto(d.cfg.novo_terminal.raiz) },
});

export async function montarPainel(d: DepsPainel): Promise<Painel> {
  const t0 = Date.now();
  const [maquina, bots, producao, publicacao, creditos, sites, vagas, terminais] = await Promise.all([
    grupo(d, async () => ({ dados: await coletarMaquina(d), ausentes: [] })),
    grupo(d, () => coletarBots(d)),
    grupo(d, () => coletarProducao(d)),
    grupo(d, () => coletarPublicacao(d)),
    grupo(d, () => coletarCreditos(d)),
    grupo(d, () => coletarSites(d)),
    grupo(d, () => coletarVagas(d)),
    grupo(d, () => coletarTerminais(d)),
  ]);
  const g: GruposColetados = { maquina, bots, producao, publicacao, creditos, sites, terminais };
  const esperando = await grupo(d, () => {
    const pend = coletarPendencias(d);
    return { dados: { itens: montarEsperando(g, pend) }, ausentes: pend === null ? ['arquivo de pendências'] : [] };
  });
  const alertas = avaliarAlertas(g, d.agora(), { memoriaGb: d.cfg.maquina.memoria_min_gb, discoPct: d.cfg.maquina.disco_max_pct });
  return { versao: d.versao, gerado_em: d.agora(), ms: Date.now() - t0, tela: telaCfg(d), grupos: { ...g, vagas, esperando }, alertas };
}
