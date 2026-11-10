// Máquina: memória, carga, disco da raiz, boot, reinícios recentes e erros de
// memória da GPU. Tudo de /proc, statfs e journalctl (com cache longo).
import { readFileSync, statfsSync } from 'node:fs';
import { cpus } from 'node:os';

import type { DepsPainel } from '../tipos.js';

export interface DadosMaquina {
  memoria: { total_gb: number; disponivel_gb: number; swap_usado_gb: number; cache_gb?: number; livre_gb?: number } | null;
  carga: { m1: number; m5: number; m15: number; nucleos: number } | null;
  disco: { total_gb: number; livre_gb: number; usado_pct: number } | null;
  boot_em: number | null;
  reinicios: { em: number[]; erro?: string };
  gpu_oom: { ultimas_24h: number; ultima_hora: number; ultima_em: number | null; erro?: string };
}

const gb = (kb: number) => Math.round((kb / 1024 / 1024) * 10) / 10;

export function lerMeminfo(texto: string): DadosMaquina['memoria'] {
  const v: Record<string, number> = {};
  for (const l of texto.split('\n')) { const m = /^(\w+):\s+(\d+)/.exec(l); if (m) v[m[1]] = Number(m[2]); }
  if (!v.MemTotal) return null;
  return { total_gb: gb(v.MemTotal), disponivel_gb: gb(v.MemAvailable ?? v.MemFree ?? 0), swap_usado_gb: gb((v.SwapTotal ?? 0) - (v.SwapFree ?? 0)), cache_gb: gb(v.Cached ?? 0), livre_gb: gb(v.MemFree ?? 0) };
}

/** `journalctl --list-boots` (JSON ou texto): início de cada boot → epoch. */
export function lerBoots(texto: string): number[] {
  const out: number[] = [];
  try {
    const j = JSON.parse(texto) as { first_entry?: number }[];
    if (Array.isArray(j)) return j.map((b) => Math.round(Number(b.first_entry) / 1e6)).filter((n) => n > 0);
  } catch { /* texto */ }
  for (const l of texto.split('\n')) {
    const m = /\s(\w{3} )?(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})( [+-]?\d{2,4}|\s[A-Z]{2,5})?\s+(\w{3} )?\d{4}-\d{2}-\d{2}/.exec(l);
    if (!m) continue;
    const t = Date.parse(m[2].replace(' ', 'T'));
    if (Number.isFinite(t)) out.push(Math.round(t / 1000));
  }
  return out;
}

async function reinicios(d: DepsPainel): Promise<DadosMaquina['reinicios']> {
  return d.cache.obter('maq:boots', 10 * 60_000, async () => {
    const r = await d.exec('journalctl', ['--list-boots', '--no-pager', '-q', '-o', 'json'], 5000);
    if (!r.ok && !r.stdout) return { em: [], erro: /permission|not seeing/i.test(r.stderr) ? 'sem acesso' : 'sem dados' };
    const boots = lerBoots(r.stdout);
    return { em: boots.slice(-6) };
  });
}

async function gpuOom(d: DepsPainel): Promise<DadosMaquina['gpu_oom']> {
  return d.cache.obter('maq:gpu', 5 * 60_000, async () => {
    const r = await d.exec('journalctl', ['-k', '--since', '-24h', '--no-pager', '-q', '-o', 'short-unix', '-g', 'NVRM|NV_ERR_NO_MEMORY'], 8000);
    // journalctl sai 1 quando não há linha casando: isso é "zero", não erro.
    if (!r.ok && r.codigo !== 1) return { ultimas_24h: 0, ultima_hora: 0, ultima_em: null, erro: /permission|not seeing|insufficient/i.test(r.stderr) ? 'sem acesso' : 'sem dados' };
    const agora = d.agora();
    let n = 0, h = 0, ult: number | null = null;
    for (const l of r.stdout.split('\n')) {
      const m = /^(\d{9,11})(\.\d+)?\s/.exec(l);
      if (!m || !/NV_ERR_NO_MEMORY|Out of memory/i.test(l)) continue;
      const t = Number(m[1]); n++; if (agora - t < 3600) h++; ult = Math.max(ult ?? 0, t);
    }
    if (!r.stdout.trim() && /permission|not seeing/i.test(r.stderr)) return { ultimas_24h: 0, ultima_hora: 0, ultima_em: null, erro: 'sem acesso' };
    return { ultimas_24h: n, ultima_hora: h, ultima_em: ult };
  });
}

export async function coletarMaquina(d: DepsPainel): Promise<DadosMaquina> {
  let memoria: DadosMaquina['memoria'] = null, carga: DadosMaquina['carga'] = null, disco: DadosMaquina['disco'] = null, boot: number | null = null;
  try { memoria = lerMeminfo(readFileSync('/proc/meminfo', 'utf8')); } catch { /* sem /proc */ }
  try {
    const [a, b, c] = readFileSync('/proc/loadavg', 'utf8').split(' ').map(Number);
    carga = { m1: a, m5: b, m15: c, nucleos: cpus().length };
  } catch { /* idem */ }
  try {
    const s = statfsSync('/');
    const total = s.blocks * s.bsize, livre = s.bavail * s.bsize;
    disco = { total_gb: Math.round(total / 1e9), livre_gb: Math.round(livre / 1e9), usado_pct: Math.round(100 * (1 - livre / total)) };
  } catch { /* idem */ }
  // `btime` é fixo e inteiro (agora − uptime oscilaria 1 s e mudaria a chave do alerta de reinício).
  try { const m = /^btime (\d+)/m.exec(readFileSync('/proc/stat', 'utf8')); boot = m ? Number(m[1]) : null; } catch { /* idem */ }
  const semGpu = { ultimas_24h: 0, ultima_hora: 0, ultima_em: null, erro: 'desligado na config' };
  const [rb, g] = await Promise.all([reinicios(d), d.cfg.maquina.gpu ? gpuOom(d) : Promise.resolve(semGpu)]);
  return { memoria, carga, disco, boot_em: boot, reinicios: rb, gpu_oom: g };
}
