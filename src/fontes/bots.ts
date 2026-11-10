// Bots: cada banco SQLite da config (aberto SOMENTE LEITURA) e o estado dos
// serviços do systemd do usuário. A tabela de jobs é lida de forma tolerante:
// só `id` e `status` são obrigatórios; tarefa, fila, erro, resultado,
// criado_em e terminado_em entram se existirem.
// better-sqlite3 é dependência OPCIONAL: sem ela, os bancos ficam "sem dados".
import type BancoSqlite from 'better-sqlite3';

import type { BotCfg } from '../config.js';
import type { Coleta, DepsPainel } from '../tipos.js';
import { corta, inicioDoDia, paraEpoch } from '../util.js';

type Db = BancoSqlite.Database;
/** Janela de ids olhada em cada banco (tabelas grandes não têm índice por status). */
const JANELA = 8000;

let modulo: (new (arq: string, o: Record<string, unknown>) => Db) | null | undefined;
async function sqlite(): Promise<typeof modulo> {
  if (modulo !== undefined) return modulo;
  try { modulo = ((await import('better-sqlite3')) as unknown as { default: NonNullable<typeof modulo> }).default; } catch { modulo = null; }
  return modulo;
}

/** Abre um SQLite alheio só para leitura: `readonly`, `fileMustExist`, timeout curto. */
export async function abrirSomenteLeitura(caminho: string): Promise<Db | null> {
  const D = await sqlite();
  if (!D) return null;
  return new D(caminho, { readonly: true, fileMustExist: true, timeout: 300 });
}

const abertos = new Map<string, Db>();
async function banco(caminho: string): Promise<Db | null> {
  const a = abertos.get(caminho);
  if (a && a.open) return a;
  const db = await abrirSomenteLeitura(caminho);
  if (db) abertos.set(caminho, db);
  return db;
}
export function fecharBancos(): void { for (const db of abertos.values()) { try { db.close(); } catch { /* já fechado */ } } abertos.clear(); }

export interface Falha { id: number; tarefa: string; fila: string; quando: number | null; erro: string }
export interface BotLido {
  nome: string;
  jobs: { rodando: number; na_fila: number; criados_hoje: number | null; por_estado: Record<string, number> };
  falhas_24h: Falha[];
}

const RODANDO = new Set(['running', 'rodando', 'publicando', 'em_andamento']);
const FILA = new Set(['queued', 'pendente', 'na_fila', 'esperando', 'agendado']);
const FALHOU = new Set(['failed', 'falhou', 'erro', 'error']);

function colunas(db: Db, tabela: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map((c) => c.name));
}

/** Lê a tabela de jobs de um banco. `tabela` já foi validada na config (só letras, números e _). */
export function lerBot(db: Db, nome: string, tabela: string, agora: number): BotLido {
  const c = colunas(db, tabela);
  if (!c.has('id') || !c.has('status')) throw new Error(`tabela ${tabela} sem id/status`);
  const col = (n: string, alt = "''") => (c.has(n) ? n : `${alt} AS ${n}`);
  const max = (db.prepare(`SELECT max(id) m FROM ${tabela}`).get() as { m: number | null }).m ?? 0;
  const piso = Math.max(0, max - JANELA);
  const linhas = db.prepare(`SELECT id, status, ${col('tarefa')}, ${col('fila')}, ${col('erro')}, ${col('resultado')}, ${col('criado_em', 'NULL')}, ${col('terminado_em', 'NULL')} FROM ${tabela} WHERE id > ? ORDER BY id DESC`).all(piso) as { id: number; status: string; tarefa: string; fila: string; erro: string | null; resultado: string | null; criado_em: unknown; terminado_em: unknown }[];
  const hoje = inicioDoDia(agora);
  const por: Record<string, number> = {};
  let rodando = 0, naFila = 0, criados = 0;
  const falhas: Falha[] = [];
  for (const j of linhas) {
    const st = String(j.status ?? '').toLowerCase();
    por[st] = (por[st] ?? 0) + 1;
    if (RODANDO.has(st)) rodando++;
    if (FILA.has(st)) naFila++;
    const criado = paraEpoch(j.criado_em);
    if (criado !== null && criado >= hoje) criados++;
    if (FALHOU.has(st) && falhas.length < 20) {
      const t = paraEpoch(j.terminado_em) ?? criado;
      if (t !== null && agora - t <= 86400) falhas.push({ id: j.id, tarefa: String(j.tarefa ?? ''), fila: String(j.fila ?? ''), quando: t, erro: corta(j.erro || j.resultado || '', 240) });
    }
  }
  return { nome, jobs: { rodando, na_fila: naFila, criados_hoje: c.has('criado_em') ? criados : null, por_estado: por }, falhas_24h: falhas };
}

/** Resultado completo de uma falha (rota de detalhe, aberta no clique). */
export async function falhaCompleta(bots: BotCfg[], nome: string, id: number): Promise<Record<string, unknown> | null> {
  const b = bots.find((x) => x.nome === nome);
  if (!b) return null;
  const db = await banco(b.banco);
  if (!db) return null;
  const r = db.prepare(`SELECT * FROM ${b.tabela} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  const { input: _i, ...resto } = r;
  return { ...resto, erro: corta(r.erro, 20000), resultado: corta(r.resultado, 20000) };
}

export async function estadoServicos(d: DepsPainel): Promise<Record<string, string>> {
  const servicos = d.cfg.servicos;
  if (!servicos.length) return {};
  return d.cache.obter('bots:servicos', 30_000, async () => {
    const r = await d.exec('systemctl', ['--user', 'is-active', ...servicos], 4000);
    const linhas = r.stdout.trim().split('\n');
    if (!r.stdout.trim()) return Object.fromEntries(servicos.map((s) => [s, 'desconhecido']));
    return Object.fromEntries(servicos.map((s, i) => [s, (linhas[i] ?? 'desconhecido').trim()]));
  });
}

export async function coletarBots(d: DepsPainel): Promise<Coleta<{ bots: BotLido[]; servicos: Record<string, string> }>> {
  const ausentes: string[] = [];
  const bots: BotLido[] = [];
  for (const b of d.cfg.bots) {
    try {
      const db = await banco(b.banco);
      if (!db) { ausentes.push(`${b.nome} (instale better-sqlite3)`); continue; }
      bots.push(lerBot(db, b.nome, b.tabela, d.agora()));
    } catch { ausentes.push(`banco ${b.nome}`); abertos.get(b.banco)?.close(); abertos.delete(b.banco); }
  }
  const servicos = await estadoServicos(d);
  return { dados: { bots, servicos }, ausentes, naoConfigurado: !d.cfg.bots.length && !d.cfg.servicos.length };
}
