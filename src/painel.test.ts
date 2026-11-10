import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { montarPainel } from './agregador.js';
import { avaliarAlertas, type GruposColetados } from './alertas.js';
import { normalizarConfig } from './config.js';
import { Conversa } from './conversa.js';
import { painelDemo } from './demo.js';
import { novoTerminal } from './fontes/assumir.js';
import { abrirSomenteLeitura, falhaCompleta, fecharBancos, lerBot } from './fontes/bots.js';
import { extrairRateLimits, lerAvisos } from './fontes/creditos.js';
import { lerBoots, lerMeminfo } from './fontes/maquina.js';
import { montarRodadas } from './fontes/producao.js';
import { lerHistorico } from './fontes/publicacao.js';
import { lerPendencias, lerSessoesNativas } from './fontes/terminais.js';
import { montarClasses, mudarVagas } from './fontes/vagas.js';
import { paginaPainel, PAINEL_JS } from './tela/pagina.js';
import { abrirDemo, depsTeste } from './teste-ajuda.test-util.js';
import type { Executor } from './util.js';

const AGORA = Math.floor(new Date('2026-11-09T20:00:00').getTime() / 1000);
const GRUPOS = ['bots', 'creditos', 'esperando', 'maquina', 'producao', 'publicacao', 'sites', 'terminais', 'vagas'];
let temSqlite = true;
try { createRequire(import.meta.url)('better-sqlite3'); } catch { temSqlite = false; }

afterAll(() => fecharBancos());

describe('config', () => {
  it('vazia não quebra: tudo opcional, padrões seguros', () => {
    const c = normalizarConfig({}, '/casa');
    expect(c.porta).toBe(3143);
    expect(c.bind).toBe('127.0.0.1');
    expect(c.nome_falado).toBe('você');
    expect(c.assumir.tmux_servidor).toBe('painel');
    expect(c.novo_terminal).toEqual({ raiz: '/casa/projetos', lancador: 'claude' });
    expect(c.chat.bot_url).toBeNull();
    expect(c.bots).toEqual([]);
    expect(c.terminais.sessoes_claude).toBe('/casa/.claude/sessions');
  });
  it('lixo na config é ignorado; ~ expande; tabela e tmux inseguros caem no padrão', () => {
    const c = normalizarConfig({ bots: [{ nome: 'a', banco: '~/a.db', tabela: 'jobs; DROP' }, { nome: 'sem-banco' }], sites: ['ftp://x', 'https://ok.exemplo.com', 3], assumir: { tmux_servidor: 'a b;c' }, publicacao: { filas: [{ arquivo: '~/f.txt', formato: 'txt' }, { nome: 'sem arquivo' }] }, chat: { bot: { url: 'javascript:x' } } }, '/casa');
    expect(c.bots).toEqual([{ nome: 'a', banco: '/casa/a.db', tabela: 'jobs' }]);
    expect(c.sites).toEqual(['https://ok.exemplo.com']);
    expect(c.assumir.tmux_servidor).toBe('painel');
    expect(c.publicacao.filas).toEqual([{ chave: 'fila1', nome: 'Fila 1', arquivo: '/casa/f.txt', formato: 'txt', quem: '–' }]);
    expect(c.chat.bot_url).toBeNull();
    expect(normalizarConfig({ terminais: { sessoes_claude: null } }).terminais.sessoes_claude).toBeNull();
  });
});

