// Utilitários do painel: cache em memória com uma só execução em voo, leitura
// do FIM de arquivos grandes, JSON tolerante e `execFile` com teto. Nada aqui
// varre pastas nem chama modelo/API: o painel só lê o que já está na máquina.
import { execFile } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';

/** Resultado de um comando externo (nunca lança). */
export interface SaidaExec { ok: boolean; stdout: string; stderr: string; codigo: number | null; erro?: string }
export type Executor = (cmd: string, args: string[], timeoutMs?: number) => Promise<SaidaExec>;

/** `execFile` sem shell, com timeout e teto de saída. Nunca rejeita. */
export const executar: Executor = (cmd, args, timeoutMs = 5000) => new Promise((resolve) => {
  if (cmd.startsWith('/') && !existsSync(cmd)) { resolve({ ok: false, stdout: '', stderr: '', codigo: null, erro: 'ausente' }); return; }
  execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', env: { ...process.env, SYSTEMD_COLORS: '0', LANG: 'C.UTF-8' } }, (err, stdout, stderr) => {
    const e = err as (NodeJS.ErrnoException & { code?: number | string }) | null;
    resolve({ ok: !e, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), codigo: e ? (typeof e.code === 'number' ? e.code : null) : 0, erro: e ? (e.code === 'ENOENT' ? 'ausente' : e.message) : undefined });
  });
});

/** Cache por chave com validade em ms; pedidos simultâneos dividem a mesma promessa. */
export class Cache {
  private readonly val = new Map<string, { em: number; v: unknown }>();
  private readonly voo = new Map<string, Promise<unknown>>();
  constructor(private readonly agoraMs: () => number = () => Date.now()) {}

  async obter<T>(chave: string, validadeMs: number, gerar: () => Promise<T> | T): Promise<T> {
    const c = this.val.get(chave);
    if (c && this.agoraMs() - c.em < validadeMs) return c.v as T;
    const emVoo = this.voo.get(chave);
    if (emVoo) return emVoo as Promise<T>;
    const p = (async () => {
      try { const v = await gerar(); this.val.set(chave, { em: this.agoraMs(), v }); return v; }
      finally { this.voo.delete(chave); }
    })();
    this.voo.set(chave, p);
    return p;
  }

  /** Valor guardado (mesmo vencido) — para o "stale-while-revalidate" dos sites. */
  ultimo<T>(chave: string): { em: number; v: T } | undefined {
    return this.val.get(chave) as { em: number; v: T } | undefined;
  }

  apagar(chave: string): void { this.val.delete(chave); }
  limpar(): void { this.val.clear(); }
}

/** Lê só os últimos `maxBytes` do arquivo. Descarta a primeira linha (cortada) se não começou do zero. */
export function lerFim(caminho: string, maxBytes: number): string | null {
  let fd: number | undefined;
  try {
    const tam = statSync(caminho).size;
    const ini = Math.max(0, tam - maxBytes);
    const buf = Buffer.alloc(tam - ini);
    fd = openSync(caminho, 'r');
    readSync(fd, buf, 0, buf.length, ini);
    let s = buf.toString('utf8');
    if (ini > 0) { const i = s.indexOf('\n'); s = i >= 0 ? s.slice(i + 1) : ''; }
    return s;
  } catch { return null; } finally { if (fd !== undefined) closeSync(fd); }
}

/** Linhas JSONL que fazem parse; o resto é ignorado em silêncio. */
export function linhasJson<T = Record<string, unknown>>(texto: string): T[] {
  const out: T[] = [];
  for (const l of texto.split('\n')) {
    const t = l.trim();
    if (!t || t[0] !== '{') continue;
    try { out.push(JSON.parse(t) as T); } catch { /* linha quebrada */ }
  }
  return out;
}

const cacheArq = new Map<string, { mtime: number; tam: number; v: unknown }>();
/** JSON de arquivo com cache por mtime+tamanho; `null` se ausente ou inválido. */
export function lerJson<T = unknown>(caminho: string): T | null {
  try {
    const st = statSync(caminho);
    const c = cacheArq.get(caminho);
    if (c && c.mtime === st.mtimeMs && c.tam === st.size) return c.v as T;
    const v = JSON.parse(readFileSync(caminho, 'utf8')) as T;
    cacheArq.set(caminho, { mtime: st.mtimeMs, tam: st.size, v });
    return v;
  } catch { return null; }
}

/** Texto de arquivo pequeno com cache por mtime; `null` se ausente. */
export function lerTexto(caminho: string): string | null {
  try {
    const st = statSync(caminho);
    const c = cacheArq.get('t:' + caminho);
    if (c && c.mtime === st.mtimeMs && c.tam === st.size) return c.v as string;
    const v = readFileSync(caminho, 'utf8');
    cacheArq.set('t:' + caminho, { mtime: st.mtimeMs, tam: st.size, v });
    return v;
  } catch { return null; }
}

/** Idade (s) do arquivo, ou null. */
export function idadeArquivo(caminho: string, agoraS: number): number | null {
  try { return Math.max(0, Math.round(agoraS - statSync(caminho).mtimeMs / 1000)); } catch { return null; }
}

/** Data/hora → epoch em segundos. Aceita ISO (sem fuso = hora local), número em s ou ms, "AAAA-MM-DD HH:MM". */
export function paraEpoch(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v > 1e12 ? Math.round(v / 1000) : Math.round(v);
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(v) ? v.replace(' ', 'T') : v;
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.round(t / 1000) : null;
}

/** Epoch (s) da meia-noite local do dia de `agoraS`. */
export function inicioDoDia(agoraS: number): number {
  const d = new Date(agoraS * 1000); d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export function corta(s: unknown, n: number): string {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}
