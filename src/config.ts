// Configuração do painel: tudo que é pessoal (caminhos, serviços, bancos, sites,
// nome falado, servidor tmux) vem daqui. Lida de `painel.config.json` (ou do
// caminho em PAINEL_CONFIG). Toda chave é opcional: sem ela, o grupo aparece
// como "não configurado" — nunca erro.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export type FormatoFila = 'json' | 'txt' | 'esperas';
export interface FilaCfg { chave: string; nome: string; arquivo: string; formato: FormatoFila; quem: string }
export interface BotCfg { nome: string; banco: string; tabela: string }

export interface ConfigPainel {
  /** Nome que aparece no topo da tela ("Painel <titulo>"). */
  titulo: string;
  /** Como o Jarvis chama você na saudação ("Bom dia, <nome>"). */
  nome_falado: string;
  porta: number;
  bind: string;
  /** Pasta da senha (hash), sessões e log do Assumir. */
  pasta_dados: string;
  maquina: { memoria_min_gb: number; disco_max_pct: number; gpu: boolean };
  /** Unidades do systemd do usuário a vigiar (systemctl --user is-active). */
  servicos: string[];
  /** Bancos SQLite de bots (abertos só para leitura). */
  bots: BotCfg[];
  producao: { rodadas: string | null; esperas: string | null; timers: boolean; timers_ignorar: string | null };
  publicacao: { historico: string | null; filas: FilaCfg[] };
  creditos: { limites_claude: string | null; sessoes_codex: string | null; avisos: string | null };
  sites: string[];
  vagas: { arquivo: string | null; status_comando: string[] | null; mudar_comando: string | null; internas: Record<string, Record<string, number>> };
  terminais: { sessoes_claude: string | null; projetos_claude: string | null; retratos: string | null; comando: string | null; unidades: Record<string, string> };
  assumir: { tmux_servidor: string };
  /** Gaveta "Conversar": bot opcional (POST {texto} → {respostas: [...]}) e "Novo terminal". */
  chat: { bot_nome: string; bot_url: string | null };
  novo_terminal: { raiz: string; lancador: string };
  pendencias: string | null;
}

/** `~/x` → caminho absoluto; vazio/ausente → null. */
export function expandir(p: unknown, home = homedir()): string | null {
  if (typeof p !== 'string' || !p.trim()) return null;
  const s = p.trim();
  if (s === '~') return home;
  if (s.startsWith('~/')) return resolve(home, s.slice(2));
  return resolve(s);
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const str = (v: unknown, padrao: string) => (typeof v === 'string' && v.trim() ? v.trim() : padrao);
const num = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);
const mapaTexto = (v: unknown): Record<string, string> => Object.fromEntries(Object.entries(obj(v)).filter(([, x]) => typeof x === 'string')) as Record<string, string>;

