// Conversar com um bot seu pelo painel (gaveta "Conversar"). DESLIGADO por padrão:
// só com PAINEL_CHAT=1 E `chat.bot.url` na config. O painel faz POST {texto} nessa
// URL e mostra as `respostas` (lista de textos) que ela devolver. Se o seu bot
// roda um agente com permissão total, quem escreve aqui manda nele — por isso
// fica desligado, com log (só o início do texto, mascarado) e o mesmo CSRF do Assumir.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { mascarar } from './fontes/sessoes.js';

export interface MsgConversa { n: number; quando: number; quem: 'voce' | 'bot'; texto: string }

const MAX_TEXTO = 4000;

export class Conversa {
  private msgs: MsgConversa[] = [];
  private n = 0;
  constructor(private entrar: (texto: string) => Promise<string[]>, private log: string | null = null, private max = 300) {}

  /** Mensagem do bot (ou sua). */
  guardar(quem: MsgConversa['quem'], texto: string): MsgConversa {
    const m = { n: ++this.n, quando: Math.floor(Date.now() / 1000), quem, texto: mascarar(String(texto)) };
    this.msgs.push(m);
    if (this.msgs.length > this.max) this.msgs.splice(0, this.msgs.length - this.max);
    return m;
  }

  /** Valida, guarda e entrega ao bot. A resposta chega depois (a tela relê a cada 3 s). */
  enviar(bruto: string, quem: string): { status: number; corpo: unknown } {
    let texto = '';
    try { texto = String((JSON.parse(bruto || '{}') as { texto?: unknown }).texto ?? '').trim(); } catch { return { status: 400, corpo: { erro: 'JSON inválido' } }; }
    if (!texto) return { status: 400, corpo: { erro: 'texto vazio' } };
    if (texto.length > MAX_TEXTO) return { status: 413, corpo: { erro: `texto acima de ${MAX_TEXTO} caracteres` } };
    const m = this.guardar('voce', texto);
    if (this.log) {
      try {
        mkdirSync(dirname(this.log), { recursive: true, mode: 0o700 });
        appendFileSync(this.log, `${new Date().toISOString()} ${quem} ${mascarar(texto).slice(0, 80).replace(/\n/g, ' ')}\n`, { mode: 0o600 });
      } catch { /* log é extra */ }
    }
    this.entrar(texto).then((rs) => { for (const r of rs) if (String(r).trim()) this.guardar('bot', r); },
      (e) => { this.guardar('bot', `(o bot não respondeu: ${(e as Error).message})`); });
    return { status: 200, corpo: { ok: true, n: m.n } };
  }

  desde(n: number): MsgConversa[] { return this.msgs.filter((m) => m.n > n); }
}

/** Entrega por HTTP: POST {texto} → {respostas: string[]} (ou {resposta: string}). Timeout de 5 min. */
export function entregaHttp(url: string, f: typeof fetch = globalThis.fetch): (texto: string) => Promise<string[]> {
  return async (texto) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 300_000);
    try {
      const r = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, origem: 'painel' }), signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as { respostas?: unknown; resposta?: unknown };
      if (Array.isArray(j.respostas)) return j.respostas.map(String);
      return typeof j.resposta === 'string' ? [j.resposta] : [];
    } finally { clearTimeout(t); }
  };
}
