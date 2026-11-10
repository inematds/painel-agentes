// Contratos do painel: dependências injetadas (servidor real, modo demonstração
// e testes) e o formato de cada grupo do /api/painel.
import { normalizarConfig, type ConfigPainel } from './config.js';
import type { Conversa } from './conversa.js';
import { Cache, executar, type Executor } from './util.js';

export interface DepsPainel {
  versao: string;
  cfg: ConfigPainel;
  exec: Executor;
  /** Epoch em segundos. */
  agora: () => number;
  cache: Cache;
  /** `fetch` injetável (teste dos sites sem rede). */
  fetch: typeof fetch;
  /** Modo demonstração: dados inventados, sem login, sem escrita. */
  demo?: boolean;
  /** Assumir (digitar no terminal do agente) ligado? Só com PAINEL_ASSUMIR=1. */
  assumir?: boolean;
  /** Conversa com o seu bot (PAINEL_CHAT=1 + chat.bot.url). */
  conversa?: Conversa;
}

export function depsPadrao(p: Partial<DepsPainel> & { versao: string }): DepsPainel {
  return {
    cfg: normalizarConfig({}),
    exec: executar,
    agora: () => Math.floor(Date.now() / 1000),
    cache: new Cache(),
    fetch: globalThis.fetch,
    assumir: process.env.PAINEL_ASSUMIR === '1',
    ...p,
  };
}

export type NomeGrupo = 'maquina' | 'bots' | 'producao' | 'publicacao' | 'creditos' | 'sites' | 'vagas' | 'terminais' | 'esperando';

export interface Grupo<T = Record<string, unknown>> {
  ok: boolean;
  gerado_em: number;
  dados?: T;
  erro?: string;
  /** Nada deste grupo foi configurado (o cartão mostra "não configurado"). */
  nao_configurado?: boolean;
  /** Fontes configuradas que não existiam/sem acesso nesta leitura (o cartão mostra "sem dados"). */
  ausentes?: string[];
}

/** O que cada coletor devolve. */
export interface Coleta<T> { dados: T; ausentes: string[]; naoConfigurado?: boolean }

export type Nivel = 'erro' | 'aviso';
export interface AlertaPainel {
  /** Chave estável `regra:sujeito` — nunca com número que varia (a voz deduplica por ela). */
  chave: string;
  nivel: Nivel;
  grupo: NomeGrupo;
  texto: string;
}
