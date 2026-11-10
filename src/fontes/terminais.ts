// Terminais: sessões do Claude Code nesta máquina. Por padrão lê os registros
// que o próprio Claude Code grava em ~/.claude/sessions/<pid>.json (só os
// arquivos `<número>.json`; nada mais da pasta é lido). Registro com processo
// vivo = sessão aberta; com processo morto = interrompida (o Claude saiu sem
// limpar). Alternativa: `terminais.comando` na config, um comando seu que
// imprima JSON (lista de {session_id, pid, cwd, inicio, tipo, tty}) — com
// `--interrompidos` deve listar as interrompidas.
// Mais as pendências do topo do seu arquivo de notas (opcional).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Coleta, DepsPainel } from '../tipos.js';
import { corta, lerJson, lerTexto, paraEpoch } from '../util.js';
import { paneDaSessao, panesTmux } from './assumir.js';
import { detalharSessoes, type InfoSessao } from './sessoes.js';

export interface Terminal { session_id: string; pid: number | null; cwd: string; projeto: string; inicio: number | null; tipo: string; tty: string | null }

export function lerTerminais(saida: string): Terminal[] | null {
  let j: unknown;
  try { j = JSON.parse(saida); } catch { return null; }
  const lista = Array.isArray(j) ? j : (j && typeof j === 'object' ? ((j as { sessoes?: unknown[] }).sessoes ?? (j as { terminais?: unknown[] }).terminais ?? (j as { interrompidos?: unknown[] }).interrompidos) : null);
  if (!Array.isArray(lista)) return null;
  return (lista as Record<string, unknown>[]).filter((t) => t && typeof t === 'object').map(normalizarTerminal);
}

function normalizarTerminal(t: Record<string, unknown>): Terminal {
  const cwd = String(t.cwd ?? '');
  return {
    session_id: String(t.session_id ?? t.sessionId ?? t.sessao ?? t.id ?? ''),
    pid: typeof t.pid === 'number' ? t.pid : null,
    cwd, projeto: String(t.projeto ?? (cwd.split('/').filter(Boolean).pop() || '?')),
    inicio: paraEpoch(t.inicio ?? t.desde ?? t.started_at ?? t.startedAt),
    tipo: String(t.tipo ?? (t.kind === 'interactive' || t.entrypoint === 'cli' ? 'interativo' : t.kind || t.entrypoint ? 'headless' : 'terminal')),
    tty: typeof t.tty === 'string' ? t.tty : null,
  };
}

/** Processo vivo E é um claude (pid reaproveitado depois de reboot não conta). */
export function pidVivo(pid: number | null, raiz = '/proc'): boolean {
  if (!pid || pid < 2) return false;
  try { return readFileSync(join(raiz, String(pid), 'cmdline'), 'utf8').includes('claude'); } catch { return false; }
}

function ttyDo(pid: number, raiz = '/proc'): string | null {
  try {
    const st = readFileSync(join(raiz, String(pid), 'stat'), 'utf8');
    const nr = Number(st.slice(st.lastIndexOf(')') + 2).split(' ')[4]);
    if (!nr) return null;
    const maior = (nr >> 8) & 0xfff, menor = (nr & 0xff) | ((nr >> 12) & 0xfff00);
    return maior === 136 ? `/dev/pts/${menor}` : null;
  } catch { return null; }
}

/** Registros nativos do Claude Code: só `<pid>.json`. */
export function lerSessoesNativas(dir: string, raiz = '/proc'): { vivos: Terminal[]; interrompidos: Terminal[] } | null {
  let nomes: string[];
  try { nomes = readdirSync(dir).filter((n) => /^\d+\.json$/.test(n)); } catch { return null; }
  const vivos: Terminal[] = [], interrompidos: Terminal[] = [];
  for (const n of nomes) {
    const r = lerJson<Record<string, unknown>>(join(dir, n));
    if (!r || typeof r !== 'object') continue;
    // Só os campos de que o painel precisa (o resto do registro nunca sai daqui).
    const t = normalizarTerminal({ sessionId: r.sessionId, pid: r.pid, cwd: r.cwd, startedAt: r.startedAt, kind: r.kind, entrypoint: r.entrypoint });
    if (!t.session_id) continue;
    if (pidVivo(t.pid, raiz)) vivos.push({ ...t, tty: t.pid ? ttyDo(t.pid, raiz) : null });
    else interrompidos.push(t);
  }
  const ord = (a: Terminal, b: Terminal) => (a.inicio ?? 0) - (b.inicio ?? 0);
  return { vivos: vivos.sort(ord), interrompidos: interrompidos.sort(ord) };
}

