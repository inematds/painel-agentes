// Detalhe das sessões do Claude Code: junta o retrato que uma statusline sua pode
// gravar (opcional: <retratos>/<id>.json com modelo, esforço, contexto, custo,
// linhas, projeto ativo), o processo (ps) e o transcript JSONL em
// ~/.claude/projects (última atividade, último pedido/resposta). Também lê a
// conversa para a tela "só leitura". Só lê arquivos; segredos óbvios são
// mascarados antes de sair.
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { DepsPainel } from '../tipos.js';
import { corta, lerFim, lerJson } from '../util.js';

export const SID = /^[A-Za-z0-9-]{8,64}$/;

export interface Retrato {
  em?: number; nome?: string | null; ativo?: string | null; modelo?: string; modelo_id?: string; esforco?: string | null; rapido?: boolean;
  ctx_pct?: number; ctx_tokens?: number; ctx_janela?: number; custo_usd?: number; dur_ms?: number; api_ms?: number;
  linhas_mais?: number; linhas_menos?: number; versao?: string;
}

export interface Processo { cpu: number; mem_mb: number; rodando_s: number }

export interface InfoSessao {
  origem: Origem;
  /** 'cli' = aberta à mão; 'sdk-cli' = claude -p (script/agente). */
  entrada: string | null;
  retrato: Retrato | null;
  processo: Processo | null;
  transcript: { ultima_atividade: number; tamanho_mb: number; ultimo_pedido: string | null; ultima_resposta: string | null; modelo: string | null } | null;
}

/** Mascara chaves e tokens que aparecem em comandos e saídas. */
export function mascarar(s: string): string {
  return s
    .replace(/\b(sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|\d{8,10}:[A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, '[oculto]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{10,}/g, '$1[oculto]')
    .replace(/((?:api[_-]?key|access[_-]?token|token|secret|senha|password|passwd)["']?\s*[:=]\s*["']?)[^\s"',;]{6,}/gi, '$1[oculto]');
}

/** Acha o JSONL da sessão em ~/.claude/projects/<pasta>/<id>.jsonl. */
export function acharTranscript(raiz: string | null, sid: string): string | null {
  if (!raiz || !SID.test(sid)) return null;
  let pastas: string[];
  try { pastas = readdirSync(raiz); } catch { return null; }
  for (const p of pastas) {
    const f = join(raiz, p, `${sid}.jsonl`);
    if (existsSync(f)) return f;
  }
  return null;
}

type Bloco = { type?: string; text?: string; name?: string; input?: Record<string, unknown>; content?: unknown };
type Linha = { type?: string; timestamp?: string; isSidechain?: boolean; isMeta?: boolean; message?: { role?: string; model?: string; content?: string | Bloco[] } };

export interface Mensagem { quando: number | null; quem: 'voce' | 'claude' | 'ferramenta' | 'resultado'; texto: string }

function textoResultado(c: unknown): string {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((b) => (b && typeof b === 'object' && typeof (b as Bloco).text === 'string' ? (b as Bloco).text : '')).join(' ');
  return '';
}

function resumoFerramenta(b: Bloco): string {
  const i = b.input ?? {};
  const alvo = i.description ?? i.command ?? i.file_path ?? i.pattern ?? i.url ?? i.prompt ?? i.query ?? i.skill;
  return `${b.name ?? 'ferramenta'}${alvo ? ': ' + String(alvo) : ''}`;
}

/** Converte linhas do JSONL em mensagens legíveis (sem pensamento, sem sub-agentes). */
export function lerConversa(texto: string, max = 80, cortaEm = 1200): Mensagem[] {
  const out: Mensagem[] = [];
  for (const l of texto.split('\n')) {
    if (!l.trim()) continue;
    let j: Linha;
    try { j = JSON.parse(l) as Linha; } catch { continue; }
    const quando = j.timestamp ? Math.floor(Date.parse(j.timestamp) / 1000) || null : null;
    // Mensagem que você manda no meio do trabalho chega como fila ("enqueue").
    const q = j as Linha & { operation?: string; content?: unknown };
    if (j.type === 'queue-operation' && q.operation === 'enqueue' && typeof q.content === 'string' && q.content.trim()) {
      out.push({ quando, quem: 'voce', texto: corta(mascarar(q.content.trim()), cortaEm) }); continue;
    }
    if (j.isSidechain || j.isMeta || (j.type !== 'user' && j.type !== 'assistant') || !j.message) continue;
    const c = j.message.content;
    const add = (quem: Mensagem['quem'], t: string) => { const s = t.trim(); if (s) out.push({ quando, quem, texto: corta(mascarar(s), cortaEm) }); };
    if (typeof c === 'string') { if (j.type === 'user' && !c.startsWith('<')) add('voce', c); continue; }
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (!b || typeof b !== 'object') continue;
      if (b.type === 'text' && typeof b.text === 'string') {
        if (j.type === 'assistant') add('claude', b.text);
        else if (!b.text.startsWith('<')) add('voce', b.text);
      } else if (b.type === 'tool_use') add('ferramenta', resumoFerramenta(b));
      else if (b.type === 'tool_result') add('resultado', corta(textoResultado(b.content), 400));
    }
  }
  return out.slice(-max);
}

function ultimoModelo(texto: string): string | null {
  const ls = texto.split('\n');
  for (let i = ls.length - 1; i >= 0; i--) {
    const m = /"model":"([^"]+)"/.exec(ls[i]);
    if (m && m[1] !== '<synthetic>') return m[1];
  }
  return null;
}

/** `entrypoint` da 1ª linha que tiver: cli (à mão) ou sdk-cli (claude -p). */
export function lerEntrada(arq: string): string | null {
  try {
    const ini = lerInicio(arq);
    return /"entrypoint":"([^"]+)"/.exec(ini)?.[1] ?? null;
  } catch { return null; }
}
function lerInicio(arq: string): string { const b = Buffer.alloc(65536); const fd = openSync(arq, 'r'); try { const n = readSync(fd, b, 0, b.length, 0); return b.subarray(0, n).toString('utf8'); } finally { closeSync(fd); } }

