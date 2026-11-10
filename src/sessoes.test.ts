// Sessões do Claude no painel: máscara de segredos, conversa legível e quem abriu a sessão.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { acharTranscript, lerConversa, lerOrigem, mascarar } from './fontes/sessoes.js';

describe('mascarar', () => {
  it('esconde chaves, tokens de bot e Bearer', () => {
    const s = mascarar('export ANTHROPIC_API_KEY=sk-ant-abcdefghijklmnopqrstuvwxyz bot 123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA Authorization: Bearer abc.def.ghijklmnop ghp_abcdefghijklmnopqrstuvwxyz senha=minhaSenha123');
    expect(s).not.toMatch(/sk-ant-abc|AAAAAAAAAAAA|abc\.def|ghp_abc|minhaSenha/);
    expect(s).toContain('[oculto]');
  });
});

describe('lerConversa', () => {
  it('vira mensagens: você, claude, ferramenta e resultado; ignora sub-agente e lembrete', () => {
    const L = (o: unknown) => JSON.stringify(o);
    const txt = [
      L({ type: 'user', timestamp: '2026-11-10T01:00:00Z', message: { content: 'faz o painel' } }),
      L({ type: 'user', message: { content: '<system-reminder>x</system-reminder>' } }),
      L({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'segredo' }, { type: 'text', text: 'Vou fazer.' }, { type: 'tool_use', name: 'Bash', input: { command: 'ls', description: 'Lista' } }] } }),
      L({ type: 'user', message: { content: [{ type: 'tool_result', content: 'a.txt' }] } }),
      L({ type: 'assistant', isSidechain: true, message: { content: [{ type: 'text', text: 'sub' }] } }),
      'lixo',
    ].join('\n');
    const m = lerConversa(txt);
    expect(m.map((x) => x.quem)).toEqual(['voce', 'claude', 'ferramenta', 'resultado']);
    expect(m[2].texto).toBe('Bash: Lista');
    expect(JSON.stringify(m)).not.toContain('segredo');
  });
});

describe('acharTranscript', () => {
  it('acha o JSONL pelo id e recusa id com barra', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'proj-'));
    mkdirSync(join(raiz, '-projetos-x'));
    writeFileSync(join(raiz, '-projetos-x', 'abcdef12-3456.jsonl'), '{}');
    expect(acharTranscript(raiz, 'abcdef12-3456')).toContain('abcdef12-3456.jsonl');
    expect(acharTranscript(raiz, '../etc/passwd')).toBeNull();
  });
});

describe('lerOrigem', () => {
  const proc = mkdtempSync(join(tmpdir(), 'proc-'));
  const p = (pid: number, ppid: number, cmd: string[], cg = '') => {
    mkdirSync(join(proc, String(pid)), { recursive: true });
    writeFileSync(join(proc, String(pid), 'stat'), `${pid} (x) S ${ppid} 0 0`);
    writeFileSync(join(proc, String(pid), 'cmdline'), cmd.join('\0') + '\0');
    if (cg) writeFileSync(join(proc, String(pid), 'cgroup'), cg);
  };
  // física: claude ← bash ← gnome-terminal
  p(100, 99, ['claude'], '0::/user.slice/app.slice/app-org.gnome.Terminal.slice/vte-spawn-1.scope\n');
  p(99, 50, ['bash']); p(50, 1, ['/usr/libexec/gnome-terminal-server']);
  // agente de timer
  p(200, 199, ['claude', '-p'], '0::/user.slice/user@1000.service/app.slice/robo-diario.service\n');
  p(199, 198, ['timeout', '10800', 'env', 'claude', '-p']); p(198, 1, ['bash', '/opt/robo/rodar.sh']);
  // sub-sessão de outra sessão do Claude
  p(300, 301, ['claude', '-p'], '0::/user.slice/app.slice/vte-spawn-2.scope\n');
  p(301, 1, ['claude', '--chrome']);

  it('você no terminal', () => {
    const o = lerOrigem(100, '/dev/pts/3', 'interativo', proc);
    expect(o.tipo).toBe('fisica');
    expect(o.quem).toContain('pts/3');
  });
  it('timer do systemd', () => {
    const o = lerOrigem(200, null, 'headless', proc);
    expect(o.tipo).toBe('agente');
    expect(o.quem).toBe('timer/serviço robo-diario');
    expect(o.cadeia.join(' ')).toContain('rodar.sh');
  });
  it('aberta por outra sessão do Claude', () => {
    const o = lerOrigem(300, null, 'headless', proc);
    expect(o.tipo).toBe('agente');
    expect(o.quem).toContain('outra sessão do Claude');
  });
});

describe('lerOrigem com nomes da config', () => {
  it('troca a unidade pelo nome amigável', () => {
    const proc = mkdtempSync(join(tmpdir(), 'proc-'));
    mkdirSync(join(proc, '400'));
    writeFileSync(join(proc, '400', 'stat'), '400 (x) S 1 0 0');
    writeFileSync(join(proc, '400', 'cgroup'), '0::/user.slice/user@1000.service/app.slice/bot-tarefas.service\n');
    expect(lerOrigem(400, null, 'headless', proc, { 'bot-tarefas.service': 'bot de tarefas' }).quem).toBe('bot de tarefas');
  });
});