describe('agregador', () => {
  it('config vazia: os 9 grupos respondem, os opcionais ficam "não configurado" e nada vira alerta', async () => {
    const d = depsTeste({ terminais: { sessoes_claude: null }, creditos: { sessoes_codex: null, avisos: null } }, { agora: () => AGORA });
    const p = await montarPainel(d);
    expect(Object.keys(p.grupos).sort()).toEqual(GRUPOS);
    for (const g of Object.values(p.grupos)) { expect(g.ok).toBe(true); expect(typeof g.gerado_em).toBe('number'); }
    for (const n of ['bots', 'producao', 'publicacao', 'creditos', 'sites', 'vagas', 'terminais'] as const) expect(p.grupos[n].nao_configurado, n).toBe(true);
    expect(p.grupos.maquina.nao_configurado).toBeUndefined();
    expect(p.alertas.filter((a) => a.grupo !== 'maquina')).toEqual([]);
    expect(p.tela).toMatchObject({ nome_falado: 'você', demo: false, chat: { bot: false, novo_terminal: false } });
    expect(p.grupos.vagas.dados?.pode_mudar).toBe(false);
  });
  it('fontes configuradas mas ausentes: "sem dados", nunca erro nem alerta', async () => {
    const d = depsTeste({ producao: { rodadas: '~/r.jsonl', esperas: '~/e.json', timers: false }, bots: [{ nome: 'robo', banco: '~/nao.db' }], vagas: { arquivo: '~/v.json' }, publicacao: { historico: '~/h.jsonl' } }, { agora: () => AGORA });
    const p = await montarPainel(d);
    expect(p.grupos.producao.ausentes).toEqual(['rodadas.jsonl', 'arquivo de esperas']);
    expect(p.grupos.bots.ausentes?.[0]).toMatch(/robo/);
    expect(p.grupos.vagas.ausentes).toContain('arquivo de vagas');
    expect(p.grupos.publicacao.ausentes).toContain('histórico de envios');
    expect(p.alertas.filter((a) => a.grupo !== 'maquina')).toEqual([]);
  });
});

