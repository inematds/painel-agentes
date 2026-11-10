// Sobe o painel sozinho (sem bot nenhum).
//   npm start                       lê ./painel.config.json (ou PAINEL_CONFIG)
//   PAINEL_DEMO=1 npm start         modo demonstração: dados inventados, sem login, só 127.0.0.1
// Variáveis: PAINEL_CONFIG, PAINEL_PORT, PAINEL_BIND, PAINEL_DEMO, PAINEL_ASSUMIR, PAINEL_CHAT,
// PAINEL_SENHA_ARQ, PAINEL_CF_ACCESS_AUD + PAINEL_CF_ACCESS_TEAM + PAINEL_EMAILS (opcional).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { configAccess, VerificadorAccess } from './auth/cf-access.js';
import { Sessoes } from './auth/sessoes.js';
import { carregarConfig } from './config.js';
import { Conversa, entregaHttp } from './conversa.js';
import { fecharBancos } from './fontes/bots.js';
import { ligarServidorPainel } from './servidor-painel.js';
import { depsPadrao } from './tipos.js';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let versao = '0.0.0';
try { versao = (JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')) as { version: string }).version; } catch { /* sem package.json */ }

const log = (m: string) => console.log(m);
const { cfg, arquivo, erro } = carregarConfig();
if (erro) log(`[painel] config ${arquivo} inválida (${erro}) — seguindo com a config vazia`);
else log(`[painel] config: ${arquivo ?? 'nenhuma (tudo não configurado; veja painel.config.exemplo.json)'}`);

const demo = process.env.PAINEL_DEMO === '1';
const porta = Number(process.env.PAINEL_PORT ?? cfg.porta);
const chatLigado = !demo && process.env.PAINEL_CHAT === '1' && !!cfg.chat.bot_url;
if (process.env.PAINEL_CHAT === '1' && !cfg.chat.bot_url) log('[painel] PAINEL_CHAT=1 sem chat.bot.url na config: conversa com bot fica desligada');
const conversa = chatLigado && cfg.chat.bot_url ? new Conversa(entregaHttp(cfg.chat.bot_url), join(cfg.pasta_dados, 'chat.log')) : undefined;
const deps = depsPadrao({ versao, cfg, demo, assumir: !demo && process.env.PAINEL_ASSUMIR === '1', conversa });
const cfa = demo ? null : configAccess();
const srv = ligarServidorPainel({
  deps,
  sessoes: new Sessoes(demo ? null : join(cfg.pasta_dados, 'sessoes.json')),
  access: cfa ? new VerificadorAccess(cfa) : null,
}, Number.isInteger(porta) && porta > 0 ? porta : 3143, process.env.PAINEL_BIND ?? cfg.bind, log);

const sair = () => { srv.close(); fecharBancos(); process.exit(0); };
process.on('SIGTERM', sair); process.on('SIGINT', sair);
