// Produção: placar `rodadas.jsonl` (início/fim de cada unidade), esperas longas
// (arquivo JSON {chave: {estado, desde, teto_h, ...}}) e próximos timers do systemd do usuário.
import type { Coleta, DepsPainel } from '../tipos.js';
import { corta, inicioDoDia, lerFim, lerJson, linhasJson, paraEpoch } from '../util.js';

export const PRESA_MIN = 90;

interface LinhaRodada { ts?: unknown; unidade?: string; fase?: string; edicao?: string; resultado?: string; motivo?: string; url?: string; msg?: unknown; dur_s?: number; host?: string }
export interface Rodada {
  unidade: string; edicao: string | null; inicio: number | null; fim: number | null;
  resultado: string | null; motivo: string | null; url: string | null; dur_s: number | null;
  presa: boolean; aberta_min: number | null;
}

/** Junta início/fim por unidade (+ edição quando houver). Tolerante a linha sem campo. */
export function montarRodadas(linhas: LinhaRodada[], agora: number): Rodada[] {
  const ev = linhas
    .map((l) => ({ ...l, t: paraEpoch(l.ts) }))
    .filter((l): l is LinhaRodada & { t: number; unidade: string } => l.t !== null && typeof l.unidade === 'string' && !!l.unidade)
    .sort((a, b) => a.t - b.t);
  const out: Rodada[] = [];
  const abertas = new Map<string, Rodada[]>();
  for (const l of ev) {
    const ed = typeof l.edicao === 'string' && l.edicao ? l.edicao : null;
    if (l.fase === 'inicio') {
      const r: Rodada = { unidade: l.unidade, edicao: ed, inicio: l.t, fim: null, resultado: null, motivo: null, url: null, dur_s: null, presa: false, aberta_min: null };
      out.push(r);
      const k = l.unidade; abertas.set(k, [...(abertas.get(k) ?? []), r]);
      continue;
    }
    // fim (ou linha sem fase, tratada como fim): fecha a aberta da mesma edição, senão a mais recente.
    const lista = abertas.get(l.unidade) ?? [];
    let i = ed ? lista.findIndex((r) => r.edicao === ed) : -1;
    if (i < 0) i = lista.length - 1;
    let r: Rodada;
    if (i >= 0) { r = lista[i]; lista.splice(i, 1); } else {
      r = { unidade: l.unidade, edicao: ed, inicio: null, fim: null, resultado: null, motivo: null, url: null, dur_s: null, presa: false, aberta_min: null };
      out.push(r);
    }
    r.fim = l.t; r.resultado = typeof l.resultado === 'string' ? l.resultado : 'ok';
    r.motivo = l.motivo ? corta(l.motivo, 200) : null; r.url = typeof l.url === 'string' ? l.url : null;
    r.edicao = r.edicao ?? ed;
    r.dur_s = typeof l.dur_s === 'number' ? Math.round(l.dur_s) : (r.inicio !== null ? r.fim - r.inicio : null);
  }
  for (const r of out) {
    if (r.fim === null && r.inicio !== null) {
      r.aberta_min = Math.round((agora - r.inicio) / 60);
      r.presa = r.aberta_min > PRESA_MIN;
    }
  }
  return out;
}

/** Espera que falhou/parou só pede você se for recente (as antigas ficam só na lista). */
export const JANELA_ESPERA_S = 48 * 3600;
export interface Espera { chave: string; pasta: string; estado: string; desde: number | null; teto_h: number | null; msg: unknown; resultado: string | null; passou_teto: boolean; recente: boolean }

export function lerContinua(estado: Record<string, Record<string, unknown>> | null, agora: number): Espera[] {
  if (!estado || typeof estado !== 'object') return [];
  const out: Espera[] = [];
  for (const [chave, v] of Object.entries(estado)) {
    if (!v || typeof v !== 'object') continue;
    const st = String(v.estado ?? '');
    if (st === 'feito' || st === 'cancelado') continue;
    const desde = paraEpoch(v.desde);
    const teto = typeof v.teto_h === 'number' ? v.teto_h : null;
    const ultimo = paraEpoch(v.fim) ?? paraEpoch(v.inicio) ?? desde;
    out.push({
      recente: ultimo !== null && agora - ultimo < JANELA_ESPERA_S,
      chave, pasta: String(v.pasta ?? ''), estado: st || 'desconhecido', desde, teto_h: teto, msg: v.msg ?? null,
      resultado: v.resultado ? corta(v.resultado, 200) : null,
      passou_teto: st === 'esperando' && desde !== null && teto !== null && agora - desde > teto * 3600,
    });
  }
  return out.sort((a, b) => (b.desde ?? 0) - (a.desde ?? 0));
}

export async function proximosTimers(d: DepsPainel): Promise<{ unidade: string; proxima: number | null; ultima: number | null }[] | null> {
  let ignorar: RegExp | null = null;
  try { ignorar = d.cfg.producao.timers_ignorar ? new RegExp(d.cfg.producao.timers_ignorar) : null; } catch { ignorar = null; }
  return d.cache.obter('prod:timers', 60_000, async () => {
    const r = await d.exec('systemctl', ['--user', 'list-timers', '--no-pager', '--output=json'], 4000);
    try {
      const j = JSON.parse(r.stdout) as { next?: number; last?: number; unit?: string }[];
      return j.filter((t) => t.unit).map((t) => ({
        unidade: String(t.unit).replace(/\.timer$/, ''),
        proxima: t.next ? Math.round(t.next / 1e6) : null, ultima: t.last ? Math.round(t.last / 1e6) : null,
      })).filter((t) => !ignorar || !ignorar.test(t.unidade))
        .sort((a, b) => (a.proxima ?? Infinity) - (b.proxima ?? Infinity)).slice(0, 12);
    } catch { return null; }
  });
}

export interface DadosProducao { hoje: Rodada[]; presas: Rodada[]; falhas: Rodada[]; esperas: Espera[]; timers: { unidade: string; proxima: number | null; ultima: number | null }[] }

export async function coletarProducao(d: DepsPainel): Promise<Coleta<DadosProducao>> {
  const agora = d.agora();
  const ausentes: string[] = [];
  const c = d.cfg.producao;
  let hoje: Rodada[] = [], presas: Rodada[] = [], falhas: Rodada[] = [];
  if (c.rodadas) {
    const texto = lerFim(c.rodadas, 512 * 1024);
    if (texto === null) ausentes.push('rodadas.jsonl');
    else {
      const todas = montarRodadas(linhasJson<LinhaRodada>(texto), agora);
      const ini = inicioDoDia(agora);
      hoje = todas.filter((r) => (r.inicio ?? r.fim ?? 0) >= ini).reverse();
      presas = todas.filter((r) => r.presa && agora - (r.inicio ?? 0) < 2 * 86400);
      falhas = todas.filter((r) => r.resultado === 'falhou' && agora - (r.fim ?? 0) < 86400).reverse();
    }
  }
  let esperas: Espera[] = [];
  if (c.esperas) {
    const cont = lerJson<Record<string, Record<string, unknown>>>(c.esperas);
    if (cont === null) ausentes.push('arquivo de esperas');
    esperas = lerContinua(cont, agora);
  }
  let timers: DadosProducao['timers'] = [];
  if (c.timers) {
    const t = await proximosTimers(d);
    if (t === null) ausentes.push('timers do systemd');
    timers = t ?? [];
  }
  return { dados: { hoje: hoje.slice(0, 40), presas, falhas, esperas, timers }, ausentes, naoConfigurado: !c.rodadas && !c.esperas && !c.timers };
}
