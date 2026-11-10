// Página do painel clássico: HTML + CSS + JS inline, sem build nem CDN obrigatório
// (Sora/Inter do Google Fonts com fallback de sistema).
import { PAINEL_CSS } from './estilo.js';
import { JS_AJUDA, JS_LACO } from './script-base.js';
import { JS_GRUPOS } from './script-grupos.js';
import { CHAT_HTML, JS_CHAT } from './script-chat.js';

const GRUPOS = ['esperando', 'maquina', 'bots', 'producao', 'publicacao', 'creditos', 'sites', 'vagas', 'terminais'];

/** JS completo do cliente (exportado para o teste de sintaxe). */
export const PAINEL_JS = `(function(){'use strict';\n${JS_AJUDA}\n${JS_GRUPOS}\n${JS_CHAT}\n${JS_LACO}\n})();`;

const escH = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** HTML do painel clássico; `titulo` vem da config ("Painel <titulo>"). */
export const paginaPainel = (titulo = 'de agentes'): string => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Painel ${escH(titulo)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
<style>${PAINEL_CSS}</style></head>
<body><div class="app">
<header class="topo">
  <div class="marca"><h1>Painel <i>${escH(titulo)}</i></h1><span class="ver" id="ver">carregando…</span></div>
  <div class="ctl" role="group" aria-label="Como mostrar produção, publicação e terminais">
    <div class="seg"><button data-modo="lista" aria-pressed="true">Lista</button><button data-modo="icones" aria-pressed="false">Ícones</button><button data-modo="imagens" aria-pressed="false">Imagens</button></div>
    <button class="btn" id="voz" aria-pressed="false">Voz desligada</button>
    <button class="btn" id="conversar" title="Falar com o seu bot ou com um terminal">Conversar</button>
    <button class="btn" id="organizar" aria-pressed="false" title="Trocar os quadros de lugar (fica guardado neste aparelho)">Organizar</button>
    <button class="btn" id="restaurar" hidden>Restaurar padrão</button>
    <span id="dica-org" hidden>Toque num quadro e depois no lugar para onde ele vai (ou arraste). Clique Pronto ao terminar.</span>
    <a class="btn" href="/jarvis" style="text-decoration:none;display:inline-flex;align-items:center" title="Mesmos dados no visual JARVIS">Versão Jarvis</a>
    <span id="sair" hidden class="ctl"><form method="post" action="/logout"><button class="btn" type="submit">Sair deste aparelho</button></form><form method="post" action="/logout?todos=1" id="sair-todos"><button class="btn" type="submit" id="sair-todos-btn">Sair de todos</button></form></span>
  </div>
  <div class="relogio" id="hora">--:--<small id="data"></small></div>
</header>
<div class="faixa" id="faixa" role="status" aria-live="polite"><span class="calmo">Lendo o estado da máquina…</span></div>
<main class="grade">
${GRUPOS.map((g) => `  <div class="tile t-${g}" id="t-${g}" data-abrir="${g}" role="button" tabindex="0" aria-label="Abrir ${g}"></div>`).join('\n')}
</main>
</div>
<div class="folha" id="folha" role="dialog" aria-modal="true" aria-labelledby="folha-titulo">
  <div class="caixa"><div class="cabf"><h2 id="folha-titulo"></h2><button class="btn fechar" id="fechar">Fechar (Esc)</button></div>
  <div class="conteudo" id="folha-conteudo"></div></div>
</div>
${CHAT_HTML}
<script>${PAINEL_JS}</script>
</body></html>`;
