// Vagas: quantos processos pesados podem rodar juntos por classe (gpu, render,
// claude, codex…). Leitura de um arquivo JSON ({classe: n, _teto: {classe: max}})
// e, se configurado, de um comando de status em JSON; mais a concorrência interna
// (só leitura) que você descrever na config. A ÚNICA escrita do painel (fora o
// Assumir) é mudar vagas, e ela passa pelo seu comando `<mudar_comando> <classe> <n>`.
import { existsSync } from 'node:fs';

import type { Coleta, DepsPainel } from '../tipos.js';
import { lerJson } from '../util.js';

export interface Classe { classe: string; vagas: number | null; teto: number | null; ocupadas: number | null; dono: string | null; desde: unknown; esperando: number | null }

type VagasJson = Record<string, unknown> & { _teto?: Record<string, number> };

export function tetoDe(vj: VagasJson | null, classe: string): number | null {
  const t = vj?._teto?.[classe];
  return typeof t === 'number' && Number.isInteger(t) ? t : null;
}

/** Junta o status vivo do fila-vaga com o arquivo de configuração. */
export function montarClasses(status: unknown, vj: VagasJson | null): Classe[] {
  const porNome = new Map<string, Classe>();
  const base = (c: string): Classe => porNome.get(c) ?? { classe: c, vagas: null, teto: tetoDe(vj, c), ocupadas: null, dono: null, desde: null, esperando: null };
  if (vj) for (const [k, v] of Object.entries(vj)) if (!k.startsWith('_') && typeof v === 'number') porNome.set(k, { ...base(k), vagas: v });
  // Formatos aceitos: lista de classes, {classes: [...]}, {classes: {gpu: {...}}} (o do fila-vaga) ou {gpu: {...}}.
  const deObjeto = (o: Record<string, unknown>) => Object.entries(o).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v)).map(([k, v]) => ({ classe: k, ...(v as Record<string, unknown>) }));
  const cls = status && typeof status === 'object' && !Array.isArray(status) ? (status as { classes?: unknown }).classes : undefined;
  const lista: Record<string, unknown>[] = Array.isArray(status) ? status
    : Array.isArray(cls) ? cls as Record<string, unknown>[]
      : cls && typeof cls === 'object' ? deObjeto(cls as Record<string, unknown>)
        : status && typeof status === 'object' ? deObjeto(status as Record<string, unknown>) : [];
  for (const s of lista) {
    const c = String(s.classe ?? s.nome ?? '');
    if (!c) continue;
    const atual = base(c);
    const donos = Array.isArray(s.donos) && s.donos.length ? (s.donos as unknown[]).map((x) => (x && typeof x === 'object' ? String((x as { quem?: unknown }).quem ?? (x as { dono?: unknown }).dono ?? (x as { nome?: unknown }).nome ?? '?') : String(x))).join(', ') : null;
    const espera = Array.isArray(s.esperando) ? s.esperando.length : typeof s.esperando === 'number' ? s.esperando : null;
    porNome.set(c, {
      ...atual,
      vagas: typeof s.vagas === 'number' ? s.vagas : atual.vagas,
      teto: typeof s.teto === 'number' ? s.teto : atual.teto,
      ocupadas: typeof s.ocupadas === 'number' ? s.ocupadas : Array.isArray(s.ocupadas) ? s.ocupadas.length : null,
      dono: typeof s.dono === 'string' ? s.dono : donos,
      desde: s.desde ?? (Array.isArray(s.donos) && s.donos[0] && typeof s.donos[0] === 'object' ? (s.donos[0] as { desde?: unknown }).desde ?? null : null), esperando: espera,
    });
  }
  const ordem = ['gpu', 'render', 'estudio', 'claude', 'codex'];
  return [...porNome.values()].sort((a, b) => (ordem.indexOf(a.classe) + 1 || 99) - (ordem.indexOf(b.classe) + 1 || 99));
}

