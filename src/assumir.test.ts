// Assumir: só com PAINEL_ASSUMIR=1 (deps.assumir), só teclas da lista, texto + Enter pelo tmux do painel.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { enviarAoPane, paneDaSessao } from './fontes/assumir.js';
import { depsTeste } from './teste-ajuda.test-util.js';
import type { Executor } from './util.js';

function deps(chamadas: string[][], assumir: boolean, bruto: Record<string, unknown> = {}) {
  const exec: Executor = async (c, a) => { chamadas.push([c, ...a]); return { ok: true, stdout: '', stderr: '', codigo: 0 }; };
  return depsTeste(bruto, { exec, assumir });
}

describe('assumir', () => {
  it('desligado sem PAINEL_ASSUMIR=1', async () => {
    const ch: string[][] = [];
    const r = await enviarAoPane(deps(ch, false), '%3', JSON.stringify({ texto: 'oi' }), 't', 'abcdefgh');
    expect(r.status).toBe(403);
    expect(ch).toEqual([]);
  });

  it('desligado no modo demonstração mesmo com a variável', async () => {
    const ch: string[][] = [];
    const d = deps(ch, true); d.demo = true;
    expect((await enviarAoPane(d, '%3', JSON.stringify({ texto: 'oi' }), 't', 'abcdefgh')).status).toBe(403);
    expect(ch).toEqual([]);
  });

  it('digita o texto literal e depois Enter no servidor tmux da config; recusa tecla fora da lista', async () => {
    const ch: string[][] = [];
    const d = deps(ch, true);
    expect((await enviarAoPane(d, '%3', JSON.stringify({ texto: 'rm -rf; echo $HOME' }), 't', 'abcdefgh')).status).toBe(200);
    expect(ch[0]).toEqual(['tmux', '-L', 'painel', 'send-keys', '-t', '%3', '-l', '--', 'rm -rf; echo $HOME']);
    expect(ch[1]).toEqual(['tmux', '-L', 'painel', 'send-keys', '-t', '%3', 'Enter']);
    expect((await enviarAoPane(d, '%3', JSON.stringify({ tecla: 'C-d' }), 't', 'abcdefgh')).status).toBe(400);
    expect((await enviarAoPane(d, '%3', JSON.stringify({ tecla: 'Escape' }), 't', 'abcdefgh')).status).toBe(200);
    const ch2: string[][] = [];
    await enviarAoPane(deps(ch2, true, { assumir: { tmux_servidor: 'meu-tmux' } }), '%1', JSON.stringify({ tecla: 'Up' }), 't', 'abcdefgh');
    expect(ch2[0].slice(0, 3)).toEqual(['tmux', '-L', 'meu-tmux']);
  });

  it('acha o pane pelo processo pai', () => {
    const proc = mkdtempSync(join(tmpdir(), 'proc-'));
    const p = (pid: number, ppid: number) => { mkdirSync(join(proc, String(pid))); writeFileSync(join(proc, String(pid), 'stat'), `${pid} (x) S ${ppid} 0`); };
    p(500, 400); p(400, 300); p(300, 1);
    expect(paneDaSessao(500, [{ pane: '%7', pid: 400 }], proc)).toBe('%7');
    expect(paneDaSessao(500, [{ pane: '%7', pid: 999 }], proc)).toBeNull();
  });
});
