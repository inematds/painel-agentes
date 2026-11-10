// Filas num formato só: estado/status, txt e arquivo de esperas vazio (quem lê a lista para).
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { coletarFilas, itensEsperas, itensJson, itensTxt, normalizar } from './fontes/filas.js';
import { depsTeste } from './teste-ajuda.test-util.js';

describe('filas', () => {
  it('normaliza os estados de sistemas diferentes', () => {
    expect(['pendente', 'queued', 'esperando'].map(normalizar)).toEqual(['pendente', 'pendente', 'pendente']);
    expect(['feito', 'done', 'publicado'].map(normalizar)).toEqual(['feito', 'feito', 'feito']);
    expect(['erro', 'failed', 'falhou', 'parado'].map(normalizar)).toEqual(['erro', 'erro', 'erro', 'erro']);
    expect(['retirado', 'removido', 'canceled'].map(normalizar)).toEqual(['retirado', 'retirado', 'retirado']);
    expect(normalizar('rodando')).toBe('publicando');
  });

  it('lê fila com estado e com status; erro guarda o fim da mensagem', () => {
    const a = itensJson([{ id: 'x', estado: 'erro', erro: 'linha 1\nlinha 2\nquota excedida', tentativas: 2, arquivo: '/a/b/v.mp4', canal: 'canal-a' }])!;
    expect(a[0]).toMatchObject({ id: 'x', estado: 'erro', tentativas: 2, arquivo: 'v.mp4', canal: 'canal-a' });
    expect(a[0].erro).toContain('quota excedida');
    const b = itensJson([{ video_id: 'abc', titulo: 'T', status: 'feito', redes: ['rede-a', 'rede-b'] }])!;
    expect(b[0]).toMatchObject({ id: 'abc', estado: 'feito', canal: 'rede-a+rede-b', erro: null });
    expect(itensJson({ nada: 1 })).toBeNull();
  });

  it('txt: um item por linha, # é comentário', () => {
    expect(itensTxt('# c\n/x/item-a\n\n/x/item-b\n').map((i) => i.id)).toEqual(['item-a', 'item-b']);
  });

  it('arquivo de esperas vazio vira problema (não "nenhuma espera")', () => {
    const d = mkdtempSync(join(tmpdir(), 'esp-'));
    writeFileSync(join(d, 'e.json'), '');
    expect(itensEsperas(join(d, 'e.json')).problema).toMatch(/VAZIO/);
    writeFileSync(join(d, 'e.json'), '{quebrado');
    expect(itensEsperas(join(d, 'e.json')).problema).toMatch(/corrompido/);
    writeFileSync(join(d, 'e.json'), JSON.stringify({ a: { estado: 'esperando', desde: '2026-11-10 00:24' } }));
    const r = itensEsperas(join(d, 'e.json'));
    expect(r.problema).toBeNull();
    expect(r.itens[0]).toMatchObject({ id: 'a', estado: 'pendente' });
  });

  it('coletarFilas: lista da config, abertos primeiro, só 5 feitos, arquivo ausente vira problema', () => {
    const base = depsTeste();
    const arq = join(base.casa, 'videos.json');
    const itens = [...Array.from({ length: 8 }, (_, i) => ({ id: 'f' + i, estado: 'feito', quando: `2026-11-0${i + 1}T10:00` })), { id: 'p', estado: 'pendente' }, { id: 'e', estado: 'erro', erro: 'x' }];
    writeFileSync(arq, JSON.stringify(itens));
    writeFileSync(join(base.casa, 'posts.txt'), 'post-1\npost-2\n');
    const d = depsTeste({ publicacao: { filas: [
      { chave: 'fila-videos', nome: 'Vídeos', arquivo: arq, formato: 'json', quem: 'timer' },
      { chave: 'fila-posts', nome: 'Posts', arquivo: join(base.casa, 'posts.txt'), formato: 'txt' },
      { chave: 'sumiu', nome: 'Sumiu', arquivo: join(base.casa, 'nao-existe.json') },
    ] } });
    const fs = coletarFilas(d);
    const r = fs.find((f) => f.chave === 'fila-videos')!;
    expect(r.total).toBe(10);
    expect(r.itens.map((i) => i.id).slice(0, 2)).toEqual(['e', 'p']);
    expect(r.itens.length).toBe(7);
    expect(r.itens[2].id).toBe('f7');
    expect(fs.find((f) => f.chave === 'fila-posts')!.por_estado.pendente).toBe(2);
    expect(fs.find((f) => f.chave === 'sumiu')!.problema).toBeTruthy();
  });
});