describe('modo demonstração', () => {
  it('todos os 9 grupos com dados inventados, sem "não configurado" e com alertas para mostrar', () => {
    const p = painelDemo(AGORA, 't', normalizarConfig({}));
    expect(Object.keys(p.grupos).sort()).toEqual(GRUPOS);
    for (const [n, g] of Object.entries(p.grupos)) { expect(g.ok, n).toBe(true); expect(g.nao_configurado, n).toBeUndefined(); expect(g.dados, n).toBeTruthy(); }
    const t = p.grupos.terminais.dados!;
    expect(t.vivos.length).toBeGreaterThanOrEqual(5);
    expect(t.vivos.length).toBeLessThanOrEqual(7);
    expect(t.vivos.some((s) => s.origem?.tipo === 'fisica')).toBe(true);
    expect(t.vivos.some((s) => s.origem?.tipo === 'agente')).toBe(true);
    const estados = new Set(p.grupos.publicacao.dados!.filas_itens.flatMap((f) => f.itens.map((i) => i.estado)));
    for (const e of ['pendente', 'publicando', 'feito', 'erro', 'retirado']) expect(estados.has(e as never), e).toBe(true);
    expect(p.alertas.length).toBeGreaterThan(3);
    expect(p.grupos.esperando.dados!.itens.length).toBeGreaterThan(3);
    expect(p.tela.demo).toBe(true);
    expect(JSON.stringify(p)).not.toMatch(/\/home\//);
  });
  it('servidor: sem login, leitura 200, toda escrita 403', async () => {
    const { base, fechar } = await abrirDemo();
    try {
      const j = await (await fetch(`${base}/api/painel`)).json() as { sessao: { via: string }; tela: { demo: boolean } };
      expect(j.sessao.via).toBe('demo');
      for (const r of ['/painel', '/jarvis', '/api/painel/bots', '/api/painel/chat', '/api/painel/terminal?id=0de30000-0000-4000-8000-000000000001', '/api/painel/terminal/tela?id=0de30000-0000-4000-8000-000000000001', '/api/painel/falha?bot=bot-atendimento&id=4821']) expect((await fetch(base + r)).status, r).toBe(200);
      for (const r of ['/api/vagas', '/api/painel/terminal/enviar', '/api/painel/terminal/novo', '/api/painel/chat', '/logout']) {
        expect((await fetch(base + r, { method: 'POST', headers: { 'X-Painel': '1' }, body: '{}' })).status, r).toBe(403);
      }
    } finally { await fechar(); }
  });
});

describe('parser tolerante do histórico de envios', () => {
  it('ignora linha quebrada e aceita registro sem campos', () => {
    const t = [
      '{"data": "2026-11-09T10:00:00", "canal": "canal-b", "video_id": "LPlTSX-7R84", "titulo": "A", "privacy": {"privacyStatus": "public"}, "thumb_ok": true}',
      'lixo{{{',
      '{"data": "2026-11-08T09:00:00", "url": "https://youtube.com/shorts/cgZSgxjXaWs"}',
      '{"canal": "canal-a"}',
      '{"data": "2026-11-09T11:00:00", "canal": "canal-c", "video_id": "id-ruim\\"><script>", "titulo": "B"}',
      '{"data": "2026-11-0',
    ].join('\n');
    const u = lerHistorico(t);
    expect(u.map((x) => x.titulo)).toEqual(['B', 'A', '']);
    expect(u[1].miniatura).toBe('https://i.ytimg.com/vi/LPlTSX-7R84/mqdefault.jpg');
    expect(u[2].video_id).toBe('cgZSgxjXaWs');
    expect(u[2].canal).toBe('?');
    expect(u[0].video_id).toBeNull();
  });
});

describe('rodadas', () => {
  it('junta início/fim, marca presa > 90 min e falhou', () => {
    const r = montarRodadas([
      { ts: '2026-11-09T08:00:00', unidade: 'backup', fase: 'inicio', edicao: 'e1' },
      { ts: '2026-11-09T08:05:00', unidade: 'backup', fase: 'fim', edicao: 'e1', resultado: 'ok', dur_s: 300 },
      { ts: '2026-11-09T17:00:00', unidade: 'render', fase: 'inicio' },
      { ts: '2026-11-09T19:40:00', unidade: 'resumo', fase: 'inicio' },
      { ts: '2026-11-09T12:00:00', unidade: 'relatorio', fase: 'fim', resultado: 'falhou', motivo: 'sem dados' },
      { unidade: 'sem-ts', fase: 'inicio' },
    ], AGORA);
    const por = Object.fromEntries(r.map((x) => [x.unidade, x]));
    expect(por.backup.dur_s).toBe(300);
    expect(por.backup.presa).toBe(false);
    expect(por.render.presa).toBe(true);
    expect(por.resumo.presa).toBe(false);
    expect(por.relatorio.resultado).toBe('falhou');
    expect(por['sem-ts']).toBeUndefined();
  });
});

function gruposBase(): GruposColetados {
  const g = (dados: unknown) => ({ ok: true, gerado_em: AGORA, dados }) as never;
  return {
    maquina: g({ memoria: { total_gb: 119, disponivel_gb: 50, swap_usado_gb: 0 }, carga: null, disco: { total_gb: 4000, livre_gb: 800, usado_pct: 80 }, boot_em: AGORA - 86400, reinicios: { em: [] }, gpu_oom: { ultimas_24h: 3, ultima_hora: 0, ultima_em: AGORA - 7200 } }),
    bots: g({ bots: [{ nome: 'robo-a', jobs: {}, falhas_24h: [] }], servicos: { 'robo-a.service': 'active', 'robo-b.service': 'desconhecido' } }),
    producao: g({ hoje: [], presas: [], falhas: [], esperas: [], timers: [] }),
    publicacao: g({ filas_itens: [] }),
    creditos: g({ claude: { limites: [{ nome: 'Semana (todos)', pct: 50, reset_em: null }] }, codex: null, avisos: [] }),
    sites: g({ sites: [{ url: 'https://exemplo.com', ok: true }] }),
    terminais: g({ vivos: [], interrompidos: [] }),
  };
}

describe('regras de alerta', () => {
  it('tudo normal = nenhum alerta (GPU antiga, serviço desconhecido e limite 50% não alertam)', () => {
    expect(avaliarAlertas(gruposBase(), AGORA)).toEqual([]);
  });

  it('cada limite dispara com chave estável; limites de memória/disco vêm da config', () => {
    const g = gruposBase() as unknown as Record<string, { dados: Record<string, unknown> }>;
    Object.assign(g.maquina.dados, { disco: { usado_pct: 93, livre_gb: 289 }, memoria: { disponivel_gb: 0.5, total_gb: 8, cache_gb: 20 }, boot_em: AGORA - 3600, gpu_oom: { ultimas_24h: 5, ultima_hora: 2, ultima_em: AGORA - 60 } });
    g.bots.dados.servicos = { 'robo-a.service': 'active', 'robo-b.service': 'inactive' };
    g.bots.dados.bots = [{ nome: 'robo-a', jobs: {}, falhas_24h: [{ id: 7, tarefa: 'cli', fila: 'agente', quando: AGORA - 60, erro: 'x' }] }];
    g.producao.dados.presas = [{ unidade: 'render', inicio: AGORA - 6000, presa: true, aberta_min: 100 }];
    g.producao.dados.falhas = [{ unidade: 'backup', edicao: 'e9', fim: AGORA - 100, resultado: 'falhou' }];
    g.publicacao.dados.filas_itens = [{ chave: 'fila-videos', nome: 'Vídeos', problema: 'arquivo VAZIO — x', itens: [{ id: 'z', nome: 'Z', estado: 'erro', quando: AGORA - 60 }, { id: 'velho', nome: 'V', estado: 'erro', quando: AGORA - 30 * 86400 }] }];
    g.sites.dados.sites = [{ url: 'https://loja.exemplo.com', ok: false, erro: 'HTTP 502' }];
    g.creditos.dados.claude = { limites: [{ nome: 'Semana (todos)', pct: 85 }] };
    g.creditos.dados.avisos = lerAvisos([{ titulo: 'Renovar login', ate: '2026-11-11' }], AGORA);
    g.terminais.dados.interrompidos = [{ session_id: 's1', projeto: 'projeto-a' }];
    const al = avaliarAlertas(g as unknown as GruposColetados, AGORA);
    expect(al.map((a) => a.chave).sort()).toEqual([
      'disco:raiz', 'fila-erro:fila-videos:z', 'fila-ilegivel:fila-videos', 'gpu:oom', 'job-falhou:robo-a:7', 'limite-claude:Semana (todos)', 'manual:Renovar login',
      'memoria:baixa', `reinicio:${AGORA - 3600}`, 'rodada-falhou:backup:e9', `rodada-presa:render:${AGORA - 6000}`, 'servico:robo-b.service',
      'site-fora:loja.exemplo.com', 'terminal-interrompido:s1',
    ].sort());
    expect(al.find((a) => a.chave === 'gpu:oom')?.texto).toMatch(/cache de disco/);
    // Com limite de memória menor na config, 0,5 GB não alerta.
    expect(avaliarAlertas(g as unknown as GruposColetados, AGORA, { memoriaGb: 0.25 }).some((a) => a.chave === 'memoria:baixa')).toBe(false);
    (g.maquina.dados.disco as { usado_pct: number }).usado_pct = 95;
    expect(avaliarAlertas(g as unknown as GruposColetados, AGORA).filter((a) => a.chave === 'disco:raiz')).toHaveLength(1);
  });

  it('prazo manual conta dias de calendário', () => {
    const [a] = lerAvisos([{ titulo: 'x', ate: '2026-11-11' }], AGORA);
    expect(a.dias).toBe(2);
    expect(a.vencido).toBe(false);
    expect(lerAvisos([{ titulo: 'y', ate: '2026-11-01' }], AGORA)[0].vencido).toBe(true);
  });
});

describe.skipIf(!temSqlite)('bancos dos bots (better-sqlite3)', () => {
  it('aberto SÓ leitura; colunas opcionais; falhas 24 h; rota de falha completa', async () => {
    const Database = createRequire(import.meta.url)('better-sqlite3');
    const dir = mkdtempSync(join(tmpdir(), 'painel-bot-'));
    const arq = join(dir, 'robo.db');
    const w = new Database(arq);
    w.exec(`CREATE TABLE jobs (id INTEGER PRIMARY KEY, tarefa TEXT, status TEXT, erro TEXT, resultado TEXT, criado_em INTEGER, terminado_em INTEGER);
      INSERT INTO jobs VALUES (1,'resumo','failed','boom','saida completa',${AGORA - 120},${AGORA - 60}), (2,'x','running',NULL,NULL,${AGORA - 30},NULL), (3,'y','queued',NULL,NULL,${AGORA - 10},NULL), (4,'z','failed','antigo',NULL,${AGORA - 3 * 86400},${AGORA - 3 * 86400});
      CREATE TABLE minima (id INTEGER PRIMARY KEY, status TEXT); INSERT INTO minima VALUES (1,'done');`);
    w.close();
    const db = (await abrirSomenteLeitura(arq))!;
    expect(db.readonly).toBe(true);
    expect(() => db.exec("INSERT INTO jobs (tarefa) VALUES ('x')")).toThrow(/readonly/i);
    const r = lerBot(db, 'robo', 'jobs', AGORA);
    expect(r.jobs).toMatchObject({ rodando: 1, na_fila: 1 });
    expect(r.falhas_24h.map((f) => f.id)).toEqual([1]);
    expect(lerBot(db, 'robo', 'minima', AGORA).jobs.criados_hoje).toBeNull();
    db.close();
    await expect(abrirSomenteLeitura(join(dir, 'nao-existe.db'))).rejects.toThrow();
    const cfg = normalizarConfig({ bots: [{ nome: 'robo', banco: arq }] });
    expect((await falhaCompleta(cfg.bots, 'robo', 1))?.resultado).toBe('saida completa');
    expect(await falhaCompleta(cfg.bots, 'outro', 1)).toBeNull();
    const p = await montarPainel(depsTeste({ bots: [{ nome: 'robo', banco: arq }] }, { agora: () => AGORA }));
    expect(p.alertas.some((a) => a.chave === 'job-falhou:robo:1')).toBe(true);
  });
});

describe('POST /api/vagas (via mudarVagas)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'painel-vagas-'));
  const vj = join(dir, 'vagas.json');
  writeFileSync(vj, JSON.stringify({ gpu: 1, render: 2, _teto: { gpu: 2, render: 4 } }));
  const script = join(dir, 'vagas');
  writeFileSync(script, '#!/bin/sh\necho ok\n');
  const chamadas: string[][] = [];
  const exec: Executor = async (cmd, args) => { chamadas.push([cmd, ...args]); return { ok: true, stdout: 'gravado', stderr: '', codigo: 0 }; };
  const d = () => depsTeste({ vagas: { arquivo: vj, mudar_comando: script } }, { exec });

  it('sem mudar_comando na config → 503; demo → 403', async () => {
    expect((await mudarVagas(depsTeste({ vagas: { arquivo: vj } }), '{"classe":"gpu","valor":1}')).status).toBe(503);
    expect((await mudarVagas(depsTeste({}, { demo: true }), '{"classe":"gpu","valor":1}')).status).toBe(403);
  });
  it('acima do teto, JSON inválido, valor 0, fracionário e _teto → 400', async () => {
    for (const b of ['{"classe":"gpu","valor":3}', '{nao json', '{"classe":"gpu","valor":0}', '{"classe":"gpu","valor":1.5}', '{"classe":"_teto","valor":1}', '{"classe":"toString","valor":1}']) expect((await mudarVagas(d(), b)).status, b).toBe(400);
    expect(chamadas).toEqual([]);
  });
  it('válido → chama `<mudar_comando> <classe> <n>` sem shell e limpa o cache', async () => {
    const x = d();
    await x.cache.obter('painel', 60_000, () => 'velho');
    const r = await mudarVagas(x, '{"classe":"gpu","valor":2}');
    expect(r.status).toBe(200);
    expect(x.cache.ultimo('painel')).toBeUndefined();
    expect(chamadas).toEqual([[script, 'gpu', '2']]);
  });
  it('status no formato {classes:{gpu:{…}}}', () => {
    const c = montarClasses({ classes: { gpu: { vagas: 1, teto: 2, ocupadas: 1, esperando: 0, donos: [{ vaga: 1, quem: 'render', desde: 'x' }] } } }, { gpu: 1, _teto: { gpu: 2 } });
    expect(c).toEqual([{ classe: 'gpu', vagas: 1, teto: 2, ocupadas: 1, dono: 'render', desde: 'x', esperando: 0 }]);
  });
});

