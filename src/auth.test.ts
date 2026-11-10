import { createSign, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { VerificadorAccess, hostTime } from './auth/cf-access.js';
import { conferirSenha, gerarHash, gravarHash, lerHash } from './auth/senha.js';
import { Limitador, Sessoes } from './auth/sessoes.js';
import { bindEfetivo, criarServidorPainel, ligarServidorPainel } from './servidor-painel.js';
import { depsTeste } from './teste-ajuda.test-util.js';
import type { Executor } from './util.js';

const dir = mkdtempSync(join(tmpdir(), 'painel-auth-'));
const arqSenha = join(dir, 'painel-senha.json');
const SENHA = 'senha-de-teste-forte-123';
const T = Math.floor(Date.now() / 1000);

// ---------- JWT de teste (chave local; nada vai ao Cloudflare) ----------
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const certsFetch = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as unknown as typeof fetch;
const ACCESS = { aud: 'aud-painel', time: 'meutime', emails: ['ana@exemplo.com'] };
function jwt(corpo: Record<string, unknown>, kid = 'k1', chave = privateKey): string {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const dados = `${b({ alg: 'RS256', kid, typ: 'JWT' })}.${b(corpo)}`;
  const s = createSign('RSA-SHA256'); s.update(dados);
  return `${dados}.${s.sign(chave).toString('base64url')}`;
}
const corpoOk = { aud: ['aud-painel'], email: 'Ana@exemplo.com', exp: T + 600, iat: T, iss: hostTime('meutime') };

describe('senha', () => {
  it('scrypt confere a certa, recusa a errada e grava 600 sem a senha em claro', async () => {
    const h = await gerarHash(SENHA);
    expect(await conferirSenha(SENHA, h)).toBe(true);
    expect(await conferirSenha('outra', h)).toBe(false);
    expect(await conferirSenha('', h)).toBe(false);
    gravarHash(h, arqSenha);
    expect(statSync(arqSenha).mode & 0o777).toBe(0o600);
    expect(readFileSync(arqSenha, 'utf8')).not.toContain(SENHA);
    expect(lerHash(arqSenha)?.salt).toBe(h.salt);
  });
  it('bind fora do loopback sem senha é recusado', () => {
    expect(bindEfetivo('0.0.0.0', false)).toEqual({ bind: '127.0.0.1', recusado: true });
    expect(bindEfetivo('0.0.0.0', true)).toEqual({ bind: '0.0.0.0', recusado: false });
    expect(bindEfetivo(undefined, false)).toEqual({ bind: '127.0.0.1', recusado: false });
  });
  it('sessão sobrevive a reinício (arquivo 600 só com hash) e cai quando a senha muda', () => {
    const arq = join(dir, 'sessoes.json');
    const a = new Sessoes(arq);
    const tok = a.criar('salt-1');
    expect(readFileSync(arq, 'utf8')).not.toContain(tok);
    expect(statSync(arq).mode & 0o777).toBe(0o600);
    const b = new Sessoes(arq);
    expect(b.valida(tok, 'salt-1')).toBe(true);
    expect(b.valida(tok, 'salt-2')).toBe(false);
    expect(b.valida('inventado', 'salt-1')).toBe(false);
  });
  it('limitador: 5 erros em 15 min bloqueiam 15 min', () => {
    let t = 1000;
    const l = new Limitador(5, 900, 900, () => t);
    for (let i = 0; i < 4; i++) l.errou('1.2.3.4');
    expect(l.bloqueado('1.2.3.4')).toBe(0);
    l.errou('1.2.3.4');
    expect(l.bloqueado('1.2.3.4')).toBe(900);
    expect(l.bloqueado('5.6.7.8')).toBe(0);
    t += 901;
    expect(l.bloqueado('1.2.3.4')).toBe(0);
  });
});

describe('Cloudflare Access (JWT local)', () => {
  const v = () => new VerificadorAccess(ACCESS, certsFetch, () => T);
  it('válido → e-mail', async () => { expect(await v().conferir(jwt(corpoOk))).toBe('ana@exemplo.com'); });
  it('expirado, aud errado, e-mail fora da lista, assinatura de outra chave, kid errado → recusa', async () => {
    const outra = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    const casos: [string, string][] = [
      [jwt({ ...corpoOk, exp: T - 1 }), 'expirado'],
      [jwt({ ...corpoOk, aud: ['outro'] }), 'aud'],
      [jwt({ ...corpoOk, email: 'intruso@exemplo.com' }), 'e-mail fora da lista'],
      [jwt(corpoOk, 'k1', outra), 'assinatura'],
      [jwt(corpoOk, 'k9'), 'kid desconhecido'],
      [jwt({ ...corpoOk, iss: 'https://outro.cloudflareaccess.com' }), 'iss'],
      ['a.b', 'formato'],
    ];
    for (const [t, motivo] of casos) {
      const x = v();
      expect(await x.conferir(t), motivo).toBeNull();
      expect(x.ultimoMotivo).toBe(motivo);
    }
  });
});

describe('servidor do painel (porta própria com login)', () => {
  let srv: Server; let base = '';
  const chamadas: string[][] = [];
  beforeAll(async () => {
    gravarHash(await gerarHash(SENHA), arqSenha);
    const vj = join(dir, 'vagas.json');
    writeFileSync(vj, JSON.stringify({ gpu: 1, _teto: { gpu: 2 } }));
    const script = join(dir, 'vagas'); writeFileSync(script, '#!/bin/sh\n');
    const exec: Executor = async (cmd, args) => {
      if (cmd !== script) return { ok: false, stdout: '', stderr: '', codigo: null };
      chamadas.push([cmd, ...args]); return { ok: true, stdout: 'ok', stderr: '', codigo: 0 };
    };
    const deps = depsTeste({ vagas: { arquivo: vj, mudar_comando: script } }, { exec, agora: () => T, fetch: certsFetch });
    srv = criarServidorPainel({ deps, sessoes: new Sessoes(null), arqSenha, access: new VerificadorAccess(ACCESS, certsFetch, () => T) });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise((r) => srv.close(r)); });

  const login = (senha: string, ip: string) => fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': ip }, body: new URLSearchParams({ senha }).toString() });

  it('sem sessão: tela vai ao login, API dá 401; cabeçalhos de segurança', async () => {
    const t = await fetch(`${base}/painel`, { redirect: 'manual' });
    expect(t.status).toBe(303);
    expect(t.headers.get('location')).toBe('/login');
    expect(t.headers.get('x-frame-options')).toBe('DENY');
    // no-referrer faria o navegador mandar `Origin: null` no POST do login (recusado como outra origem).
    expect(t.headers.get('referrer-policy')).toBe('same-origin');
    expect(t.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    const a = await fetch(`${base}/api/painel`);
    expect(a.status).toBe(401);
    expect(((await a.json()) as { login: boolean }).login).toBe(true);
    expect((await fetch(`${base}/login`)).status).toBe(200);
  });
  it('rotas fora da lista dão 404 mesmo com sessão', async () => {
    const r = await login(SENHA, '10.0.0.1');
    const ck = (r.headers.get('set-cookie') ?? '').split(';')[0];
    for (const p of ['/mensagem', '/api/fila', '/health', '/dashboard', '/api/custo']) {
      expect((await fetch(`${base}${p}`, { headers: { Cookie: ck } })).status, p).toBe(404);
      expect((await fetch(`${base}${p}`, { method: 'POST', headers: { Cookie: ck }, body: '{"texto":"x"}' })).status, p).toBe(404);
    }
  });
  it('senha errada 5× bloqueia o IP (até a certa vira 429); outro IP segue', async () => {
    for (let i = 0; i < 5; i++) expect((await login('errada', '10.9.9.9')).status).toBe(401);
    expect((await login(SENHA, '10.9.9.9')).status).toBe(429);
    expect((await login(SENHA, '10.9.9.8')).status).toBe(303);
  });
  it('sessão válida: 200, cookie HttpOnly/SameSite, Secure só via https do túnel; logout derruba', async () => {
    const r = await login(SENHA, '10.0.0.2');
    const sc = r.headers.get('set-cookie') ?? '';
    expect(sc).toMatch(/HttpOnly/); expect(sc).toMatch(/SameSite=Lax/); expect(sc).not.toMatch(/Secure/);
    const ck = sc.split(';')[0];
    expect((await fetch(`${base}/painel`, { headers: { Cookie: ck } })).status).toBe(200);
    const p = await fetch(`${base}/api/painel`, { headers: { Cookie: ck } });
    expect(p.status).toBe(200);
    expect(((await p.json()) as { sessao: { via: string } }).sessao.via).toBe('senha');
    const https = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '10.0.0.3' }, body: `senha=${encodeURIComponent(SENHA)}` });
    expect(https.headers.get('set-cookie')).toMatch(/Secure/);
    expect((await fetch(`${base}/logout`, { method: 'POST', redirect: 'manual', headers: { Cookie: ck } })).status).toBe(303);
    expect((await fetch(`${base}/api/painel`, { headers: { Cookie: ck } })).status).toBe(401);
  });
  it('POST /api/vagas: sem sessão 401; sem marca/Origin estranha 403 (CSRF); com sessão funciona sem Bearer', async () => {
    const ck = ((await login(SENHA, '10.0.0.4')).headers.get('set-cookie') ?? '').split(';')[0];
    const host = base.replace('http://', '');
    const post = (h: Record<string, string>) => fetch(`${base}/api/vagas`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: '{"classe":"gpu","valor":2}' });
    expect((await post({ 'X-Painel': '1' })).status).toBe(401);
    expect((await post({ Cookie: ck })).status).toBe(403);
    expect((await post({ Cookie: ck, 'X-Painel': '1', Origin: 'https://malicioso.example' })).status).toBe(403);
    expect(chamadas).toEqual([]);
    const ok = await post({ Cookie: ck, 'X-Painel': '1', Origin: `http://${host}` });
    expect(ok.status).toBe(200);
    expect(chamadas.length).toBe(1);
    expect(chamadas[0].slice(1)).toEqual(['gpu', '2']);
  });
  it('JWT do Access válido autentica sem senha; inválido não', async () => {
    expect((await fetch(`${base}/api/painel`, { headers: { 'Cf-Access-Jwt-Assertion': jwt(corpoOk) } })).status).toBe(200);
    expect((await fetch(`${base}/api/painel`, { headers: { 'Cf-Access-Jwt-Assertion': jwt({ ...corpoOk, exp: T - 5 }) } })).status).toBe(401);
    expect((await fetch(`${base}/api/painel`, { headers: { 'Cf-Access-Jwt-Assertion': jwt({ ...corpoOk, email: 'x@y.z' }) } })).status).toBe(401);
  });
  it('login de outra origem é recusado', async () => {
    const r = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://malicioso.example', 'X-Forwarded-For': '10.0.0.5' }, body: `senha=${encodeURIComponent(SENHA)}` });
    expect(r.status).toBe(403);
  });
});

