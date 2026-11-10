// Senha do painel: só o hash scrypt fica em disco (arquivo 600), nunca a senha.
// Conferência assíncrona (não trava o servidor) e em tempo constante.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

export interface HashSenha { algo: 'scrypt'; N: number; r: number; p: number; salt: string; hash: string; criado: string }

const PARAMS = { N: 16384, r: 8, p: 1 };
const TAM = 64;
export const SENHA_MIN = 12;

export function arquivoSenha(pasta = resolve(homedir(), '.config/painel-agentes')): string {
  return process.env.PAINEL_SENHA_ARQ || resolve(pasta, 'senha.json');
}

function scrypt(senha: string, salt: Buffer, o: { N: number; r: number; p: number }): Promise<Buffer> {
  const opts: ScryptOptions = { N: o.N, r: o.r, p: o.p, maxmem: 64 * 1024 * 1024 };
  return new Promise((ok, erro) => scryptCb(senha.normalize('NFKC'), salt, TAM, opts, (e, k) => (e ? erro(e) : ok(k))));
}

export async function gerarHash(senha: string): Promise<HashSenha> {
  const salt = randomBytes(16);
  const k = await scrypt(senha, salt, PARAMS);
  return { algo: 'scrypt', ...PARAMS, salt: salt.toString('base64'), hash: k.toString('base64'), criado: new Date().toISOString() };
}

export async function conferirSenha(senha: string, h: HashSenha | null): Promise<boolean> {
  if (!h || h.algo !== 'scrypt' || typeof senha !== 'string' || !senha || senha.length > 1024) return false;
  try {
    const alvo = Buffer.from(h.hash, 'base64');
    const k = await scrypt(senha, Buffer.from(h.salt, 'base64'), { N: h.N, r: h.r, p: h.p });
    return k.length === alvo.length && timingSafeEqual(k, alvo);
  } catch { return false; }
}

/** Lê o hash; `null` se não houver senha definida (ou arquivo inválido). */
export function lerHash(arq = arquivoSenha()): HashSenha | null {
  try {
    const h = JSON.parse(readFileSync(arq, 'utf8')) as HashSenha;
    return h && h.algo === 'scrypt' && h.salt && h.hash ? h : null;
  } catch { return null; }
}

export function temSenha(arq = arquivoSenha()): boolean { return lerHash(arq) !== null; }

/** Grava arquivo com modo 600 (troca atômica). */
export function gravar600(arq: string, conteudo: string): void {
  if (!existsSync(dirname(arq))) mkdirSync(dirname(arq), { recursive: true, mode: 0o700 });
  const tmp = `${arq}.${process.pid}.tmp`;
  writeFileSync(tmp, conteudo, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, arq);
}

export function gravarHash(h: HashSenha, arq = arquivoSenha()): void {
  gravar600(arq, JSON.stringify(h, null, 1) + '\n');
}

/** Senha forte aleatória (24 caracteres base64url = 144 bits). */
export function senhaAleatoria(): string { return randomBytes(18).toString('base64url'); }
