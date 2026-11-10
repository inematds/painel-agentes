// Filas de publicação e de espera, item por item, num formato só (só leitura).
// Cada sistema guarda a fila do seu jeito (estado/status, JSON/txt/marcador); aqui tudo vira
// { fila, id, nome, estado ∈ pendente|publicando|feito|erro|retirado, canal, quando, tentativas, erro }.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import type { DepsPainel } from '../tipos.js';
import { corta, lerJson, paraEpoch } from '../util.js';

export type EstadoItem = 'pendente' | 'publicando' | 'feito' | 'erro' | 'retirado';
export interface ItemFila { id: string; nome: string; estado: EstadoItem; original: string; canal: string | null; quando: number | null; tentativas: number | null; erro: string | null; arquivo: string | null }
export interface Fila { chave: string; nome: string; onde: string; quem: string; total: number; por_estado: Record<EstadoItem, number>; itens: ItemFila[]; problema: string | null }

const MAPA: Record<string, EstadoItem> = {
  pendente: 'pendente', na_fila: 'pendente', agendado: 'pendente', esperando: 'pendente', queued: 'pendente',
  rodando: 'publicando', running: 'publicando', publicando: 'publicando',
  feito: 'feito', done: 'feito', publicado: 'feito',
  erro: 'erro', failed: 'erro', falhou: 'erro', parado: 'erro',
  retirado: 'retirado', removido: 'retirado', canceled: 'retirado', cancelado: 'retirado',
};
export const normalizar = (s: unknown): EstadoItem => MAPA[String(s ?? '').toLowerCase()] ?? 'pendente';

const ORDEM: Record<EstadoItem, number> = { publicando: 0, erro: 1, pendente: 2, retirado: 3, feito: 4 };
/** Itens que importam: tudo que não está feito/retirado + os 5 feitos mais recentes. */
const MAX_FEITOS = 5;

function montar(chave: string, nome: string, onde: string, quem: string, itens: ItemFila[], problema: string | null = null): Fila {
  const por = { pendente: 0, publicando: 0, feito: 0, erro: 0, retirado: 0 } as Record<EstadoItem, number>;
  for (const i of itens) por[i.estado]++;
  const abertos = itens.filter((i) => i.estado !== 'feito' && i.estado !== 'retirado');
  const feitos = itens.filter((i) => i.estado === 'feito').sort((a, b) => (b.quando ?? 0) - (a.quando ?? 0)).slice(0, MAX_FEITOS);
  // pendentes mantêm a ordem da fila (é a ordem de saída); o resto por estado.
  const vis = [...abertos.sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado]), ...feitos];
  return { chave, nome, onde, quem, total: itens.length, por_estado: por, itens: vis, problema };
}

const txt = (v: unknown, n = 120) => (v === undefined || v === null || v === '' ? null : corta(String(v), n));

/** Fila JSON (lista ou {itens}) com campo estado ou status. */
export function itensJson(bruto: unknown): ItemFila[] | null {
  const lista = Array.isArray(bruto) ? bruto : (bruto && typeof bruto === 'object' && Array.isArray((bruto as { itens?: unknown[] }).itens) ? (bruto as { itens: unknown[] }).itens : null);
  if (!lista) return null;
  return (lista as Record<string, unknown>[]).filter((x) => x && typeof x === 'object').map((x, i) => {
    const est = x.estado ?? x.status;
    const e = normalizar(est);
    return {
      id: String(x.id ?? x.video_id ?? i), nome: txt(x.titulo_yt ?? x.nome ?? x.titulo ?? x.id ?? x.video_id, 100) ?? '?',
      estado: e, original: String(est ?? ''), canal: txt(x.canal ?? (Array.isArray(x.redes) ? x.redes.join('+') : x.redes), 30),
      quando: paraEpoch(x.quando ?? x.agendado ?? x.publicado_yt ?? x.erro_em),
      tentativas: typeof x.tentativas === 'number' ? x.tentativas : null,
      erro: e === 'erro' ? txt(String(x.erro ?? x.motivo ?? '').trim().split('\n').slice(-2).join(' '), 220) : null,
      arquivo: typeof x.arquivo === 'string' ? basename(x.arquivo) : null,
    };
  });
}

/** Fila em texto: um item por linha (linha com # é comentário); a linha some quando o item sai, então tudo é pendente. */
export function itensTxt(texto: string): ItemFila[] {
  return texto.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => ({
    id: basename(l), nome: basename(l), estado: 'pendente' as const, original: 'na lista', canal: null, quando: null, tentativas: null, erro: null, arquivo: null,
  }));
}

/** Arquivo de esperas (dict por id: {estado, desde, inicio, fim, resultado}). Arquivo vazio = problema: quem lê a lista para. */
export function itensEsperas(cam: string): { itens: ItemFila[]; problema: string | null } {
  let bruto = '';
  try { bruto = readFileSync(cam, 'utf8'); } catch { return { itens: [], problema: 'arquivo não encontrado' }; }
  if (!bruto.trim()) return { itens: [], problema: 'arquivo VAZIO — quem lê esta lista não consegue seguir' };
  let d: Record<string, Record<string, unknown>>;
  try { d = JSON.parse(bruto); } catch { return { itens: [], problema: 'arquivo corrompido' }; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { itens: [], problema: 'arquivo corrompido' };
  return {
    problema: null,
    itens: Object.entries(d).filter(([, it]) => it && typeof it === 'object').map(([id, it]) => {
      const e = normalizar(it.estado);
      return { id, nome: id, estado: e, original: String(it.estado ?? ''), canal: null, quando: paraEpoch(it.fim ?? it.inicio ?? it.desde), tentativas: null, erro: e === 'erro' ? txt(it.resultado, 220) : null, arquivo: null };
    }),
  };
}

export function coletarFilas(d: DepsPainel): Fila[] {
  const filas: Fila[] = [];
  for (const f of d.cfg.publicacao.filas) {
    if (f.formato === 'json') {
      const it = itensJson(lerJson(f.arquivo));
      filas.push(montar(f.chave, f.nome, f.arquivo, f.quem, it ?? [], it ? null : 'arquivo da fila não encontrado ou ilegível'));
    } else if (f.formato === 'txt') {
      let t: string | null = null;
      try { t = readFileSync(f.arquivo, 'utf8'); } catch { /* ausente */ }
      filas.push(montar(f.chave, f.nome, f.arquivo, f.quem, t === null ? [] : itensTxt(t), t === null ? 'arquivo não encontrado' : null));
    } else {
      const e = itensEsperas(f.arquivo);
      filas.push(montar(f.chave, f.nome, f.arquivo, f.quem, e.itens, e.problema));
    }
  }
  return filas;
}
