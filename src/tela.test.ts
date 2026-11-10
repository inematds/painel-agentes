// Os desenhos do cliente com dados realistas (rodada presa, rodada que falhou,
// falha de job, envios, terminais) nos três modos — sem navegador.
import { describe, expect, it } from 'vitest';

import { painelDemo } from './demo.js';
import { normalizarConfig } from './config.js';
import { JS_AJUDA } from './tela/script-base.js';
import { JS_GRUPOS } from './tela/script-grupos.js';

type Desenho = { tile: (d: unknown, g: unknown) => { frase: string; corpo: string }; detalhe: (d: unknown, g: unknown) => string };
const cliente = new Function(`${JS_AJUDA}\nvar NOMES={producao:'Produção',bots:'Bots'};\n${JS_GRUPOS}\nreturn {G:G,E:E};`)() as { G: Record<string, Desenho>; E: { modo: string; dados: unknown } };

const T = Math.floor(Date.now() / 1000);
const DADOS: Record<string, unknown> = {
  maquina: { memoria: { total_gb: 119, disponivel_gb: 9, swap_usado_gb: 1 }, carga: { m1: 3, m5: 2, m15: 1, nucleos: 20 }, disco: { total_gb: 4000, livre_gb: 280, usado_pct: 93 }, boot_em: T - 3600, reinicios: { em: [T - 3600] }, gpu_oom: { ultimas_24h: 2, ultima_hora: 1, ultima_em: T - 60 } },
  bots: { bots: [{ nome: 'robo-a', jobs: { por_estado: { done: 3, failed: 1 }, rodando: 1, na_fila: 2, criados_hoje: 9 }, falhas_24h: [{ id: 5, tarefa: 'cli<b>', fila: 'agente', quando: T - 60, erro: 'boom "x"' }] },
    { nome: 'robo-b', jobs: { por_estado: {}, rodando: 0, na_fila: 0, criados_hoje: null }, falhas_24h: [] }], servicos: { 'robo-a.service': 'active', 'robo-b.service': 'failed' } },
  producao: { hoje: [{ unidade: 'robo-diario', edicao: 'e', inicio: T - 900, fim: T - 600, resultado: 'falhou', motivo: 'm', dur_s: 300, presa: false, aberta_min: null }, { unidade: 'resumo', inicio: T - 60, fim: null, resultado: null, presa: false, aberta_min: 1 }],
    presas: [{ unidade: 'render-capas', inicio: T - 6000, fim: null, resultado: null, presa: true, aberta_min: 100 }], falhas: [], esperas: [{ chave: 'k', estado: 'esperando', desde: T - 60, teto_h: 8, passou_teto: false }], timers: [{ unidade: 'backup', proxima: T + 60, ultima: T - 60 }] },
  publicacao: { hoje: 1, hoje_por_canal: { 'canal-a': 1 }, semana_por_canal: { 'canal-a': 4, 'canal-b': 2 }, ultimos: [{ quando: T - 60, canal: 'canal-a', video_id: null, url: 'https://exemplo.com/v/1', titulo: 'T', miniatura: null }],
    filas_itens: [{ chave: 'fila-videos', nome: 'Fila', onde: '~/f.json', quem: 'timer', total: 2, por_estado: { pendente: 1, publicando: 0, feito: 0, erro: 1, retirado: 0 }, itens: [{ id: 'z', nome: 'Z', estado: 'erro', original: 'failed', canal: null, quando: T, tentativas: 2, erro: 'e', arquivo: null }], problema: null }] },
  creditos: { claude: { limites: [{ nome: 'Semana (todos)', pct: 85, reset_em: T + 3600 }], idade_s: 60 }, codex: { pct: 18, reset_em: T + 9, janela_h: 168, plano: 'p', idade_s: 9 }, avisos: [{ titulo: 'Renovar login', ate: '2026-11-11', nivel: 'aviso', vencido: false, dias: 2 }] },
  sites: { desligado: false, checando: false, sites: [{ url: 'https://loja.exemplo.com', ok: false, status: 502, ms: null, erro: 'HTTP 502' }, { url: 'https://exemplo.com', ok: true, status: 200, ms: 100 }], checado_em: T },
  vagas: { classes: [{ classe: 'gpu', vagas: 2, teto: 2, ocupadas: 1, dono: 'render', esperando: 1 }], pode_mudar: true, motivo_so_leitura: null, dica: 'vagas <classe> <n>', internas: { 'robo-a': { chat: 2 } } },
  terminais: { assumir: false, tmux_servidor: 'painel', vivos: [{ session_id: 'abcdefgh', projeto: 'projeto-a', cwd: '/x', tipo: 'interativo', inicio: T - 600, tty: 'pts/1' }], interrompidos: [{ session_id: 'defghijk', projeto: 'projeto-b', cwd: '/y' }] },
  esperando: { itens: [{ tipo: 'falha', nivel: 'erro', grupo: 'bots', texto: 'robo-a #5 falhou' }, { tipo: 'pendencia', nivel: 'info', grupo: 'esperando', texto: 'P' }] },
};

describe('desenhos do cliente', () => {
  for (const modo of ['lista', 'icones', 'imagens']) {
    it(`todos os grupos desenham no modo ${modo}, escapando HTML`, () => {
      cliente.E.modo = modo;
      for (const [nome, d] of Object.entries(DADOS)) {
        const g = { ok: true, gerado_em: T, dados: d };
        const t = cliente.G[nome].tile(d, g);
        const det = cliente.G[nome].detalhe(d, g);
        expect(t.frase.length, nome).toBeGreaterThan(0);
        expect(det.length, nome).toBeGreaterThan(0);
        expect(t.corpo + det).not.toContain('<b>"x"');
        expect(t.corpo + det).not.toContain('cli<b>');
      }
      expect(cliente.G.producao.tile(DADOS.producao, {}).frase).toContain('parada');
      expect(cliente.G.bots.detalhe(DADOS.bots, {})).toContain('data-falha="robo-a:5"');
      expect(cliente.G.bots.detalhe(DADOS.bots, {})).toContain('robo-b');
    });
  }

  it('os dados do modo demonstração desenham em todos os grupos e modos', () => {
    const p = painelDemo(T, 't', normalizarConfig({}));
    for (const modo of ['lista', 'icones', 'imagens']) {
      cliente.E.modo = modo;
      for (const [nome, g] of Object.entries(p.grupos)) {
        const t = cliente.G[nome].tile(g.dados, g);
        expect(t.frase, `${nome}/${modo}`).not.toContain('vazia');
        expect(cliente.G[nome].detalhe(g.dados, g).length).toBeGreaterThan(20);
      }
    }
  });
});