export function infoTranscript(arq: string) {
  let st;
  try { st = statSync(arq); } catch { return null; }
  const cauda = lerFim(arq, 400_000) ?? '';
  const conv = lerConversa(cauda, 400, 300);
  const pedido = [...conv].reverse().find((m) => m.quem === 'voce');
  const resposta = [...conv].reverse().find((m) => m.quem === 'claude');
  return {
    ultima_atividade: Math.floor(st.mtimeMs / 1000), tamanho_mb: Math.round(st.size / 1e5) / 10,
    ultimo_pedido: pedido ? corta(pedido.texto, 220) : null, ultima_resposta: resposta ? corta(resposta.texto, 220) : null,
    modelo: ultimoModelo(cauda),
  };
}

/** `ps` de vários pids de uma vez: cpu %, memória e tempo rodando. */
export async function lerProcessos(d: DepsPainel, pids: number[]): Promise<Record<number, Processo>> {
  const ok = pids.filter((p) => Number.isInteger(p) && p > 0);
  if (!ok.length) return {};
  const r = await d.exec('ps', ['-o', 'pid=,pcpu=,rss=,etimes=', '-p', ok.join(',')], 3000);
  const out: Record<number, Processo> = {};
  for (const l of r.stdout.split('\n')) {
    const c = l.trim().split(/\s+/).map(Number);
    if (c.length === 4 && c.every((x) => !isNaN(x))) out[c[0]] = { cpu: c[1], mem_mb: Math.round(c[2] / 1024), rodando_s: c[3] };
  }
  return out;
}

export interface Origem {
  /** 'fisica' = você num terminal; 'agente' = aberta por serviço, timer, bot ou outra sessão. */
  tipo: 'fisica' | 'agente' | 'desconhecida';
  /** Quem abriu/controla, em português: "você no terminal (pts/3)", "timer robo-diario", "bot de tarefas"… */
  quem: string;
  unidade: string | null;
  /** Processos pais, do mais perto ao mais longe (comando curto). */
  cadeia: string[];
}

function lerProc(raiz: string, pid: number, arq: string): string | null {
  try { return readFileSync(join(raiz, String(pid), arq), 'utf8'); } catch { return null; }
}

function cmdCurto(bruto: string | null): string {
  if (!bruto) return '?';
  const a = bruto.split('\0').filter(Boolean);
  if (!a.length) return '?';
  const base = (s: string) => s.split('/').pop() ?? s;
  let i = 0;
  while (i < a.length - 1 && /^(timeout|env|nice|ionice|systemd-run|flock|setsid|stdbuf|bash|sh|node|python3?|-.*|\d+)$/.test(base(a[i])) && !/\.(sh|py|mjs|js)$/.test(a[i])) i++;
  const r = [base(a[i]), ...a.slice(i + 1, i + 3).map((x) => (x.length > 40 ? x.slice(0, 40) + '…' : x))].join(' ').replace(/\s+/g, ' ');
  return corta(r, 90);
}

