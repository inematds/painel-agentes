// CSS do painel (preto #0c0c10, amarelo #FACC15 só como marca/seleção,
// títulos Sora, corpo Inter). Feito para TV 1920×1080 sem rolagem e celular em
// uma coluna. Estado nunca só por cor: sempre com palavra ou símbolo junto.
export const PAINEL_CSS = String.raw`
:root{
  --bg:#0c0c10;--bg2:#14141b;--card:#16161e;--card2:#1b1b25;--line:#272730;--line2:#34343f;
  --txt:#e9e9ee;--mut:#9a9aa6;--fraco:#6f6f7c;--amb:#FACC15;--amb-ink:#1a1206;
  --ok:#7CE0C6;--warm:#F2B45C;--bad:#F0918A;--bad-bg:#2a1214;--bad-line:#6b2a2c;--warm-bg:#2a2112;
  --r-tile:14px;--r-ctl:10px;--gap:14px;
  font-size:clamp(14px,0.9vw,19px);
}
*{box-sizing:border-box}
[hidden]{display:none!important}
#sair form{margin:0}
html,body{margin:0;background:var(--bg);color:var(--txt)}
body{font:400 1rem/1.4 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-variant-numeric:tabular-nums;min-height:100vh}
h1,h2,h3,.sora{font-family:Sora,Inter,system-ui,sans-serif}
button{font:inherit;color:inherit}
:focus-visible{outline:3px solid var(--amb);outline-offset:2px}
a{color:var(--txt)}

.app{display:grid;grid-template-rows:auto auto 1fr;height:100vh;padding:var(--gap);gap:var(--gap)}
.topo{display:flex;align-items:center;gap:1.2rem;min-width:0}
.marca{display:flex;align-items:baseline;gap:.6rem;min-width:0}
.marca h1{margin:0;font-size:1.45rem;font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.marca h1 i{font-style:normal;color:var(--amb)}
.marca .ver{color:var(--fraco);font-size:.85rem;white-space:nowrap}
.relogio{margin-left:auto;font-family:Sora,Inter,sans-serif;font-size:1.9rem;font-weight:600;letter-spacing:-.02em;white-space:nowrap}
.relogio small{display:block;text-align:right;font:400 .8rem Inter,sans-serif;color:var(--mut);letter-spacing:0}
.ctl{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.seg{display:inline-flex;border:1px solid var(--line2);border-radius:999px;padding:3px;background:var(--bg2)}
.seg button{border:0;background:transparent;padding:.35rem .85rem;border-radius:999px;cursor:pointer;color:var(--mut);font-size:.9rem;min-height:36px}
.seg button[aria-pressed=true]{background:var(--amb);color:var(--amb-ink);font-weight:600}
.btn{border:1px solid var(--line2);background:var(--bg2);border-radius:var(--r-ctl);padding:.4rem .9rem;cursor:pointer;min-height:38px;font-size:.9rem}
.btn[aria-pressed=true]{border-color:var(--amb);color:var(--amb)}
.abas{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.term,.tic,.tcard{cursor:pointer;min-width:0}
.term{padding:.4rem 0;border-bottom:1px solid var(--line)}
.tt{font-size:.98rem;overflow-wrap:anywhere}
.tl{display:block;font-size:.82rem;color:var(--mut);overflow-wrap:anywhere;line-height:1.35}
.tics{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.6rem}
.tic{display:flex;gap:.6rem;align-items:flex-start;border:1px solid var(--line);border-radius:12px;padding:.55rem}
.tic>b{flex:none;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:#0c0c10;font-weight:700}
.tcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:.7rem}
.tcard{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--card)}
.tcard .img{height:70px;display:grid;place-items:center;font:700 2rem Sora,sans-serif;color:#0c0c10}
.tcard .txt{padding:.5rem .6rem}
.term:hover,.tic:hover,.tcard:hover{border-color:var(--amb)}
/* Quadro de terminais na visão geral: todas as sessões, rolando dentro do quadro, em colunas. */
.terms{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0 1.2rem}
.t-terminais .corpo{overflow-y:auto;scrollbar-width:thin;padding-right:.3rem}
.t-terminais .tcard{display:flex}
.t-terminais .tcard .img{height:auto;width:46px;flex:none;font-size:1.3rem}
.chip{display:inline-block;border:1px solid var(--line2);border-radius:999px;padding:.05rem .55rem;font-size:.82rem;margin:0 .2rem .2rem 0}
.filacab{margin:.1rem 0 .2rem}.filaonde{font-size:.8rem;margin-bottom:.4rem;overflow-wrap:anywhere}
.subt{font:600 1.15rem Sora,Inter,sans-serif;margin:.2rem 0 .6rem;grid-column:1/-1}
body.organizando .grade .tile{outline:2px dashed var(--amb);outline-offset:-2px;cursor:grab}
body.organizando .grade .tile *{pointer-events:none}
.chat{position:fixed;right:12px;bottom:12px;top:12px;width:min(560px,calc(100vw - 24px));z-index:60;display:flex;flex-direction:column;gap:.45rem;background:var(--bg2);border:1px solid var(--line2);border-radius:var(--r-tile);padding:.8rem;box-shadow:0 18px 60px rgba(0,0,0,.55)}
.chat[hidden]{display:none}
.chatcab{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.chatcab select{flex:1;min-width:10rem;background:var(--card);color:var(--txt);border:1px solid var(--line2);border-radius:var(--r-ctl);padding:.35rem}
.chatmsgs{flex:1;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:.5rem;background:var(--card)}
.cb{margin:.3rem 0;max-width:92%}.cb p{margin:.1rem 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.cbv{margin-left:auto;text-align:right}.cbv p{background:rgba(250,204,21,.12);border-radius:10px;padding:.35rem .55rem;display:inline-block;text-align:left}.cbb p{background:var(--card2);border-radius:10px;padding:.35rem .55rem}
.chattela{margin:0;white-space:pre-wrap;font:12px/1.35 ui-monospace,monospace;color:#d7e7f0}
.chatin{display:flex;gap:.4rem}.chatin textarea{flex:1;background:var(--card);color:var(--txt);border:1px solid var(--line2);border-radius:var(--r-ctl);padding:.45rem;font:inherit;resize:vertical}
.chatteclas{display:flex;gap:.3rem;flex-wrap:wrap}.chatteclas[hidden]{display:none}.chatst{font-size:.8rem;min-height:1em}
.grade .tile[data-esc]{outline:3px solid var(--amb);box-shadow:0 0 0 6px rgba(250,204,21,.18)}
#dica-org{font-size:.85rem;color:var(--amb);max-width:22rem;line-height:1.25}
.tcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.35rem .9rem}
.tc{display:flex;gap:.45rem;align-items:center;min-width:0;cursor:pointer;padding:.1rem .3rem .1rem .45rem;border-left:3px solid var(--c);border-radius:4px}
.tc:hover{background:var(--bg2)}.tc.tcimg{background:var(--card2);border-left-width:8px}
.tcx{min-width:0;flex:1}.tc1,.tc2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tc1{font-size:.92rem}.tc2{font-size:.78rem;color:var(--mut)}
.tci{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:#0c0c10;font-weight:700;font-size:.8rem}
.tile[data-rola] .corpo{-webkit-mask-image:linear-gradient(#000 78%,transparent);mask-image:linear-gradient(#000 78%,transparent)}
.tile[data-rola]::after{content:attr(data-rola);position:absolute;right:1.1rem;bottom:.45rem;font-size:.78rem;color:var(--amb);background:var(--card);padding:0 .4rem;border-radius:6px}
.rolar{margin:0;font-size:.78rem;color:var(--mut)}
.btn.quente{border-color:var(--amb);color:var(--amb)}
.convc{max-height:60vh;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:.6rem .8rem;background:var(--card)}
.mc{padding:.4rem 0;border-bottom:1px solid var(--line)}
.mc span{font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.mc p{margin:.15rem 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.mc.voce span{color:var(--amb)}.mc.ferramenta p,.mc.resultado p{font:400 .82rem/1.4 "JetBrains Mono",ui-monospace,monospace;color:var(--mut)}
#c-tela{background:#000;color:#d7e7f0;white-space:pre;max-height:55vh}
.assumirc textarea{width:100%;box-sizing:border-box;background:var(--bg2);color:var(--txt);border:1px solid var(--amb);border-radius:10px;padding:.6rem;font:inherit;resize:vertical;margin-bottom:.5rem}
.btn:disabled{opacity:.45;cursor:not-allowed}

/* Faixa de alerta: o que está errado, em frases. */
.faixa{border-radius:var(--r-tile);padding:.75rem 1.1rem;display:flex;gap:1.1rem;align-items:flex-start;min-height:3.2rem;border:1px solid var(--line);background:var(--bg2)}
.faixa.tem{background:var(--bad-bg);border-color:var(--bad-line)}
.faixa .conta{font-family:Sora,Inter,sans-serif;font-weight:700;font-size:1.25rem;white-space:nowrap;padding-top:.05rem}
.faixa.tem .conta{color:var(--bad)}
.faixa .lista{display:flex;flex-wrap:wrap;gap:.35rem 1.4rem;max-height:3.1em;overflow:hidden;font-size:1.02rem;line-height:1.5}
.faixa .lista span{white-space:nowrap}
.faixa .calmo{color:var(--mut);font-size:1.02rem;padding-top:.15rem}

/* Grade da visão geral: 4 colunas × 3 linhas na TV. */
.grade{display:grid;gap:var(--gap);min-height:0;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));
  grid-template-areas:"esp maq bot pro" "esp pub cre sit" "vag ter ter ter"}
.t-esperando{grid-area:esp}.t-maquina{grid-area:maq}.t-bots{grid-area:bot}.t-producao{grid-area:pro}
.t-publicacao{grid-area:pub}.t-creditos{grid-area:cre}.t-sites{grid-area:sit}.t-vagas{grid-area:vag}.t-terminais{grid-area:ter}

.tile{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--r-tile);padding:.95rem 1.1rem;display:flex;flex-direction:column;gap:.45rem;min-height:0;overflow:hidden;cursor:pointer;text-align:left;width:100%}
.tile:hover{border-color:var(--line2)}
.tile.erro{border-color:var(--bad-line);box-shadow:inset 4px 0 0 var(--bad)}
.tile.aviso{box-shadow:inset 4px 0 0 var(--warm)}
.tile .cab{display:flex;align-items:center;gap:.6rem}
.tile h2{margin:0;font-size:1rem;font-weight:600;color:var(--mut);letter-spacing:0}
.estado{margin-left:auto;font-size:.8rem;padding:.12rem .55rem;border-radius:999px;border:1px solid var(--line2);color:var(--mut);white-space:nowrap}
.estado.ok{color:var(--ok);border-color:#2d5249}
.estado.erro{color:var(--bad);border-color:var(--bad-line);background:var(--bad-bg)}
.estado.aviso{color:var(--warm);border-color:#5c4520;background:var(--warm-bg)}
.frase{font-family:Sora,Inter,sans-serif;font-size:1.6rem;font-weight:600;line-height:1.15;letter-spacing:-.015em;margin:.1rem 0 .15rem}
.frase.vazia{color:var(--fraco);font-weight:500;font-size:1.25rem}
.corpo{display:flex;flex-direction:column;gap:.3rem;min-height:0;overflow:hidden;color:var(--txt)}
.linha{display:flex;gap:.6rem;align-items:baseline;min-width:0;font-size:.98rem}
.linha .k{color:var(--mut);white-space:nowrap}
.linha .v{margin-left:auto;white-space:nowrap}
.linha .tx{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.mut{color:var(--mut)}.fraco{color:var(--fraco)}
.s-ok{color:var(--ok)}.s-erro{color:var(--bad)}.s-aviso{color:var(--warm)}
.bar{height:.42rem;background:var(--bg2);border-radius:999px;overflow:hidden;flex:1;min-width:3rem;align-self:center}
.bar i{display:block;height:100%;background:var(--txt);opacity:.75}
.bar.erro i{background:var(--bad);opacity:1}.bar.aviso i{background:var(--warm);opacity:1}
.sem{color:var(--fraco);font-size:.88rem}
.mais{color:var(--fraco);font-size:.88rem;margin-top:auto}

/* Modos: lista / ícones / imagens. */
.icones{display:flex;flex-wrap:wrap;gap:.55rem;align-content:flex-start;overflow:hidden}
.ico{width:4.6rem;display:flex;flex-direction:column;align-items:center;gap:.25rem;font-size:.78rem;color:var(--mut);text-align:center}
.ico b{width:3.2rem;height:3.2rem;border-radius:12px;display:grid;place-items:center;font:700 1.35rem Sora,Inter,sans-serif;color:#0c0c10}
.ico span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ico.erro b{outline:3px solid var(--bad);outline-offset:2px}
.cartoes{display:grid;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));gap:.6rem;overflow:hidden;align-content:start}
.cartao{background:var(--card2);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-width:0}
.cartao .img{aspect-ratio:16/9;background:var(--bg2) center/cover no-repeat;display:grid;place-items:center;font:700 2.2rem Sora,Inter,sans-serif;color:#0c0c10}
.cartao .txt{padding:.45rem .6rem .55rem;font-size:.85rem;line-height:1.3;display:flex;flex-direction:column;gap:.1rem;min-width:0}
.cartao .txt b{font-weight:600;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cartao .txt span{color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cartao.erro{border-color:var(--bad-line)}
.corpo>.cartoes,.corpo>.icones{flex-shrink:0}
.cartoes.horiz{grid-template-columns:1fr;gap:.45rem}
.cartoes.horiz .cartao{flex-direction:row;align-items:center}
.cartoes.horiz .img{width:7.5rem;flex:none;font-size:1.5rem}
.cartoes.horiz .txt b{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.t-terminais .cartoes{grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))}
.t-terminais .cartao .img{aspect-ratio:21/9}
.t-producao .cartoes.horiz .img{aspect-ratio:auto;height:2.9rem;width:4.5rem}

/* Detalhe do grupo (folha por cima da grade). */
.folha{position:fixed;inset:0;background:rgba(6,6,9,.72);display:none;padding:var(--gap);z-index:5}
.folha.aberta{display:block}
.folha .caixa{background:var(--bg);border:1px solid var(--line2);border-radius:16px;height:100%;max-width:1500px;margin:0 auto;display:flex;flex-direction:column;overflow:hidden}
.folha .cabf{display:flex;align-items:center;gap:1rem;padding:1rem 1.3rem;border-bottom:1px solid var(--line)}
.folha h2{margin:0;font-size:1.5rem;font-weight:700}
.folha .fechar{margin-left:auto}
.folha .conteudo{padding:1.1rem 1.3rem 2rem;overflow:auto;display:grid;gap:1.4rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr));align-content:start}
.sec{display:flex;flex-direction:column;gap:.4rem;min-width:0}
.sec h3{margin:0 0 .3rem;font-size:1.05rem;font-weight:600;color:var(--mut)}
.sec.larga{grid-column:1/-1}
table{border-collapse:collapse;width:100%;font-size:.95rem}
td,th{padding:.38rem .5rem;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--mut);font-weight:500}
td.n{text-align:right;white-space:nowrap}
pre{white-space:pre-wrap;word-break:break-word;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.8rem;font:400 .85rem/1.45 "JetBrains Mono",ui-monospace,monospace;max-height:60vh;overflow:auto;margin:0}
.link{background:none;border:0;padding:0;color:var(--txt);text-decoration:underline;text-decoration-color:var(--amb);text-underline-offset:3px;cursor:pointer}
.vaga{display:grid;grid-template-columns:7rem 1fr auto;gap:.8rem;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--line)}
.vaga .nome{font:600 1.1rem Sora,Inter,sans-serif}
.passo{display:inline-flex;align-items:center;gap:.4rem}
.passo .btn{min-width:42px;font-size:1.1rem;padding:.2rem .6rem}
.passo output{min-width:2.2rem;text-align:center;font:700 1.3rem Sora,Inter,sans-serif}
.nota{font-size:.9rem;color:var(--mut)}
.nota.aviso{color:var(--warm)}
input[type=password]{background:var(--card);border:1px solid var(--line2);border-radius:var(--r-ctl);color:var(--txt);padding:.45rem .7rem;font:inherit;min-height:38px;width:min(100%,22rem)}
.erroapi{color:var(--bad)}

/* Celular e telas estreitas: uma coluna, rolagem livre. */
@media (max-width: 900px){
  :root{font-size:16px}
  .app{height:auto;min-height:100vh}
  .topo{flex-wrap:wrap}
  .marca{flex-wrap:wrap;row-gap:.1rem}
  .marca .ver{white-space:normal}
  .linha{flex-wrap:wrap;column-gap:.6rem;row-gap:0}
  .linha .v{white-space:normal;text-align:right}
  .linha .tx{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .relogio{font-size:1.4rem}
  .grade{grid-template-columns:1fr;grid-template-rows:none;grid-template-areas:"esp" "maq" "bot" "pro" "pub" "cre" "sit" "vag" "ter"}
  .tile{max-height:none}
  .faixa{flex-direction:column;gap:.3rem}
  .faixa .lista{max-height:none;flex-direction:column;gap:.25rem}
  .faixa .lista span{white-space:normal}
  .vaga{grid-template-columns:1fr auto}
  .vaga .info{grid-column:1/-1}
}
@media (max-width: 900px) and (orientation: portrait){ .ctl{width:100%} }
@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}
`;