describe('sessões nativas do Claude Code', () => {
  it('lê só <pid>.json; vivo pelo /proc; morto vira interrompida; nada além dos campos usados', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sess-'));
    const proc = mkdtempSync(join(tmpdir(), 'proc-'));
    mkdirSync(join(proc, '111')); writeFileSync(join(proc, '111', 'cmdline'), 'claude\0');
    writeFileSync(join(proc, '111', 'stat'), '111 (claude) S 1 1 1 0');
    writeFileSync(join(dir, '111.json'), JSON.stringify({ pid: 111, sessionId: 'aaaaaaaa-1', cwd: '/srv/projeto-a', startedAt: 1794200000000, kind: 'interactive', entrypoint: 'cli', messagingSocketPath: '/tmp/segredo.sock' }));
    writeFileSync(join(dir, '222.json'), JSON.stringify({ pid: 222, sessionId: 'bbbbbbbb-2', cwd: '/srv/projeto-b', kind: 'headless' }));
    writeFileSync(join(dir, '111.abc.key'), 'nao-ler');
    const r = lerSessoesNativas(dir, proc)!;
    expect(r.vivos.map((t) => t.session_id)).toEqual(['aaaaaaaa-1']);
    expect(r.vivos[0]).toMatchObject({ projeto: 'projeto-a', tipo: 'interativo', inicio: 1794200000 });
    expect(r.interrompidos.map((t) => t.session_id)).toEqual(['bbbbbbbb-2']);
    expect(JSON.stringify(r)).not.toContain('segredo');
    expect(lerSessoesNativas(join(dir, 'nao-existe'))).toBeNull();
  });
});

