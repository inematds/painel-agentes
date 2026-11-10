// Versão JARVIS do painel: JS do cliente válido, sem interpolação perdida, e a rota /jarvis.
import { describe, expect, it } from 'vitest';

import { JARVIS_JS, paginaJarvis } from './tela/jarvis.js';
import { paginaPainel, PAINEL_JS } from './tela/pagina.js';
import { abrirDemo } from './teste-ajuda.test-util.js';

describe('tela JARVIS', () => {
  it('o JS do cliente compila e não tem crase nem ${ sobrando', () => {
    for (const js of [JARVIS_JS, PAINEL_JS]) {
      expect(() => new Function(js)).not.toThrow();
      expect(js).not.toContain('`');
      expect(js).not.toContain('${');
    }
  });

  it('a página lê /api/painel, volta ao clássico e só escreve pelo Assumir (com X-Painel)', () => {
    const h = paginaJarvis();
    expect(h).toContain("fetch('/api/painel'");
    expect(h).toContain('href="/painel"');
    expect(JARVIS_JS).not.toContain('/api/vagas');
    expect(JARVIS_JS.match(/method:'POST'/g)?.length).toBe(1);
    expect(JARVIS_JS).toMatch(/fetch\('\/api\/painel\/terminal\/enviar',\{method:'POST'[^}]*'X-Painel':'1'/);
  });

  it('o nome falado vem da API (padrão "você"), não do código', () => {
    expect(JARVIS_JS).toContain("var NOME='você'");
    expect(JARVIS_JS).toContain('NOME=D.tela.nome_falado');
  });

  it('título da config vai escapado para o HTML', () => {
    expect(paginaJarvis('<x>')).toContain('JARVIS · &lt;X&gt;');
    expect(paginaPainel('Casa & Cia')).toContain('Painel <i>Casa &amp; Cia</i>');
  });

  it('GET /jarvis responde a tela (modo demonstração)', async () => {
    const { base, fechar } = await abrirDemo();
    const r = await fetch(`${base}/jarvis`);
    const t = await r.text();
    await fechar();
    expect(r.status).toBe(200);
    expect(t).toContain('JARVIS · DE AGENTES');
  });
});