export interface DadosVagas { classes: Classe[]; pode_mudar: boolean; motivo_so_leitura: string | null; dica: string; internas: Record<string, Record<string, number>> }

export async function coletarVagas(d: DepsPainel): Promise<Coleta<DadosVagas>> {
  const c = d.cfg.vagas;
  const ausentes: string[] = [];
  let vj: VagasJson | null = null;
  if (c.arquivo) { vj = lerJson<VagasJson>(c.arquivo); if (!vj) ausentes.push('arquivo de vagas'); }
  let status: unknown = null;
  const cmd = c.status_comando;
  if (cmd) {
    status = await d.cache.obter('vagas:status', 10_000, async () => {
      const r = await d.exec(cmd[0], cmd.slice(1), 4000);
      if (!r.stdout.trim()) return null;
      try { return JSON.parse(r.stdout) as unknown; } catch { return null; }
    });
    if (status === null) ausentes.push('comando de status das vagas');
  }
  const podeMudar = !d.demo && !!c.mudar_comando && !!c.arquivo && existsSync(c.mudar_comando);
  return {
    dados: {
      classes: montarClasses(status, vj),
      pode_mudar: podeMudar,
      motivo_so_leitura: podeMudar ? null : d.demo ? 'modo demonstração' : !c.mudar_comando ? 'sem mudar_comando na config' : 'comando de mudar vagas não encontrado',
      dica: c.mudar_comando ? `no terminal: ${c.mudar_comando.split('/').pop()} <classe> <n>` : 'edite o arquivo de vagas',
      internas: c.internas,
    },
    ausentes,
    naoConfigurado: !c.arquivo && !cmd && !Object.keys(c.internas).length,
  };
}

export type RespostaVagas = { status: number; corpo: Record<string, unknown> };

/** Valida e aplica `POST /api/vagas` (o servidor já conferiu sessão + CSRF). */
export async function mudarVagas(d: DepsPainel, corpoBruto: string): Promise<RespostaVagas> {
  if (d.demo) return { status: 403, corpo: { erro: 'modo demonstração: nada é gravado' } };
  const c = d.cfg.vagas;
  let b: { classe?: unknown; valor?: unknown };
  try { b = JSON.parse(corpoBruto || '{}') as typeof b; } catch { return { status: 400, corpo: { erro: 'JSON inválido' } }; }
  const classe = typeof b.classe === 'string' ? b.classe : '';
  const valor = b.valor;
  if (!/^[a-z][a-z0-9_-]{0,30}$/.test(classe)) return { status: 400, corpo: { erro: 'classe inválida' } };
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1) return { status: 400, corpo: { erro: 'valor tem de ser inteiro ≥ 1' } };
  const vj = c.arquivo ? lerJson<VagasJson>(c.arquivo) : null;
  if (!vj) return { status: 503, corpo: { erro: 'arquivo de vagas não encontrado' } };
  if (!Object.hasOwn(vj, classe) || typeof vj[classe] !== 'number') return { status: 400, corpo: { erro: `classe desconhecida: ${classe}` } };
  const teto = tetoDe(vj, classe);
  if (teto === null) return { status: 400, corpo: { erro: `sem teto definido para ${classe} no arquivo de vagas` } };
  if (valor > teto) return { status: 400, corpo: { erro: `acima do teto (${teto}) de ${classe}` } };
  if (!c.mudar_comando || !existsSync(c.mudar_comando)) return { status: 503, corpo: { erro: 'comando de mudar vagas não configurado' } };
  const r = await d.exec(c.mudar_comando, [classe, String(valor)], 8000);
  if (!r.ok) return { status: 500, corpo: { erro: 'o comando de vagas recusou', saida: (r.stderr || r.stdout || r.erro || '').slice(0, 500) } };
  // Sem isso a tela diria "Gravado" e mostraria o valor antigo por até 5 s (cache do painel).
  d.cache.apagar('vagas:status'); d.cache.apagar('painel');
  return { status: 200, corpo: { ok: true, classe, valor, saida: r.stdout.slice(0, 500) } };
}
