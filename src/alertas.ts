// Regras de alerta do painel — ÚNICO lugar. Cada regra lê os grupos já
// coletados e devolve alertas com chave estável `regra:sujeito` (a voz da tela
// deduplica por ela). Fonte ausente nunca dispara alerta.
//
// Janelas escolhidas para a TV não nascer vermelha com o histórico:
//   job/rodada falhou → últimas 24 h · fila com erro → item com data nas últimas 48 h
//   reinício → últimas 6 h · erro de memória da GPU → última hora.
import type { AlertaPainel, Grupo, NomeGrupo } from './tipos.js';
import type { DadosMaquina } from './fontes/maquina.js';
import type { coletarBots } from './fontes/bots.js';
import type { coletarProducao } from './fontes/producao.js';
import { JANELA_ERRO_FILA_S, type coletarPublicacao } from './fontes/publicacao.js';
import type { coletarCreditos } from './fontes/creditos.js';
import type { coletarSites } from './fontes/sites.js';
import type { coletarTerminais } from './fontes/terminais.js';

type D<F extends (...a: never[]) => unknown> = Awaited<ReturnType<F>> extends { dados: infer X } ? X : never;
export interface GruposColetados {
  maquina: Grupo<DadosMaquina>;
  bots: Grupo<D<typeof coletarBots>>;
  producao: Grupo<D<typeof coletarProducao>>;
  publicacao: Grupo<D<typeof coletarPublicacao>>;
  creditos: Grupo<D<typeof coletarCreditos>>;
  sites: Grupo<D<typeof coletarSites>>;
  terminais: Grupo<D<typeof coletarTerminais>>;
}

export const LIMITES = { discoPct: 90, memoriaGb: 1, reinicioH: 6, limitePct: 80 };
export type Limites = typeof LIMITES;

interface Regra { id: string; grupo: NomeGrupo; avaliar: (g: GruposColetados, agora: number, l: Limites) => Omit<AlertaPainel, 'grupo'>[] }

