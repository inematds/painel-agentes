// Assumir uma sessão do Claude pelo painel: só sessões abertas dentro do servidor
// tmux do painel (`tmux -L <tmux_servidor>`, padrão "painel"). Ver a tela =
// `tmux capture-pane`; digitar = `tmux send-keys`. Liga só com PAINEL_ASSUMIR=1;
// a sessão de login + CSRF autenticam. Cada envio vai para <pasta_dados>/assumir.log
// (só o início do texto, mascarado; nunca inteiro).
import { appendFileSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import type { DepsPainel } from '../tipos.js';
import { mascarar, SID } from './sessoes.js';

const TECLAS = new Set(['Enter', 'Escape', 'C-c', 'Up', 'Down', 'Tab', 'BTab']);

export const servidorTmux = (d: DepsPainel) => ['-L', d.cfg.assumir.tmux_servidor];

export interface Pane { pane: string; pid: number }

export async function panesTmux(d: DepsPainel): Promise<Pane[]> {
  const r = await d.exec('tmux', [...servidorTmux(d), 'list-panes', '-a', '-F', '#{pane_id} #{pane_pid}'], 2000);
  if (!r.ok) return [];
  return r.stdout.split('\n').map((l) => l.trim().split(' ')).filter((c) => /^%\d+$/.test(c[0] ?? '') && Number(c[1]) > 0).map((c) => ({ pane: c[0], pid: Number(c[1]) }));
}

/** O pane cujo processo é o claude ou um dos pais dele (tmux → shell → claude). */
export function paneDaSessao(pid: number | null, panes: Pane[], raiz = '/proc'): string | null {
  if (!pid || !panes.length) return null;
  const alvo = new Map(panes.map((p) => [p.pid, p.pane]));
  let p = pid;
  for (let i = 0; i < 6 && p > 1; i++) {
    const achou = alvo.get(p);
    if (achou) return achou;
    try {
      const st = readFileSync(join(raiz, String(p), 'stat'), 'utf8');
      p = Number(st.slice(st.lastIndexOf(')') + 2).split(' ')[1]);
    } catch { return null; }
  }
  return null;
}

export type Resposta = { status: number; corpo: Record<string, unknown> };

/** Tela atual do pane (últimas linhas), com segredos mascarados. */
export async function telaDoPane(d: DepsPainel, pane: string): Promise<Resposta> {
  if (!/^%\d+$/.test(pane)) return { status: 400, corpo: { erro: 'pane inválido' } };
  const r = await d.exec('tmux', [...servidorTmux(d), 'capture-pane', '-p', '-J', '-t', pane, '-S', '-120'], 3000);
  if (!r.ok) return { status: 410, corpo: { erro: 'a sessão do tmux não respondeu (fechou?)' } };
  return { status: 200, corpo: { tela: mascarar(r.stdout.replace(/\s+$/, '')) } };
}

/** Envia texto e/ou uma tecla para o pane da sessão. */
export async function enviarAoPane(d: DepsPainel, pane: string, corpoBruto: string, quem: string, sid: string): Promise<Resposta> {
  if (d.demo) return { status: 403, corpo: { erro: 'modo demonstração: nada é digitado' } };
  if (!d.assumir) return { status: 403, corpo: { erro: 'Assumir está desligado (inicie o painel com PAINEL_ASSUMIR=1)' } };
  let b: { texto?: unknown; tecla?: unknown; enter?: unknown };
  try { b = JSON.parse(corpoBruto || '{}') as typeof b; } catch { return { status: 400, corpo: { erro: 'JSON inválido' } }; }
  const texto = typeof b.texto === 'string' ? b.texto : '';
  const tecla = typeof b.tecla === 'string' ? b.tecla : '';
  if (texto.length > 4000) return { status: 413, corpo: { erro: 'texto grande demais (máx. 4000)' } };
  if (tecla && !TECLAS.has(tecla)) return { status: 400, corpo: { erro: 'tecla não permitida' } };
  if (!texto && !tecla) return { status: 400, corpo: { erro: 'nada para enviar' } };
  if (texto) {
    const r = await d.exec('tmux', [...servidorTmux(d), 'send-keys', '-t', pane, '-l', '--', texto], 3000);
    if (!r.ok) return { status: 410, corpo: { erro: 'não consegui digitar na sessão (fechou?)' } };
  }
  const teclaFinal = tecla || (b.enter === false || !texto ? '' : 'Enter');
  if (teclaFinal) {
    if (texto) await new Promise((r) => setTimeout(r, 150));
    await d.exec('tmux', [...servidorTmux(d), 'send-keys', '-t', pane, teclaFinal], 3000);
  }
  try {
    const log = join(d.cfg.pasta_dados, 'assumir.log');
    mkdirSync(dirname(log), { recursive: true, mode: 0o700 });
    appendFileSync(log, JSON.stringify({ em: new Date().toISOString(), quem, sessao: sid, pane, tecla: teclaFinal || null, chars: texto.length, inicio: mascarar(texto.slice(0, 60)) }) + '\n', { mode: 0o600 });
  } catch { /* log é extra */ }
  return { status: 200, corpo: { ok: true } };
}

/** Acha o pane de uma sessão viva pelo id (dados do painel). */
export function paneDoId(vivos: { session_id: string; tmux?: string | null }[], id: string): string | null {
  if (!SID.test(id)) return null;
  return vivos.find((s) => s.session_id === id)?.tmux ?? null;
}

/** Abre uma sessão NOVA (o `lancador` da config, padrão `claude`) no tmux do painel, numa pasta
 * dentro de `novo_terminal.raiz` (padrão ~/projetos). Mesmas travas do Assumir (PAINEL_ASSUMIR=1, CSRF). */
export async function novoTerminal(d: DepsPainel, corpoBruto: string, quem: string): Promise<Resposta> {
  if (d.demo) return { status: 403, corpo: { erro: 'modo demonstração: nada é aberto' } };
  if (!d.assumir) return { status: 403, corpo: { erro: 'Assumir desligado (inicie o painel com PAINEL_ASSUMIR=1)' } };
  let pasta = '';
  try { pasta = String((JSON.parse(corpoBruto || '{}') as { pasta?: unknown }).pasta ?? '').trim(); } catch { return { status: 400, corpo: { erro: 'JSON inválido' } }; }
  let raiz = '';
  try { raiz = realpathSync(d.cfg.novo_terminal.raiz); } catch { return { status: 503, corpo: { erro: 'a pasta raiz de novo_terminal não existe' } }; }
  let real = '';
  try { real = realpathSync(pasta.startsWith('/') ? pasta : join(raiz, pasta)); } catch { return { status: 404, corpo: { erro: 'pasta não existe' } }; }
  if (!(real === raiz || real.startsWith(raiz + '/')) || !statSync(real).isDirectory()) return { status: 400, corpo: { erro: 'só pastas dentro da raiz configurada' } };
  const nome = `painel-${basename(real).replace(/[^\w-]/g, '').slice(0, 30) || 'raiz'}-${Date.now() % 100000}`;
  const r = await d.exec('tmux', [...servidorTmux(d), 'new-session', '-d', '-s', nome, '-c', real, d.cfg.novo_terminal.lancador], 8000);
  if (!r.ok) return { status: 500, corpo: { erro: `tmux falhou: ${(r.stderr || r.erro || '').slice(0, 200)}` } };
  try {
    const log = join(d.cfg.pasta_dados, 'assumir.log');
    mkdirSync(dirname(log), { recursive: true, mode: 0o700 });
    appendFileSync(log, JSON.stringify({ em: new Date().toISOString(), quem, novo: nome, pasta: real }) + '\n', { mode: 0o600 });
  } catch { /* log é extra */ }
  return { status: 200, corpo: { ok: true, nome, pasta: real, aviso: 'a sessão aparece em Terminais em alguns segundos' } };
}