describe('conversa e novo terminal', () => {
  it('conversa: entrega ao bot, guarda as duas pontas, mascara segredo, limita o texto', async () => {
    const entrou: string[] = [];
    const c = new Conversa(async (t) => { entrou.push(t); return ['resposta com sk-ant-abcdefghijklmnopqrstuvwxyz123456']; }, join(mkdtempSync(join(tmpdir(), 'chat-')), 'chat.log'));
    expect(c.enviar(JSON.stringify({ texto: 'status' }), 't').status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(entrou).toEqual(['status']);
    const m = c.desde(0);
    expect(m.map((x) => x.quem)).toEqual(['voce', 'bot']);
    expect(m[1].texto).not.toContain('abcdefghijklmnop');
    expect(c.desde(1).length).toBe(1);
    expect(c.enviar(JSON.stringify({ texto: '' }), 't').status).toBe(400);
    expect(c.enviar(JSON.stringify({ texto: 'x'.repeat(4001) }), 't').status).toBe(413);
  });
  it('novo terminal: desligado sem Assumir; só dentro da raiz; usa o lançador e o tmux da config', async () => {
    const chamadas: string[][] = [];
    const exec: Executor = async (c, a) => { chamadas.push([c, ...a]); return { ok: true, stdout: '', stderr: '', codigo: 0 }; };
    const base = depsTeste();
    const raiz = join(base.casa, 'trabalho');
    mkdirSync(join(raiz, 'app'), { recursive: true });
    const cfg = { novo_terminal: { raiz, lancador: 'meu-agente --x' }, assumir: { tmux_servidor: 'meu-tmux' } };
    expect((await novoTerminal(depsTeste(cfg, { exec }), JSON.stringify({ pasta: 'app' }), 't')).status).toBe(403);
    const d = depsTeste(cfg, { exec, assumir: true });
    expect((await novoTerminal(d, JSON.stringify({ pasta: '/etc' }), 't')).status).toBe(400);
    expect((await novoTerminal(d, JSON.stringify({ pasta: '../..' }), 't')).status).toBe(400);
    expect((await novoTerminal(d, JSON.stringify({ pasta: 'nao-existe' }), 't')).status).toBe(404);
    expect((await novoTerminal(d, JSON.stringify({ pasta: 'app' }), 't')).status).toBe(200);
    expect(chamadas[0]).toEqual(expect.arrayContaining(['tmux', '-L', 'meu-tmux', 'new-session', '-d', '-c', join(raiz, 'app'), 'meu-agente --x']));
  });
});

describe('pequenos parsers e a tela', () => {
  it('meminfo, boots em JSON, rate_limits do Codex, pendências', () => {
    expect(lerMeminfo('MemTotal: 8388608 kB\nMemFree: 1048576 kB\nMemAvailable: 4194304 kB\nCached: 2097152 kB\n')).toMatchObject({ total_gb: 8, disponivel_gb: 4, cache_gb: 2, livre_gb: 1 });
    expect(lerBoots('[{"first_entry":1794250590000000},{"first_entry":1794276000000000}]')).toEqual([1794250590, 1794276000]);
    const rl = extrairRateLimits('xx{"payload":{"rate_limits":{"primary":{"used_percent":18.0,"resets_at":1794405623},"plan_type":"p"}}}\n');
    expect((rl?.primary as { used_percent: number }).used_percent).toBe(18);
    expect(extrairRateLimits('nada')).toBeNull();
    const p = lerPendencias('# x\n## Abertas\n- **Um**: a\n  - [ ] sub\n### Dois\n- **Três**\n## Resolvidas\n- **Velha**\n');
    expect(p?.map((x) => x.titulo)).toEqual(['Um', 'Dois', 'Três']);
    expect(lerPendencias(null)).toBeNull();
  });
  it('JS do cliente compila e o HTML tem os 9 grupos e a gaveta Conversar', () => {
    expect(() => new Function(PAINEL_JS)).not.toThrow();
    expect(PAINEL_JS).not.toMatch(/token=|Bearer/);
    const h = paginaPainel();
    for (const g of GRUPOS) expect(h).toContain(`id="t-${g}"`);
    expect(h).toContain('id="conversar"');
    expect(h).toContain('id="chat"');
  });
});
