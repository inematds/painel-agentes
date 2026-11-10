// Ajudantes só dos testes (fora do build): deps com config inventada e servidor em porta livre.
import { mkdtempSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Sessoes } from './auth/sessoes.js';
import { normalizarConfig } from './config.js';
import { criarServidorPainel } from './servidor-painel.js';
import { depsPadrao, type DepsPainel } from './tipos.js';
import { Cache, type Executor } from './util.js';

export const semExec: Executor = async () => ({ ok: false, stdout: '', stderr: '', codigo: null, erro: 'ausente' });

/** Deps de teste: config a partir de `bruto` com `~` = uma pasta temporária nova. */
export function depsTeste(bruto: Record<string, unknown> = {}, extra: Partial<DepsPainel> = {}): DepsPainel & { casa: string } {
  const casa = mkdtempSync(join(tmpdir(), 'painel-casa-'));
  const cfg = normalizarConfig({ pasta_dados: join(casa, 'dados'), ...bruto }, casa);
  return { ...depsPadrao({ versao: 't', cfg, exec: semExec, cache: new Cache(), fetch: (async () => { throw new Error('sem rede no teste'); }) as typeof fetch, assumir: false, ...extra }), casa };
}

export async function abrirDemo(): Promise<{ base: string; fechar: () => Promise<void> }> {
  const deps = depsTeste({}, { demo: true });
  const srv = criarServidorPainel({ deps, sessoes: new Sessoes(null) });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  return { base, fechar: () => new Promise((r) => srv.close(() => r())) };
}