const hora = (t: number | null) => (t ? new Date(t * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '?');
const host = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

export const REGRAS: Regra[] = [
  { id: 'disco', grupo: 'maquina', avaliar: (g, _a, l) => {
    const x = g.maquina.dados?.disco;
    return x && x.usado_pct > l.discoPct ? [{ chave: 'disco:raiz', nivel: 'erro', texto: `Disco da raiz em ${x.usado_pct}% (livres ${x.livre_gb} GB)` }] : [];
  } },
  { id: 'memoria', grupo: 'maquina', avaliar: (g, _a, l) => {
    const m = g.maquina.dados?.memoria;
    return m && m.disponivel_gb < l.memoriaGb ? [{ chave: 'memoria:baixa', nivel: 'erro', texto: `Memória disponível baixa: ${m.disponivel_gb} GB` }] : [];
  } },
  { id: 'gpu', grupo: 'maquina', avaliar: (g) => {
    const x = g.maquina.dados?.gpu_oom;
    const m = g.maquina.dados?.memoria;
    // Em placas que dividem a RAM do sistema, muito cache de disco faz o driver negar bloco grande mesmo com RAM "disponível".
    const cache = m?.cache_gb != null && m.cache_gb >= 16 ? ` — ${m.cache_gb} GB da RAM presos em cache de disco` : '';
    return x && x.ultima_hora > 0 ? [{ chave: 'gpu:oom', nivel: 'erro', texto: `GPU sem memória: ${x.ultima_hora} erro(s) na última hora (último ${hora(x.ultima_em)})${cache}` }] : [];
  } },
  { id: 'reinicio', grupo: 'maquina', avaliar: (g, agora) => {
    const b = g.maquina.dados?.boot_em;
    return b && agora - b < LIMITES.reinicioH * 3600 ? [{ chave: `reinicio:${b}`, nivel: 'aviso', texto: `A máquina reiniciou às ${hora(b)}` }] : [];
  } },
  { id: 'servico', grupo: 'bots', avaliar: (g) => Object.entries(g.bots.dados?.servicos ?? {})
    .filter(([, st]) => st !== 'active' && st !== 'desconhecido')
    .map(([s, st]) => ({ chave: `servico:${s}`, nivel: 'erro' as const, texto: `Serviço ${s} está ${st}` })) },
  { id: 'job-falhou', grupo: 'bots', avaliar: (g) => (g.bots.dados?.bots ?? []).flatMap((b) => b.falhas_24h
    .map((j) => ({ chave: `job-falhou:${b.nome}:${j.id}`, nivel: 'erro' as const, texto: `${b.nome}: job #${j.id}${j.tarefa ? ` (${j.tarefa})` : ''} falhou às ${hora(j.quando)}` }))) },
  { id: 'rodada-falhou', grupo: 'producao', avaliar: (g) => (g.producao.dados?.falhas ?? [])
    .map((r) => ({ chave: `rodada-falhou:${r.unidade}:${r.edicao ?? r.fim}`, nivel: 'erro' as const, texto: `Rodada ${r.unidade} falhou às ${hora(r.fim)}${r.motivo ? ': ' + r.motivo : ''}` })) },
  { id: 'rodada-presa', grupo: 'producao', avaliar: (g) => (g.producao.dados?.presas ?? [])
    .map((r) => ({ chave: `rodada-presa:${r.unidade}:${r.inicio}`, nivel: 'erro' as const, texto: `Rodada ${r.unidade} começou às ${hora(r.inicio)} e não terminou` })) },
  { id: 'espera', grupo: 'producao', avaliar: (g) => (g.producao.dados?.esperas ?? [])
    .filter((e) => e.passou_teto || (e.estado === 'falhou' && e.recente))
    .map((e) => ({ chave: `espera:${e.chave}:${e.estado}`, nivel: 'aviso' as const, texto: e.estado === 'falhou' ? `Espera ${e.chave} falhou` : `Espera ${e.chave} passou do teto de ${e.teto_h} h` })) },
  // Erro em fila só vira alerta se o item for recente (o antigo fica só na lista).
  { id: 'fila-erro', grupo: 'publicacao', avaliar: (g, agora) => (g.publicacao.dados?.filas_itens ?? [])
    .flatMap((f) => f.itens.filter((i) => i.estado === 'erro' && (i.quando === null || agora - i.quando < JANELA_ERRO_FILA_S))
      .map((i) => ({ chave: `fila-erro:${f.chave}:${i.id}`, nivel: 'aviso' as const, texto: `Fila ${f.nome}: "${i.nome}" deu erro` }))) },
  // Arquivo de fila vazio/corrompido = quem consome a fila parou (ex.: disco cheio zerou o arquivo e ninguém viu).
  { id: 'fila-ilegivel', grupo: 'publicacao', avaliar: (g) => (g.publicacao.dados?.filas_itens ?? [])
    .filter((f) => f.problema && /VAZIO|corrompido/.test(f.problema))
    .map((f) => ({ chave: `fila-ilegivel:${f.chave}`, nivel: 'erro' as const, texto: `${f.nome}: ${f.problema}` })) },
  { id: 'site-fora', grupo: 'sites', avaliar: (g) => (g.sites.dados?.sites ?? [])
    .filter((s) => !s.ok).map((s) => ({ chave: `site-fora:${host(s.url)}`, nivel: 'erro' as const, texto: `${host(s.url)} fora do ar (${s.erro ?? 'sem resposta'})` })) },
  { id: 'limite', grupo: 'creditos', avaliar: (g) => {
    const c = g.creditos.dados;
    const out = (c?.claude.limites ?? []).filter((l) => l.pct > LIMITES.limitePct)
      .map((l) => ({ chave: `limite-claude:${l.nome}`, nivel: 'aviso' as const, texto: `Claude ${l.nome}: ${l.pct}% usado` }));
    if (c?.codex && c.codex.pct > LIMITES.limitePct) out.push({ chave: 'limite-codex:semana', nivel: 'aviso', texto: `Codex: ${c.codex.pct}% do limite usado` });
    return out;
  } },
  { id: 'aviso-manual', grupo: 'creditos', avaliar: (g) => (g.creditos.dados?.avisos ?? [])
    .filter((a) => a.vencido || a.nivel === 'erro' || (a.dias !== null && a.dias <= 2))
    .map((a) => {
      const ate = a.ate && /^\d{4}-\d{2}-\d{2}/.test(a.ate) ? a.ate.slice(8, 10) + '/' + a.ate.slice(5, 7) : a.ate;
      return { chave: `manual:${a.titulo}`, nivel: a.nivel === 'erro' || a.vencido ? 'erro' as const : 'aviso' as const, texto: a.vencido ? `${a.titulo}: prazo passou (${ate})` : `${a.titulo}${ate ? ` até ${ate}` : ''}` };
    }) },
  { id: 'terminal-interrompido', grupo: 'terminais', avaliar: (g) => (g.terminais.dados?.interrompidos ?? [])
    .map((t) => ({ chave: `terminal-interrompido:${t.session_id}`, nivel: 'aviso' as const, texto: `Terminal interrompido em ${t.projeto}` })) },
];

export function avaliarAlertas(g: GruposColetados, agora: number, limites: Partial<Limites> = {}): AlertaPainel[] {
  const out: AlertaPainel[] = [];
  const l = { ...LIMITES, ...limites };
  for (const r of REGRAS) {
    try { for (const a of r.avaliar(g, agora, l)) out.push({ ...a, grupo: r.grupo }); } catch { /* regra nunca derruba o painel */ }
  }
  return out.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'erro' ? -1 : 1));
}
