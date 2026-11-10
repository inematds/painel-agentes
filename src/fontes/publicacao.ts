// Publicação: histórico de envios (JSONL, só o fim do arquivo) e as filas da
// config. Registros antigos sem todos os campos são aceitos.
import type { Coleta, DepsPainel } from '../tipos.js';
import { coletarFilas } from './filas.js';
import { corta, inicioDoDia, lerFim, linhasJson, paraEpoch } from '../util.js';

const ID_YT = /^[\w-]{11}$/;
/** Erro em fila só vira alerta se o item for recente (o antigo fica só como contagem). */
export const JANELA_ERRO_FILA_S = 48 * 3600;

export interface Upload { quando: number; canal: string; video_id: string | null; url: string | null; titulo: string; publico: boolean | null; thumb_ok: boolean | null; miniatura: string | null }

/** Parser tolerante do historico.jsonl: ignora linha quebrada, aceita campo ausente. */
export function lerHistorico(texto: string): Upload[] {
  const out: Upload[] = [];
  for (const r of linhasJson<Record<string, unknown>>(texto)) {
    const quando = paraEpoch(r.data ?? r.quando ?? r.ts);
    if (quando === null) continue;
    let vid = typeof r.video_id === 'string' ? r.video_id : null;
    if (!vid && typeof r.url === 'string') vid = /(?:v=|shorts\/|youtu\.be\/)([\w-]{11})/.exec(r.url)?.[1] ?? null;
    if (vid && !ID_YT.test(vid)) vid = null;
    const priv = r.privacy as { privacyStatus?: string } | string | undefined;
    const ps = typeof priv === 'string' ? priv : priv?.privacyStatus;
    out.push({
      quando, canal: typeof r.canal === 'string' && r.canal ? r.canal : '?', video_id: vid,
      url: typeof r.url === 'string' ? r.url : (vid ? `https://www.youtube.com/watch?v=${vid}` : null),
      titulo: corta(r.titulo ?? '', 120), publico: ps ? ps === 'public' : null,
      thumb_ok: typeof r.thumb_ok === 'boolean' ? r.thumb_ok : null,
      miniatura: vid ? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` : null,
    });
  }
  return out.sort((a, b) => b.quando - a.quando);
}

export function coletarPublicacao(d: DepsPainel): Coleta<{ hoje: number; hoje_por_canal: Record<string, number>; semana_por_canal: Record<string, number>; ultimos: Upload[]; filas_itens: ReturnType<typeof coletarFilas> }> {
  const agora = d.agora();
  const ausentes: string[] = [];
  const c = d.cfg.publicacao;
  let hoje: Upload[] = [], semana: Record<string, number> = {}, ultimos: Upload[] = [];
  if (c.historico) {
    const texto = lerFim(c.historico, 384 * 1024);
    if (texto === null) ausentes.push('histórico de envios');
    else {
      const todos = lerHistorico(texto);
      const ini = inicioDoDia(agora);
      hoje = todos.filter((u) => u.quando >= ini);
      for (const u of todos.filter((x) => agora - x.quando < 7 * 86400)) semana[u.canal] = (semana[u.canal] ?? 0) + 1;
      semana = Object.fromEntries(Object.entries(semana).sort((a, b) => b[1] - a[1]));
      ultimos = todos.slice(0, 10);
    }
  }
  const hojePorCanal: Record<string, number> = {};
  for (const u of hoje) hojePorCanal[u.canal] = (hojePorCanal[u.canal] ?? 0) + 1;
  return {
    dados: { hoje: hoje.length, hoje_por_canal: hojePorCanal, semana_por_canal: semana, ultimos, filas_itens: coletarFilas(d) },
    ausentes, naoConfigurado: !c.historico && !c.filas.length,
  };
}