/** Monta a config final a partir do JSON bruto (tolerante: chave errada é ignorada). */
export function normalizarConfig(bruto: unknown, home = homedir()): ConfigPainel {
  const b = obj(bruto);
  const x = (p: unknown) => expandir(p, home);
  const def = (p: unknown, padrao: string) => (p === null ? null : x(p) ?? x(padrao));
  const chat = obj(b.chat), bot = obj(chat.bot), novo = obj(b.novo_terminal);
  const maq = obj(b.maquina), prod = obj(b.producao), pub = obj(b.publicacao), cred = obj(b.creditos), vag = obj(b.vagas), term = obj(b.terminais), ass = obj(b.assumir);
  const filas: FilaCfg[] = (Array.isArray(pub.filas) ? pub.filas : []).map(obj).flatMap((f, i) => {
    const arquivo = x(f.arquivo);
    if (!arquivo) return [];
    const formato: FormatoFila = f.formato === 'txt' || f.formato === 'esperas' ? f.formato : 'json';
    return [{ chave: str(f.chave, `fila${i + 1}`), nome: str(f.nome, str(f.chave, `Fila ${i + 1}`)), arquivo, formato, quem: str(f.quem, '–') }];
  });
  const bots: BotCfg[] = (Array.isArray(b.bots) ? b.bots : []).map(obj).flatMap((r, i) => {
    const banco = x(r.banco);
    return banco ? [{ nome: str(r.nome, `bot${i + 1}`), banco, tabela: /^[A-Za-z_]\w{0,40}$/.test(String(r.tabela ?? '')) ? String(r.tabela) : 'jobs' }] : [];
  });
  const internas: Record<string, Record<string, number>> = {};
  for (const [k, v] of Object.entries(obj(vag.internas))) {
    const m = Object.fromEntries(Object.entries(obj(v)).filter(([, n]) => typeof n === 'number')) as Record<string, number>;
    if (Object.keys(m).length) internas[k] = m;
  }
  const tmux = str(ass.tmux_servidor, 'painel');
  return {
    titulo: str(b.titulo, 'de agentes'),
    nome_falado: str(b.nome_falado, 'você'),
    porta: num(b.porta, 3143),
    bind: str(b.bind, '127.0.0.1'),
    pasta_dados: x(b.pasta_dados) ?? resolve(home, '.config/painel-agentes'),
    maquina: { memoria_min_gb: num(maq.memoria_min_gb, 1), disco_max_pct: num(maq.disco_max_pct, 90), gpu: maq.gpu !== false },
    servicos: lista(b.servicos),
    bots,
    producao: { rodadas: x(prod.rodadas), esperas: x(prod.esperas), timers: prod.timers === true, timers_ignorar: typeof prod.timers_ignorar === 'string' && prod.timers_ignorar ? prod.timers_ignorar : null },
    publicacao: { historico: x(pub.historico), filas },
    creditos: {
      limites_claude: x(cred.limites_claude),
      sessoes_codex: def(cred.sessoes_codex, '~/.codex/sessions'),
      avisos: def(cred.avisos, '~/.config/painel-agentes/avisos.json'),
    },
    sites: lista(b.sites).filter((s) => /^https?:\/\//.test(s)),
    vagas: {
      arquivo: x(vag.arquivo),
      status_comando: Array.isArray(vag.status_comando) && vag.status_comando.length ? lista(vag.status_comando).map((s, i) => (i === 0 ? x(s) ?? s : s)) : null,
      mudar_comando: x(vag.mudar_comando),
      internas,
    },
    terminais: {
      sessoes_claude: def(term.sessoes_claude, '~/.claude/sessions'),
      projetos_claude: def(term.projetos_claude, '~/.claude/projects'),
      retratos: x(term.retratos),
      comando: x(term.comando),
      unidades: mapaTexto(term.unidades),
    },
    assumir: { tmux_servidor: /^[\w.-]{1,40}$/.test(tmux) ? tmux : 'painel' },
    chat: { bot_nome: str(bot.nome, 'Bot'), bot_url: typeof bot.url === 'string' && /^https?:\/\//.test(bot.url) ? bot.url : null },
    novo_terminal: { raiz: x(novo.raiz) ?? resolve(home, 'projetos'), lancador: str(novo.lancador, 'claude') },
    pendencias: x(b.pendencias),
  };
}

/** Lê o arquivo de config (PAINEL_CONFIG ou ./painel.config.json). Arquivo ausente = config vazia. */
export function carregarConfig(arq = process.env.PAINEL_CONFIG || resolve(process.cwd(), 'painel.config.json')): { cfg: ConfigPainel; arquivo: string | null; erro?: string } {
  if (!existsSync(arq)) return { cfg: normalizarConfig({}), arquivo: null };
  try {
    return { cfg: normalizarConfig(JSON.parse(readFileSync(arq, 'utf8'))), arquivo: arq };
  } catch (e) {
    return { cfg: normalizarConfig({}), arquivo: arq, erro: (e as Error).message };
  }
}
