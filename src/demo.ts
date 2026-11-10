// Modo demonstração (PAINEL_DEMO=1): dados INVENTADOS e plausíveis para os 9
// grupos, para dar print, gravar vídeo ou mostrar o painel sem expor nada da
// máquina. Nenhum arquivo, comando ou rede é tocado. Os nomes são de mentira.
import { avaliarAlertas, type GruposColetados } from './alertas.js';
import { montarEsperando, type Painel } from './agregador.js';
import type { ConfigPainel } from './config.js';
import type { BotLido } from './fontes/bots.js';
import type { DadosMaquina } from './fontes/maquina.js';
import type { DadosProducao, Rodada } from './fontes/producao.js';
import type { Fila, ItemFila, EstadoItem } from './fontes/filas.js';
import type { Upload } from './fontes/publicacao.js';
import type { Mensagem } from './fontes/sessoes.js';
import type { DadosVagas } from './fontes/vagas.js';
import type { Grupo } from './tipos.js';
import { inicioDoDia } from './util.js';

const H = 3600, M = 60;

function rodada(unidade: string, inicio: number, dur: number | null, resultado: string | null, agora: number, motivo: string | null = null): Rodada {
  const fim = dur === null ? null : inicio + dur;
  const aberta = fim === null ? Math.round((agora - inicio) / 60) : null;
  return { unidade, edicao: null, inicio, fim, resultado: fim === null ? null : resultado, motivo, url: null, dur_s: dur, presa: aberta !== null && aberta > 90, aberta_min: aberta };
}

function item(id: string, nome: string, estado: EstadoItem, quando: number | null, extra: Partial<ItemFila> = {}): ItemFila {
  return { id, nome, estado, original: estado, canal: null, quando, tentativas: null, erro: null, arquivo: null, ...extra };
}

function fila(chave: string, nome: string, onde: string, quem: string, itens: ItemFila[], problema: string | null = null): Fila {
  const por = { pendente: 0, publicando: 0, feito: 0, erro: 0, retirado: 0 } as Record<EstadoItem, number>;
  for (const i of itens) por[i.estado]++;
  return { chave, nome, onde, quem, total: itens.length, por_estado: por, itens, problema };
}