export async function coletarTerminais(d: DepsPainel): Promise<Coleta<{ assumir: boolean; tmux_servidor: string; vivos: (Terminal & Partial<InfoSessao> & { tmux: string | null })[]; interrompidos: (Terminal & Partial<InfoSessao> & { tmux: null })[] }>> {
  const c = d.cfg.terminais;
  const ausentes: string[] = [];
  let vivos: Terminal[] | null = null, interrompidos: Terminal[] | null = null;
  const cmd = c.comando;
  if (cmd) {
    vivos = await d.cache.obter('term:vivos', 20_000, async () => {
      const r = await d.exec(cmd, ['--json'], 5000);
      return r.stdout.trim() ? lerTerminais(r.stdout) : null;
    });
    interrompidos = await d.cache.obter('term:interr', 60_000, async () => {
      const r = await d.exec(cmd, ['--interrompidos', '--json'], 5000);
      return r.stdout.trim() ? lerTerminais(r.stdout) : null;
    });
  } else if (c.sessoes_claude) {
    const dir = c.sessoes_claude;
    const n = await d.cache.obter('term:nativo', 10_000, () => lerSessoesNativas(dir));
    vivos = n?.vivos ?? null; interrompidos = n?.interrompidos ?? null;
  }
  const naoConfigurado = !cmd && !c.sessoes_claude;
  if (!naoConfigurado && vivos === null) ausentes.push('sessões do Claude Code');
  const info: Record<string, InfoSessao> = await d.cache.obter('term:info', 20_000, async () => ({
    ...(await detalharSessoes(d, vivos ?? [], true)),
    ...(await detalharSessoes(d, interrompidos ?? [], false)),
  }));
  const panes = d.assumir ? await d.cache.obter('term:panes', 5_000, () => panesTmux(d)) : [];
  return {
    dados: {
      assumir: !!d.assumir, tmux_servidor: d.cfg.assumir.tmux_servidor,
      vivos: (vivos ?? []).map((t) => ({ ...t, ...(info[t.session_id] ?? {}), tmux: paneDaSessao(t.pid, panes) })),
      interrompidos: (interrompidos ?? []).map((t) => ({ ...t, ...(info[t.session_id] ?? {}), tmux: null })),
    },
    ausentes, naoConfigurado,
  };
}

/** Itens do topo do arquivo de pendências: cada `- **título**` ou `### título` antes de "## Resolvidas". */
export function lerPendencias(texto: string | null, max = 8): { titulo: string }[] | null {
  if (texto === null) return null;
  const out: { titulo: string }[] = [];
  for (const l of texto.split('\n')) {
    if (/^##\s+Resolvidas/i.test(l)) break;
    let m = /^- \*\*(.+?)\*\*/.exec(l);
    if (!m) m = /^###\s+(.+)/.exec(l);
    if (!m) continue;
    // "07/11/2026 — assunto" vira "07/11 · assunto" (o ano come espaço na TV).
    const t = m[1].replace(/\*\*/g, '').trim().replace(/^(\d{2}\/\d{2})\/\d{4}\s*[—·-]\s*/, '$1 · ');
    out.push({ titulo: corta(t, 140) });
    if (out.length >= max) break;
  }
  return out;
}

export function coletarPendencias(d: DepsPainel): { titulo: string }[] | null {
  return d.cfg.pendencias ? lerPendencias(lerTexto(d.cfg.pendencias)) : [];
}
