// Sessões do painel: token aleatório no cookie (HttpOnly); em memória e em
// arquivo 600 só o SHA-256 do token (quem lê o arquivo não ganha sessão).
// Trocar a senha derruba todas as sessões (cada sessão guarda o salt da senha).
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { gravar600 } from './senha.js';

/** 365 dias, deslizante: cada uso empurra a validade (regravada no máximo 1×/dia). */
export const VALIDADE_S = 365 * 86400;
export const RENOVA_S = 86400;
export const COOKIE = 'painel_sessao';

interface Registro { exp: number; salt: string; via: string; criado: number; renovado?: number }
export interface Conferencia { ok: boolean; renovar: boolean }

const sha = (t: string) => createHash('sha256').update(t).digest('hex');

export class Sessoes {
  private readonly mapa = new Map<string, Registro>();

  constructor(private readonly arq: string | null, private readonly agora: () => number = () => Math.floor(Date.now() / 1000)) {
    if (!arq) return;
    try {
      const j = JSON.parse(readFileSync(arq, 'utf8')) as Record<string, Registro>;
      for (const [h, r] of Object.entries(j)) if (r && r.exp > this.agora()) this.mapa.set(h, r);
    } catch { /* sem arquivo ainda */ }
  }

  private salvar(): void {
    if (!this.arq) return;
    try { gravar600(this.arq, JSON.stringify(Object.fromEntries(this.mapa))); } catch { /* a sessão continua em memória */ }
  }

  criar(saltSenha: string, via = 'senha'): string {
    const t = randomBytes(32).toString('base64url');
    const agora = this.agora();
    for (const [h, r] of this.mapa) if (r.exp <= agora) this.mapa.delete(h);
    this.mapa.set(sha(t), { exp: agora + VALIDADE_S, salt: saltSenha, via, criado: agora });
    this.salvar();
    return t;
  }

  /** Sessão válida para a senha atual? Se passou 1 dia desde a última renovação, estende 365 dias (`renovar` = regravar o cookie). */
  conferir(token: string | undefined, saltSenha: string | null): Conferencia {
    if (!token || !saltSenha || token.length > 200) return { ok: false, renovar: false };
    const h = sha(token);
    const r = this.mapa.get(h);
    if (!r) return { ok: false, renovar: false };
    const agora = this.agora();
    if (r.exp <= agora || r.salt !== saltSenha) { this.mapa.delete(h); this.salvar(); return { ok: false, renovar: false }; }
    if (agora - (r.renovado ?? r.criado) >= RENOVA_S) {
      r.exp = agora + VALIDADE_S; r.renovado = agora;
      this.salvar();
      return { ok: true, renovar: true };
    }
    return { ok: true, renovar: false };
  }

  valida(token: string | undefined, saltSenha: string | null): boolean { return this.conferir(token, saltSenha).ok; }

  encerrar(token: string | undefined): void {
    if (!token) return;
    if (this.mapa.delete(sha(token))) this.salvar();
  }

  /** "Sair de todos os aparelhos". */
  encerrarTodas(): number {
    const n = this.mapa.size;
    this.mapa.clear(); this.salvar();
    return n;
  }

  /** Sessões vivas da senha atual (para a tela mostrar quantos aparelhos). */
  contar(saltSenha: string | null): number {
    const agora = this.agora();
    let n = 0;
    for (const r of this.mapa.values()) if (r.exp > agora && r.salt === saltSenha) n++;
    return n;
  }

  get total(): number { return this.mapa.size; }
}

export function lerCookie(cabecalho: string | undefined, nome: string): string | undefined {
  if (!cabecalho) return undefined;
  for (const parte of cabecalho.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nome) {
      try { return decodeURIComponent(parte.slice(i + 1).trim()); } catch { return undefined; } // "%" malformado = sem cookie
    }
  }
  return undefined;
}

/** Limite de tentativas: 5 erros por IP em 15 min → 15 min bloqueado. */
export class Limitador {
  private readonly erros = new Map<string, number[]>();
  private readonly bloqueio = new Map<string, number>();
  constructor(private readonly max = 5, private readonly janelaS = 900, private readonly bloqueioS = 900, private readonly agora: () => number = () => Math.floor(Date.now() / 1000)) {}

  bloqueado(ip: string): number {
    const ate = this.bloqueio.get(ip) ?? 0;
    if (ate > this.agora()) return ate - this.agora();
    if (ate) this.bloqueio.delete(ip);
    return 0;
  }

  errou(ip: string): void {
    const t = this.agora();
    const l = (this.erros.get(ip) ?? []).filter((x) => t - x < this.janelaS);
    l.push(t);
    if (l.length >= this.max) { this.bloqueio.set(ip, t + this.bloqueioS); this.erros.delete(ip); } else this.erros.set(ip, l);
    if (this.erros.size > 5000) this.erros.clear();
  }

  acertou(ip: string): void { this.erros.delete(ip); }
}