const SID = (n: number) => `0de30000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function sessoesDemo(agora: number) {
  const base = (n: number, projeto: string, fisica: boolean, quem: string, min: number, ctx: number, modelo: string, pedido: string, resposta: string, tmux: string | null) => ({
    session_id: SID(n), pid: 40000 + n, cwd: `~/projetos/${projeto}`, projeto, inicio: agora - min * M, tipo: fisica ? 'interativo' : 'headless', tty: fisica ? `/dev/pts/${n}` : null,
    origem: { tipo: fisica ? 'fisica' as const : 'agente' as const, quem, unidade: fisica ? null : `${quem.split(' ').pop()}.service`, cadeia: fisica ? ['bash', 'tmux'] : ['robo.sh', 'node'] },
    entrada: fisica ? 'cli' : 'sdk-cli',
    retrato: { em: agora - 40, modelo, esforco: 'medium', ctx_pct: ctx, ctx_tokens: ctx * 2000, ctx_janela: 200000, custo_usd: Math.round(ctx * 4.3) / 100, linhas_mais: ctx * 7, linhas_menos: ctx * 2, versao: '2.1.0' },
    processo: { cpu: fisica ? 3.1 : 12.4, mem_mb: 380 + n * 20, rodando_s: min * 60 },
    transcript: { ultima_atividade: agora - (n * 47) % 900, tamanho_mb: 1.2 + n / 2, ultimo_pedido: pedido, ultima_resposta: resposta, modelo },
    tmux,
  });
  return {
    vivos: [
      base(1, 'projeto-a', true, 'você no terminal (pts/1)', 95, 42, 'Opus', 'Ajusta o teste da fila e roda de novo', 'Pronto: os 12 testes passam.', '%1'),
      base(2, 'site-exemplo', true, 'você no terminal (pts/2)', 30, 71, 'Sonnet', 'Troca a cor do botão de entrar', 'Troquei e conferi no celular.', null),
      base(3, 'robo-diario', false, 'timer robo-diario', 12, 18, 'Sonnet', 'Gere o resumo do dia a partir das notas', 'Resumo gravado em saida/hoje.md', '%3'),
      base(4, 'relatorio-semanal', false, 'bot de tarefas', 48, 88, 'Opus', 'Monte o relatório da semana com os números', 'Faltam os dados de domingo; esperando.', null),
      base(5, 'notas', true, 'você no terminal (SSH) (pts/5)', 210, 9, 'Haiku', 'Lista o que ficou pendente ontem', '3 itens pendentes, todos anotados.', '%5'),
      base(6, 'traducoes', false, 'outra sessão do Claude (processo 40001)', 6, 33, 'Sonnet', 'Traduza o capítulo 2 para o inglês', 'Capítulo 2 traduzido (14 parágrafos).', null),
    ],
    interrompidos: [
      { session_id: SID(9), pid: null, cwd: '~/projetos/projeto-b', projeto: 'projeto-b', inicio: agora - 26 * H, tipo: 'interativo', tty: null,
        origem: { tipo: 'fisica' as const, quem: 'terminal (processo já fechado)', unidade: null, cadeia: [] }, entrada: 'cli', retrato: null, processo: null,
        transcript: { ultima_atividade: agora - 25 * H, tamanho_mb: 3.4, ultimo_pedido: 'Continua a migração do banco', ultima_resposta: 'Migração na tabela 3 de 5…', modelo: 'Opus' }, tmux: null },
    ],
  };
}

/** O painel inteiro, inventado. */
export function painelDemo(agora: number, versao: string, cfg: ConfigPainel): Painel {
  const ok = <T>(dados: T): Grupo<T> => ({ ok: true, gerado_em: agora, dados });
  const hoje = inicioDoDia(agora);
  const cedo = Math.max(hoje + 60, agora - 8 * H);

  const maquina: DadosMaquina = {
    memoria: { total_gb: 64, disponivel_gb: 27.4, swap_usado_gb: 0.3 },
    carga: { m1: 3.42, m5: 2.9, m15: 2.61, nucleos: 16 },
    disco: { total_gb: 1000, livre_gb: 214, usado_pct: 79 },
    boot_em: agora - 3 * 86400 - 5 * H,
    reinicios: { em: [agora - 20 * 86400, agora - 9 * 86400, agora - 3 * 86400 - 5 * H] },
    gpu_oom: { ultimas_24h: 1, ultima_hora: 0, ultima_em: agora - 7 * H },
  };

  const bots: BotLido[] = [
    { nome: 'bot-atendimento', jobs: { rodando: 1, na_fila: 3, criados_hoje: 57, por_estado: { done: 412, running: 1, queued: 3, failed: 2 } },
      falhas_24h: [{ id: 4821, tarefa: 'responder', fila: 'mensagens', quando: agora - 2 * H, erro: 'tempo esgotado ao chamar o modelo (60 s)' }] },
    { nome: 'bot-tarefas', jobs: { rodando: 2, na_fila: 1, criados_hoje: 14, por_estado: { feito: 120, rodando: 2, pendente: 1 } }, falhas_24h: [] },
  ];

  const producao: DadosProducao = {
    hoje: [
      rodada('robo-diario', agora - 40 * M, null, null, agora),
      rodada('relatorio-semanal', agora - 2 * H, 18 * M, 'ok', agora),
      rodada('backup-notas', agora - 3 * H, 4 * M, 'ok', agora),
      rodada('resumo-noticias', agora - 4 * H, 9 * M, 'falhou', agora, 'fonte RSS respondeu 503'),
      rodada('limpeza-disco', cedo, 2 * M, 'ok', agora),
    ],
    presas: [rodada('render-capas', agora - 2 * H - 10 * M, null, null, agora)],
    falhas: [rodada('resumo-noticias', agora - 4 * H, 9 * M, 'falhou', agora, 'fonte RSS respondeu 503')],
    esperas: [
      { chave: 'video-longo-12', pasta: '~/projetos/videos/12', estado: 'esperando', desde: agora - 3 * H, teto_h: 6, msg: null, resultado: null, passou_teto: false, recente: true },
      { chave: 'transcricao-aula-3', pasta: '~/projetos/aulas/3', estado: 'esperando', desde: agora - 9 * H, teto_h: 4, msg: null, resultado: null, passou_teto: true, recente: true },
    ],
    timers: [
      { unidade: 'robo-diario', proxima: agora + 25 * M, ultima: agora - 40 * M },
      { unidade: 'backup-notas', proxima: agora + 2 * H, ultima: agora - 3 * H },
      { unidade: 'resumo-noticias', proxima: agora + 4 * H, ultima: agora - 4 * H },
      { unidade: 'limpeza-disco', proxima: agora + 20 * H, ultima: cedo },
    ],
  };

  const up = (h: number, canal: string, titulo: string, n: number): Upload => ({ quando: agora - h * H, canal, video_id: null, url: `https://exemplo.com/videos/${n}`, titulo, publico: true, thumb_ok: true, miniatura: null });
  const ultimos = [up(1, 'canal-principal', 'Como organizar agentes em 5 minutos', 31), up(3, 'canal-cortes', 'Corte: o erro mais comum com filas', 30), up(5, 'canal-principal', 'Painel de agentes: tour completo', 29), up(26, 'canal-cortes', 'Corte: senha forte em 1 comando', 28), up(50, 'canal-principal', 'Três jeitos de vigiar um timer', 27)];
  const filas: Fila[] = [
    fila('fila-videos', 'Fila de vídeos', '~/filas/videos.json', 'timer fila-videos: 9, 13 e 18 h', [
      item('v-12', 'Tour do painel (versão curta)', 'publicando', agora - 5 * M, { canal: 'canal-principal', tentativas: 1 }),
      item('v-13', 'Filas sem dor de cabeça', 'erro', agora - 3 * H, { canal: 'canal-cortes', tentativas: 3, erro: 'envio recusado: título acima de 100 caracteres' }),
      item('v-14', 'Como ler os alertas', 'pendente', agora + 4 * H, { canal: 'canal-principal' }),
      item('v-15', 'Vagas de GPU explicadas', 'pendente', agora + 9 * H, { canal: 'canal-cortes' }),
      item('v-11', 'Assumir uma sessão com segurança', 'feito', agora - 22 * H, { canal: 'canal-principal' }),
      item('v-10', 'O modo Jarvis', 'feito', agora - 46 * H, { canal: 'canal-principal' }),
    ]),
    fila('fila-posts', 'Posts agendados', '~/filas/posts.txt', 'à mão, sem timer', [
      item('post-semana', 'post-semana', 'pendente', null), item('post-dica-3', 'post-dica-3', 'pendente', null),
    ]),
    fila('esperas', 'Esperas longas', '~/filas/esperas.json', 'vigia de esperas: a cada 5 min', [
      item('video-longo-12', 'video-longo-12', 'pendente', agora - 3 * H),
      item('transcricao-aula-3', 'transcricao-aula-3', 'pendente', agora - 9 * H),
      item('render-9', 'render-9', 'retirado', agora - 30 * H),
    ]),
  ];
  const semana = { 'canal-principal': 9, 'canal-cortes': 6 };

  const creditos = {
    claude: { limites: [{ nome: '5 horas', pct: 37, reset_em: agora + 2 * H }, { nome: 'Semana (todos)', pct: 64, reset_em: agora + 3 * 86400 }, { nome: 'Semana · Opus', pct: 83, reset_em: agora + 3 * 86400 }], idade_s: 120 },
    codex: { pct: 22, reset_em: agora + 4 * 86400, janela_h: 168, plano: 'pro', idade_s: 900 },
    avisos: [
      { titulo: 'Renovar o login do serviço de vídeo', ate: new Date((agora + 2 * 86400) * 1000).toISOString().slice(0, 10), nivel: 'aviso' as const, vencido: false, dias: 2 },
      { titulo: 'Trocar a senha do roteador', ate: null, nivel: 'info' as const, vencido: false, dias: null },
    ],
  };

  const sites = {
    desligado: false, checando: false, checado_em: agora - 90,
    sites: [
      { url: 'https://exemplo.com', ok: true, status: 200, ms: 182, erro: null, em: agora - 90 },
      { url: 'https://blog.exemplo.com', ok: true, status: 200, ms: 240, erro: null, em: agora - 90 },
      { url: 'https://api.exemplo.com/saude', ok: true, status: 204, ms: 95, erro: null, em: agora - 90 },
      { url: 'https://loja.exemplo.com', ok: false, status: 502, ms: 3011, erro: 'HTTP 502', em: agora - 90 },
    ],
  };

  const vagas: DadosVagas = {
    classes: [
      { classe: 'gpu', vagas: 1, teto: 2, ocupadas: 1, dono: 'render-capas', desde: agora - 2 * H, esperando: 1 },
      { classe: 'render', vagas: 2, teto: 4, ocupadas: 1, dono: 'robo-diario', desde: agora - 40 * M, esperando: 0 },
      { classe: 'claude', vagas: 4, teto: 6, ocupadas: 3, dono: 'robo-diario, bot-tarefas', desde: null, esperando: 0 },
      { classe: 'codex', vagas: 2, teto: 3, ocupadas: 0, dono: null, desde: null, esperando: 0 },
    ],
    pode_mudar: false, motivo_so_leitura: 'modo demonstração', dica: 'no terminal: vagas <classe> <n>',
    internas: { 'bot-atendimento': { mensagens: 2, arquivos: 1 } },
  };

  const t = sessoesDemo(agora);
  const terminais = { assumir: false, tmux_servidor: cfg.assumir.tmux_servidor, vivos: t.vivos, interrompidos: t.interrompidos };

  const g: GruposColetados = {
    maquina: ok(maquina),
    bots: ok({ bots, servicos: { 'bot-atendimento.service': 'active', 'bot-tarefas.service': 'active', 'vigia-esperas.service': 'failed' } }),
    producao: ok(producao),
    publicacao: ok({ hoje: 3, hoje_por_canal: { 'canal-principal': 2, 'canal-cortes': 1 }, semana_por_canal: semana, ultimos, filas_itens: filas }),
    creditos: ok(creditos),
    sites: ok(sites),
    terminais: ok(terminais),
  };
  const pend = [{ titulo: '09/11 · Revisar o texto da página de ajuda' }, { titulo: 'Testar o painel no celular' }, { titulo: 'Decidir o horário do backup' }];
  const itens = montarEsperando(g, pend);
  return {
    versao, gerado_em: agora, ms: 3, tela: { titulo: cfg.titulo, nome_falado: cfg.nome_falado, demo: true, chat: { bot: false, bot_nome: cfg.chat.bot_nome, novo_terminal: false, raiz: '~/projetos' } },
    grupos: { ...g, vagas: ok(vagas), esperando: ok({ itens }) },
    alertas: avaliarAlertas(g, agora, { memoriaGb: cfg.maquina.memoria_min_gb, discoPct: cfg.maquina.disco_max_pct }),
  };
}