describe('aparelho lembrado: 365 dias deslizantes', () => {
  const DIA = 86400;
  it('renova no máximo 1×/dia e só morre depois de 365 dias SEM uso', () => {
    let t = 1_000_000;
    const arq = join(dir, 'deslizante.json');
    const s = new Sessoes(arq, () => t);
    const tok = s.criar('salt');
    t += 3600; expect(s.conferir(tok, 'salt')).toEqual({ ok: true, renovar: false });
    t += DIA; expect(s.conferir(tok, 'salt')).toEqual({ ok: true, renovar: true });
    t += 60; expect(s.conferir(tok, 'salt')).toEqual({ ok: true, renovar: false });
    t += 300 * DIA; expect(s.conferir(tok, 'salt').ok).toBe(true);
    // Recriado (reinício do bot): lê do arquivo e continua valendo 300 dias depois do último uso.
    t += 300 * DIA;
    expect(new Sessoes(arq, () => t).conferir(tok, 'salt').ok).toBe(true);
    // Sem uso por mais de 365 dias: cai.
    t += 366 * DIA;
    expect(new Sessoes(arq, () => t).conferir(tok, 'salt').ok).toBe(false);
  });

  it('servidor: cookie de 1 ano, regravado ao renovar; vale após recriar o servidor; sair de todos', async () => {
    let t = T;
    const arq = join(dir, 'srv-sessoes.json');
    gravarHash(await gerarHash(SENHA), arqSenha);
    const deps = depsTeste({}, { agora: () => T });
    const subir = async () => {
      const s = criarServidorPainel({ deps, sessoes: new Sessoes(arq, () => t), arqSenha });
      await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
      return { s, b: `http://127.0.0.1:${(s.address() as AddressInfo).port}` };
    };
    const fechar = (s: Server) => new Promise((r) => s.close(r));
    let { s, b } = await subir();
    const entra = async (ip: string) => {
      const r = await fetch(`${b}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': ip }, body: new URLSearchParams({ username: 'painel', senha: SENHA }).toString() });
      return r.headers.get('set-cookie') ?? '';
    };
    const sc = await entra('10.1.0.1');
    expect(sc).toContain(`Max-Age=${365 * 86400}`);
    const ck = sc.split(';')[0];
    const pagina = await (await fetch(`${b}/login`)).text();
    expect(pagina).toContain('autocomplete="username"');
    expect(pagina).toContain('autocomplete="current-password"');
    expect(pagina).not.toMatch(/onpaste/i);
    t += 3600;
    const semRenovar = await fetch(`${b}/api/painel/sites`, { headers: { Cookie: ck } });
    expect(semRenovar.status).toBe(200);
    expect(semRenovar.headers.get('set-cookie')).toBeNull();
    t += 86400;
    const renovou = await fetch(`${b}/api/painel/sites`, { headers: { Cookie: ck } });
    expect(renovou.headers.get('set-cookie')).toContain(`Max-Age=${365 * 86400}`);
    // Reinício: servidor novo, sessões lidas do arquivo.
    await fechar(s);
    ({ s, b } = await subir());
    t += 200 * 86400;
    expect((await fetch(`${b}/api/painel/sites`, { headers: { Cookie: ck } })).status).toBe(200);
    const ck2 = (await entra('10.1.0.2')).split(';')[0];
    const ap = await (await fetch(`${b}/api/painel`, { headers: { Cookie: ck2 } })).json() as { sessao: { aparelhos: number } };
    expect(ap.sessao.aparelhos).toBe(2);
    // Sair de todos derruba os dois aparelhos.
    expect((await fetch(`${b}/logout?todos=1`, { method: 'POST', redirect: 'manual', headers: { Cookie: ck2 } })).status).toBe(303);
    expect((await fetch(`${b}/api/painel/sites`, { headers: { Cookie: ck } })).status).toBe(401);
    expect((await fetch(`${b}/api/painel/sites`, { headers: { Cookie: ck2 } })).status).toBe(401);
    // Sem sessão, ?todos=1 não derruba nada de ninguém.
    const ck3 = (await entra('10.1.0.3')).split(';')[0];
    await fetch(`${b}/logout?todos=1`, { method: 'POST', redirect: 'manual' });
    expect((await fetch(`${b}/api/painel/sites`, { headers: { Cookie: ck3 } })).status).toBe(200);
    await fechar(s);
  });
});

describe('bordas', () => {
  it('ligarServidorPainel com 0.0.0.0 e sem senha escuta só em 127.0.0.1 e loga "recusado"', async () => {
    const logs: string[] = [];
    const deps = depsTeste({}, { agora: () => T });
    const s = ligarServidorPainel({ deps, sessoes: new Sessoes(null), arqSenha: join(dir, 'nao-existe.json') }, 0, '0.0.0.0', (m) => logs.push(m));
    await new Promise<void>((r) => s.once('listening', () => r()));
    const end = s.address() as AddressInfo;
    await new Promise((r) => s.close(r));
    expect(end.address).toBe('127.0.0.1');
    expect(logs.join('\n')).toMatch(/recusado/);
  });
  it('cookie com "%" malformado não derruba o servidor (vira sem sessão)', async () => {
    const deps = depsTeste({}, { agora: () => T });
    gravarHash(await gerarHash(SENHA), arqSenha);
    const s = criarServidorPainel({ deps, sessoes: new Sessoes(null), arqSenha });
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
    const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    const l = await fetch(`${b}/login`, { headers: { Cookie: 'painel_sessao=%E0%A4%A' } });
    const a = await fetch(`${b}/api/painel`, { headers: { Cookie: 'painel_sessao=%E0%A4%A' } });
    await new Promise((r) => s.close(r));
    expect(l.status).toBe(200);
    expect(a.status).toBe(401);
  });
  it('Access com chaves que não carregam: no máximo 1 busca externa a cada 5 min', async () => {
    let n = 0; let t = T;
    const falha = (async () => { n++; throw new Error('fora'); }) as unknown as typeof fetch;
    const v = new VerificadorAccess(ACCESS, falha, () => t);
    for (let i = 0; i < 10; i++) expect(await v.conferir(jwt(corpoOk))).toBeNull();
    expect(n).toBe(1);
    t += 301;
    await v.conferir(jwt(corpoOk));
    expect(n).toBe(2);
  });
});

describe('sem senha definida', () => {
  it('login mostra como definir (503) e nada abre', async () => {
    const deps = depsTeste({}, { agora: () => T });
    const s = criarServidorPainel({ deps, sessoes: new Sessoes(null), arqSenha: join(dir, 'nao-existe.json') });
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
    const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    const l = await fetch(`${b}/login`);
    const txt = await l.text();
    const a = await fetch(`${b}/api/painel`);
    await new Promise((r) => s.close(r));
    expect(l.status).toBe(503);
    expect(txt).toContain('npm run senha');
    expect(a.status).toBe(401);
  });
});