/** Descobre quem abriu a sessão: unidade do systemd (cgroup) + processos pais. */
export function lerOrigem(pid: number | null, tty: string | null, tipoReg: string, raiz = '/proc', unidades: Record<string, string> = {}): Origem {
  if (!pid) return { tipo: 'desconhecida', quem: tty ? 'terminal' : 'sem processo', unidade: null, cadeia: [] };
  const cg = (lerProc(raiz, pid, 'cgroup') ?? '').trim().split('\n').pop() ?? '';
  const unidade = /([\w@.-]+\.service)$/.exec(cg)?.[1] ?? null;
  const cadeia: string[] = [];
  let p = pid, viaClaude: number | null = null, viaSsh = false, viaCodex = false;
  for (let i = 0; i < 10; i++) {
    const st = lerProc(raiz, p, 'stat');
    const pp = st ? Number(st.slice(st.lastIndexOf(')') + 2).split(' ')[1]) : 0;
    if (!pp || pp <= 1) break;
    const c = lerProc(raiz, pp, 'cmdline');
    const curto = cmdCurto(c);
    if (/^(systemd|gnome-terminal-server|init)\b/.test(curto)) break;
    cadeia.push(curto);
    if (c && /(^|\/)claude(\0|$)/.test(c.split('\0').slice(0, 3).join('\0')) && viaClaude === null) viaClaude = pp;
    if (/^sshd/.test(curto)) viaSsh = true;
    if (/(^|\/)codex\b/.test(c ?? '')) viaCodex = true;
    p = pp;
  }
  const terminal = /vte-spawn|gnome-terminal|konsole|tmux|session-\d+\.scope/.test(cg);
  if (viaClaude) return { tipo: 'agente', quem: `outra sessão do Claude (processo ${viaClaude})`, unidade, cadeia };
  if (viaCodex) return { tipo: 'agente', quem: 'Codex', unidade, cadeia };
  if (unidade && !/^(user@|vte-spawn)/.test(unidade)) {
    const nome = unidades[unidade] ?? `timer/serviço ${unidade.replace(/\.service$/, '')}`;
    return { tipo: 'agente', quem: nome, unidade, cadeia };
  }
  if (tty && (terminal || viaSsh || tipoReg === 'interativo')) return { tipo: 'fisica', quem: `você no terminal${viaSsh ? ' (SSH)' : ''} (${tty.replace('/dev/', '')})`, unidade, cadeia };
  if (tipoReg === 'headless') return { tipo: 'agente', quem: cadeia[0] ? `script ${cadeia[0]}` : 'claude -p sem pai conhecido', unidade, cadeia };
  return { tipo: 'desconhecida', quem: cadeia[0] ?? '?', unidade, cadeia };
}

export function lerRetrato(dir: string | null, sid: string): Retrato | null {
  if (!dir || !SID.test(sid)) return null;
  return lerJson<Retrato>(join(dir, `${sid}.json`));
}

/** Info completa de uma lista de sessões (retrato + processo + transcript). */
export async function detalharSessoes(d: DepsPainel, sessoes: { session_id: string; pid: number | null; tty: string | null; tipo: string }[], comProcesso: boolean): Promise<Record<string, InfoSessao>> {
  const procs = comProcesso ? await lerProcessos(d, sessoes.map((s) => s.pid ?? 0)) : {};
  const out: Record<string, InfoSessao> = {};
  for (const s of sessoes) {
    if (!SID.test(s.session_id)) continue;
    const arq = acharTranscript(d.cfg.terminais.projetos_claude, s.session_id);
    out[s.session_id] = {
      origem: comProcesso ? lerOrigem(s.pid, s.tty, s.tipo, '/proc', d.cfg.terminais.unidades) : { tipo: s.tipo === 'interativo' ? 'fisica' : 'agente', quem: s.tipo === 'interativo' ? 'terminal (processo já fechado)' : 'agente (processo já fechado)', unidade: null, cadeia: [] },
      entrada: arq ? lerEntrada(arq) : null,
      retrato: lerRetrato(d.cfg.terminais.retratos, s.session_id),
      processo: s.pid != null ? procs[s.pid] ?? null : null,
      transcript: arq ? infoTranscript(arq) : null,
    };
  }
  return out;
}