/** Conversa inventada (aba Conteúdo). */
export function conversaDemo(id: string, agora: number): Mensagem[] {
  const s = sessoesDemo(agora).vivos.find((x) => x.session_id === id) ?? sessoesDemo(agora).interrompidos.find((x) => x.session_id === id);
  const p = s?.transcript?.ultimo_pedido ?? 'Olá';
  const r = s?.transcript?.ultima_resposta ?? 'Oi! Como posso ajudar?';
  return [
    { quando: agora - 600, quem: 'voce', texto: 'Lê o README e me diz o que falta para rodar os testes.' },
    { quando: agora - 590, quem: 'ferramenta', texto: 'Read: README.md' },
    { quando: agora - 585, quem: 'resultado', texto: '# projeto-exemplo … (84 linhas)' },
    { quando: agora - 580, quem: 'claude', texto: 'Falta instalar as dependências (npm ci). Depois é só npm test.' },
    { quando: agora - 300, quem: 'voce', texto: p },
    { quando: agora - 290, quem: 'ferramenta', texto: 'Bash: npm test' },
    { quando: agora - 240, quem: 'resultado', texto: 'Test Files 7 passed (7) · Tests 58 passed (58)' },
    { quando: agora - 230, quem: 'claude', texto: r },
  ];
}

/** Tela de terminal inventada (aba Terminal). */
export function telaDemo(id: string): string {
  return [`$ claude   # sessão ${id.slice(-4)} (demonstração)`, '', '> Ajusta o teste da fila e roda de novo', '', '● Bash(npm test)', '  ⎿  Test Files 7 passed (7)', '     Tests 58 passed (58)', '', '● Pronto: os 12 testes passam.', '', '> _'].join('\n');
}

/** Falha inventada (botão "ver resultado completo"). */
export function falhaDemo(bot: string, id: number): Record<string, unknown> {
  return { id, bot, status: 'failed', tarefa: 'responder', erro: 'tempo esgotado ao chamar o modelo (60 s)\n  em chamarModelo (fila.js:88)', resultado: '(sem resultado: o job falhou antes de responder)' };
}
