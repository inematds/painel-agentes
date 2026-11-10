// Login pelo Google via Cloudflare Access (desligado sem PAINEL_CF_ACCESS_AUD
// e PAINEL_CF_ACCESS_TEAM). O túnel entrega `Cf-Access-Jwt-Assertion`; aqui a
// assinatura RS256 é conferida contra as chaves públicas do time (cache 1 h),
// mais `aud`, `iss`, `exp`/`nbf` e o e-mail na lista PAINEL_EMAILS.
import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

export interface ConfigAccess { aud: string; time: string; emails: string[] }

export function configAccess(env = process.env): ConfigAccess | null {
  const aud = env.PAINEL_CF_ACCESS_AUD?.trim();
  const time = env.PAINEL_CF_ACCESS_TEAM?.trim();
  if (!aud || !time) return null;
  const emails = (env.PAINEL_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return { aud, time, emails };
}

/** "meutime" → https://meutime.cloudflareaccess.com ; "x.cloudflareaccess.com" fica como está. */
export function hostTime(time: string): string {
  const h = time.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return `https://${h.includes('.') ? h : `${h}.cloudflareaccess.com`}`;
}

const b64 = (s: string) => Buffer.from(s, 'base64url');

export class VerificadorAccess {
  private chaves: { em: number; keys: (JsonWebKey & { kid?: string })[] } | null = null;
  private ultimaBusca = 0;

  constructor(private readonly cfg: ConfigAccess, private readonly f: typeof fetch = globalThis.fetch, private readonly agora: () => number = () => Math.floor(Date.now() / 1000)) {}

  private async certs(forcar: boolean): Promise<(JsonWebKey & { kid?: string })[]> {
    const t = this.agora();
    if (this.chaves && !forcar && t - this.chaves.em < 3600) return this.chaves.keys;
    // Freio de 5 min entre buscas — também quando as chaves nunca carregaram (time errado ou Cloudflare fora):
    // sem isso, cada pedido com o cabeçalho faria 2 buscas externas de até 8 s.
    if (t - this.ultimaBusca < 300 && (forcar || !this.chaves)) return this.chaves?.keys ?? [];
    this.ultimaBusca = t;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await this.f(`${hostTime(this.cfg.time)}/cdn-cgi/access/certs`, { signal: ctl.signal });
      const j = await r.json() as { keys?: (JsonWebKey & { kid?: string })[] };
      if (Array.isArray(j.keys) && j.keys.length) this.chaves = { em: t, keys: j.keys };
    } catch { /* fica com as chaves antigas */ } finally { clearTimeout(timer); }
    return this.chaves?.keys ?? [];
  }

  /** E-mail autenticado, ou `null` (com o motivo em `ultimoMotivo`). */
  ultimoMotivo = '';
  async conferir(jwt: string | undefined): Promise<string | null> {
    const falha = (m: string) => { this.ultimoMotivo = m; return null; };
    if (!jwt || jwt.length > 8192) return falha('sem jwt');
    const partes = jwt.split('.');
    if (partes.length !== 3) return falha('formato');
    let cab: { alg?: string; kid?: string }, corpo: { aud?: string | string[]; exp?: number; nbf?: number; iss?: string; email?: string };
    try { cab = JSON.parse(b64(partes[0]).toString('utf8')); corpo = JSON.parse(b64(partes[1]).toString('utf8')); } catch { return falha('json'); }
    if (cab.alg !== 'RS256') return falha('alg');
    let chave = (await this.certs(false)).find((k) => k.kid === cab.kid);
    if (!chave) chave = (await this.certs(true)).find((k) => k.kid === cab.kid);
    if (!chave) return falha('kid desconhecido');
    let ok = false;
    try { ok = verify('RSA-SHA256', Buffer.from(`${partes[0]}.${partes[1]}`), createPublicKey({ key: chave, format: 'jwk' }), b64(partes[2])); } catch { ok = false; }
    if (!ok) return falha('assinatura');
    const t = this.agora();
    const auds = Array.isArray(corpo.aud) ? corpo.aud : [corpo.aud];
    if (!auds.includes(this.cfg.aud)) return falha('aud');
    if (typeof corpo.exp !== 'number' || corpo.exp <= t) return falha('expirado');
    if (typeof corpo.nbf === 'number' && corpo.nbf > t + 60) return falha('nbf');
    if (corpo.iss && corpo.iss.replace(/\/$/, '') !== hostTime(this.cfg.time)) return falha('iss');
    const email = String(corpo.email ?? '').toLowerCase();
    if (!email || !this.cfg.emails.includes(email)) return falha('e-mail fora da lista');
    this.ultimoMotivo = '';
    return email;
  }
}
