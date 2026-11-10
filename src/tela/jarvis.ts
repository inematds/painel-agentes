// Versão JARVIS do painel (3.14.7): o visual HUD do kit jarvis-painel (núcleo com
// anéis, partida "bom dia", voz em português, barra de comando) com os dados de
// verdade do /api/painel. Mesmo login e mesmas rotas de dados do painel clássico;
// só lê — Aprovar/Depois marcam apenas neste navegador.
// Sem template literal dentro do JS: o arquivo é String.raw (crase e "${" quebrariam calados).

const JARVIS_CSS = String.raw`
:root{--bg:#040a17;--painel:rgba(10,28,58,.62);--linha:rgba(95,227,255,.22);--ciano:#5fe3ff;--ciano2:#2bb8e6;--gelo:#e8f7ff;--mut:#8fb2c9;--alerta:#ffb020;--erro:#ff5d6c;
  --mono:ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:radial-gradient(ellipse at 50% 40%,#0b2148 0%,var(--bg) 62%) fixed,var(--bg);color:var(--gelo);font:15px/1.45 var(--sans);overflow-x:hidden;-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(95,227,255,.035) 0 1px,transparent 1px 3px);z-index:0}
.app{position:relative;z-index:1;display:grid;grid-template-rows:auto 1fr auto;min-height:100vh;max-width:1700px;margin:0 auto;padding:14px 18px 16px;gap:14px}
header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--linha);padding-bottom:10px}
.marca{font:700 13px var(--mono);letter-spacing:.32em;color:var(--ciano)}
.ver{font:11px var(--mono);color:var(--mut)}
.relogio{margin-left:auto;font:600 22px var(--mono);letter-spacing:.06em}
.data{font:12px var(--mono);color:var(--mut);letter-spacing:.12em;text-transform:uppercase}
.selo{font:600 11px var(--mono);letter-spacing:.16em;text-transform:uppercase;border:1px solid var(--linha);color:var(--ciano);background:transparent;border-radius:999px;padding:6px 12px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;min-height:32px}
.selo.desl{color:var(--mut)}.selo:hover{border-color:var(--ciano)}
form.in{display:inline;margin:0}
button:focus-visible,a:focus-visible{outline:2px solid var(--ciano);outline-offset:2px}
main{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,1.05fr) minmax(0,1fr);gap:16px;align-items:stretch;min-height:0}
.painel{background:var(--painel);border:1px solid var(--linha);border-radius:14px;padding:14px 14px 10px;display:flex;flex-direction:column;min-height:0;max-height:calc(100vh - 230px);transition:opacity .5s;position:relative}
.painel::after{content:"";position:absolute;top:-1px;left:16px;width:56px;height:2px;background:var(--ciano);box-shadow:0 0 12px var(--ciano)}
.painel h2{margin:0 0 4px;font:700 12px var(--mono);letter-spacing:.24em;text-transform:uppercase;color:var(--ciano)}
.painel h3{margin:12px 0 2px;font:700 11px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--mut)}
.painel .sub{margin:0 0 8px;font-size:12px;color:var(--mut)}
.rolar{overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--ciano2) transparent;padding-right:4px}
.lista{list-style:none;margin:0;padding:0}
.lista li{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:2px 10px;align-items:start;padding:8px 2px;border-bottom:1px solid rgba(95,227,255,.09)}
.ponto{width:9px;height:9px;border-radius:50%;margin-top:6px;background:var(--ciano);box-shadow:0 0 8px var(--ciano)}
.ponto.erro{background:var(--erro);box-shadow:0 0 10px var(--erro);animation:pisca 1.2s infinite}
.ponto.aviso{background:var(--alerta);box-shadow:0 0 10px var(--alerta)}
.ponto.rodando{background:#fff;box-shadow:0 0 10px #fff;animation:pisca .8s infinite}
.ponto.semdados,.ponto.info{background:transparent;border:1px solid var(--mut);box-shadow:none}
@keyframes pisca{50%{opacity:.35}}
.nome{font:600 13px var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acao{grid-column:2/4;font-size:12px;color:var(--mut);overflow-wrap:anywhere}
.rot{font:600 12px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mut);white-space:nowrap}
.rot.erro{color:var(--erro)}.rot.aviso{color:var(--alerta)}
.esp li{grid-template-columns:12px minmax(0,1fr);gap:6px 10px}
.esp .titulo{font-size:13px;overflow-wrap:anywhere}.esp .titulo.erro{color:var(--erro)}.esp .titulo.aviso{color:var(--alerta)}
.esp .botoes{grid-column:2;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.esp button{font:600 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;background:transparent;color:var(--ciano);border:1px solid var(--linha);border-radius:8px;padding:5px 10px;cursor:pointer;min-height:30px}
.esp button:hover{border-color:var(--ciano);background:rgba(95,227,255,.08)}
.esp li.marcado{opacity:.45}.esp .marca-tela{font:11px var(--mono);color:var(--mut)}
.aviso-rod{font-size:12px;color:var(--mut);border-top:1px solid var(--linha);margin:8px 0 0;padding-top:8px}
.nucleo{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:380px}
#cv{width:100%;max-width:520px;aspect-ratio:1/1;display:block}
.centro{position:absolute;inset:0;bottom:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center}
.centro .nomeia{font:800 clamp(20px,2.5vw,34px) var(--mono);letter-spacing:.34em;margin-right:-.34em;text-shadow:0 0 18px var(--ciano)}
.centro .status{margin-top:8px;font:12px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ciano);max-width:48%}
.contas{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin-top:6px;font:12px var(--mono);color:var(--mut)}
.contas b{color:var(--gelo);font-size:15px}.contas .al b{color:var(--alerta)}.contas .er b{color:var(--erro)}
footer{display:grid;gap:10px}
.resposta{min-height:3em;font:15px/1.5 var(--mono);border-left:2px solid var(--ciano);padding:4px 0 4px 12px;overflow-wrap:anywhere}
.resposta .cursor{display:inline-block;width:.55em;height:1.05em;background:var(--ciano);vertical-align:-2px;animation:pisca 1s infinite}
.barra{display:flex;gap:10px;flex-wrap:wrap;align-items:center;border:1px solid var(--linha);border-radius:12px;padding:8px;background:rgba(6,18,40,.7)}
.barra .pr{font:700 12px var(--mono);color:var(--ciano);padding:0 6px;letter-spacing:.2em}
.barra button{flex:1 1 140px;font:600 13px var(--sans);color:var(--gelo);background:rgba(95,227,255,.07);border:1px solid var(--linha);border-radius:10px;padding:11px 12px;cursor:pointer;min-height:44px}
.barra button:hover,.barra button.on{border-color:var(--ciano);background:rgba(95,227,255,.16);box-shadow:0 0 14px rgba(95,227,255,.25) inset}
.barra kbd{font:11px var(--mono);color:var(--mut);margin-left:6px}
body.foco .painel{opacity:.15}body.foco .painel:hover{opacity:.9}
#partida{position:fixed;inset:0;z-index:10;background:rgba(4,10,23,.35);display:flex;align-items:flex-end;justify-content:center;padding-bottom:14vh;transition:opacity .6s;pointer-events:none}
body.partindo .painel,body.partindo footer,body.partindo .contas,body.partindo header{opacity:0}
header,footer,.contas{transition:opacity .8s}
#partida.fim{opacity:0}
#partida pre{font:16px/1.9 var(--mono);text-shadow:0 0 12px #000;color:var(--ciano);margin:0;padding:0 20px;white-space:pre-wrap;max-width:100%}
.seg{display:inline-flex;border:1px solid var(--linha);border-radius:999px;overflow:hidden}
.seg button{font:600 11px var(--mono);letter-spacing:.14em;text-transform:uppercase;background:transparent;color:var(--mut);border:0;padding:6px 12px;cursor:pointer;min-height:32px}
.seg button[aria-pressed=true]{color:var(--bg);background:var(--ciano)}
.oculto{display:none!important}
.ics{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;padding:4px 2px 8px}
.ic{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 6px 10px;border:1px solid var(--linha);border-radius:14px;background:rgba(95,227,255,.05);color:var(--gelo);cursor:pointer;font:inherit;--c:var(--ciano)}
.ic:hover{background:rgba(95,227,255,.12)}
.ic.erro{--c:var(--erro)}.ic.aviso{--c:var(--alerta)}.ic.semdados{--c:var(--mut)}.ic.rodando{--c:#fff}
.ic .gl{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:22px;color:var(--c);border:2px solid var(--c);box-shadow:0 0 14px var(--c),inset 0 0 10px rgba(95,227,255,.15);margin-bottom:4px}
.ic.erro .gl{animation:pisca 1.2s infinite}
.ic b{font:700 18px var(--mono)}.ic small{font-size:11px;color:var(--mut)}.ic i{font:600 11px var(--mono);font-style:normal;letter-spacing:.14em;text-transform:uppercase;color:var(--c);margin-top:2px}
.gbox{margin:4px 0 14px}
.aneis{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
.g-anel{position:relative;text-align:center}
.g-anel svg{width:84px;height:84px;transform:rotate(-90deg)}
.g-anel circle{fill:none;stroke-width:7}.g-anel .trilho{stroke:rgba(95,227,255,.12)}.g-anel .val{stroke-linecap:round;filter:drop-shadow(0 0 4px currentColor)}
.g-anel b{position:absolute;left:0;right:0;top:28px;font:700 16px var(--mono)}
.g-anel span{display:block;font-size:11px;color:var(--mut);margin-top:-2px}
.barras{display:grid;gap:5px}
.barras .bl{display:grid;grid-template-columns:72px minmax(0,1fr) 34px;gap:8px;align-items:center;font:12px var(--mono)}
.barras .bl span{color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.barras .tr{height:10px;border-radius:6px;background:rgba(95,227,255,.1);overflow:hidden}
.barras .tr i{display:block;height:100%;background:linear-gradient(90deg,var(--ciano2),var(--ciano));box-shadow:0 0 8px var(--ciano)}
.barras .hj{background:linear-gradient(90deg,#fff,var(--ciano))!important}
.vg{display:grid;grid-template-columns:62px minmax(0,1fr);gap:8px;align-items:center;font:12px var(--mono);margin-bottom:6px}
.vg span{color:var(--mut)}.vg .bl{display:flex;gap:4px;flex-wrap:wrap}
.vg .bl i{width:18px;height:18px;border-radius:4px;border:1px solid var(--linha)}
.vg .bl i.on{background:var(--ciano);box-shadow:0 0 8px var(--ciano)}.vg .bl i.esp{border-color:var(--alerta);border-style:dashed}
.tl{position:relative;height:46px;margin:6px 4px 0;border-bottom:1px solid var(--linha)}
.tl .tk{position:absolute;bottom:-16px;font:10px var(--mono);color:var(--mut);transform:translateX(-50%)}
.tl .tk::before{content:"";position:absolute;left:50%;bottom:16px;height:6px;border-left:1px solid var(--linha)}
.tl .mk{position:absolute;bottom:-5px;width:10px;height:10px;border-radius:50%;background:var(--ciano);box-shadow:0 0 8px var(--ciano);transform:translateX(-50%)}
.tl .mk.al{bottom:10px;background:#fff}.tl .mk.al2{bottom:25px}
.tlleg{margin-top:22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 10px;font:11px var(--mono);color:var(--mut)}
.tlleg b{color:var(--gelo);font-weight:600}
.st{display:flex;gap:8px;flex-wrap:wrap}
.st i{width:16px;height:16px;border-radius:50%;background:var(--ciano);box-shadow:0 0 8px var(--ciano)}.st i.fora{background:var(--erro);box-shadow:0 0 10px var(--erro);animation:pisca 1.2s infinite}
.st small{font-size:11px;color:var(--mut);width:100%}
[data-det]{cursor:pointer}
.lista li[data-det]:hover{background:rgba(95,227,255,.06)}
.gbox[data-det]:hover,h3[data-det]:hover{filter:brightness(1.25)}
.folha{position:fixed;inset:0;z-index:20;background:rgba(2,6,15,.72);display:none;align-items:center;justify-content:center;padding:16px}
.folha.aberta{display:flex}
.folha .cx{width:min(760px,100%);max-height:88vh;overflow-y:auto;background:#06142c;border:1px solid var(--ciano);border-radius:14px;padding:18px 18px 14px;box-shadow:0 0 40px rgba(95,227,255,.25)}
.folha .cab{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.folha h2{margin:0;font:700 14px var(--mono);letter-spacing:.22em;text-transform:uppercase;color:var(--ciano);flex:1}
.folha .fch{font:600 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;background:transparent;color:var(--gelo);border:1px solid var(--linha);border-radius:8px;padding:6px 12px;cursor:pointer;min-height:34px}
.folha .exp{margin:4px 0 12px;font-size:14px;color:var(--gelo);border-left:2px solid var(--ciano);padding-left:10px}
.folha h4{margin:14px 0 6px;font:700 11px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--mut)}
.folha .ln{display:grid;grid-template-columns:minmax(120px,38%) minmax(0,1fr);gap:10px;padding:5px 0;border-bottom:1px solid rgba(95,227,255,.08);font-size:13px}
.folha .ln span{color:var(--mut)}.folha .ln b{font-weight:500;overflow-wrap:anywhere}
.folha .ln b.erro{color:var(--erro)}.folha .ln b.aviso{color:var(--alerta)}
.folha a{color:var(--ciano)}
.folha .dica{font-size:13px;color:var(--mut);margin-top:12px}
.conv{max-height:52vh;overflow-y:auto;border:1px solid var(--linha);border-radius:10px;padding:8px 10px;background:rgba(2,8,20,.6);margin-top:8px}
.msg{padding:6px 0;border-bottom:1px solid rgba(95,227,255,.06)}
.msg span{font:600 10px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
.msg p{margin:2px 0 0;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
.msg.voce span{color:var(--alerta)}.msg.voce p{color:#fff}
.msg.claude span{color:var(--ciano)}
.msg.ferramenta p,.msg.resultado p{font:12px var(--mono);color:var(--mut)}
.msg.resultado p{opacity:.7}
.folha .fch:disabled{opacity:.6;cursor:default}
.acoes{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}
.folha .fch.quente{border-color:var(--alerta);color:var(--alerta)}
.tela{max-height:46vh;overflow:auto;background:#000;color:#d7e7f0;border:1px solid var(--linha);border-radius:10px;padding:10px;font:12px/1.35 var(--mono);white-space:pre;margin-top:8px}
.assumir textarea{width:100%;background:#020814;color:var(--gelo);border:1px solid var(--alerta);border-radius:10px;padding:10px;font:14px var(--sans);resize:vertical}
@media (max-width:980px){main{grid-template-columns:minmax(0,1fr)}.nucleo{order:-1;min-height:0}#cv{max-width:340px}.painel{max-height:none}.rolar{max-height:60vh}.relogio{font-size:18px}.app{padding:12px 16px 14px}
  footer{position:sticky;bottom:0;z-index:5;margin:0 -16px -14px;padding:10px 16px 12px;background:var(--bg);box-shadow:0 -18px 18px var(--bg)}
  .resposta{min-height:0;max-height:6.2em;overflow-y:auto;font-size:14px}.barra button{flex:1 1 40%;padding:9px 8px;font-size:13px}}
@media (prefers-reduced-motion:reduce){.ponto.erro,.ponto.rodando,.resposta .cursor{animation:none}}
`;

/** JS do cliente (exportado para o teste de sintaxe e de resumo). */
export const JARVIS_JS = String.raw`(function(){'use strict';
var $=function(id){return document.getElementById(id)};
var LS={get:function(k,d){try{var v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
var REDUZ=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var NOME='você';
var D=null,falando=false,ondaAte=0,vozLigada=LS.get('jarvis.voz','1')==='1',marcas={},falados={},primeira=true,partiu=false;
try{marcas=JSON.parse(LS.get('jarvis.marcas','{}'))||{}}catch(e){marcas={}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function n(v,c){return v==null||isNaN(v)?'–':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:c==null?1:c})}
function hm(t){return t?new Date(t*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'–'}
function ha(t){if(!t)return'ainda não rodou';var s=Date.now()/1000-t;if(s<0)return'agora';if(s<90)return'há 1 min';if(s<3600)return'há '+Math.round(s/60)+' min';if(s<86400)return'há '+Math.round(s/3600)+' h';return'há '+Math.round(s/86400)+' d'}
function plural(q,um,varios){return q+' '+(q===1?um:varios)}
function idDe(s){s=String(s);var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return'i'+h.toString(36)}
var NOMES={maquina:'Máquina',bots:'Bots',producao:'Produção',publicacao:'Publicação',creditos:'Créditos',sites:'Sites',vagas:'Vagas',terminais:'Terminais'};
var ROT={ok:'ok',erro:'erro',aviso:'atenção',semdados:'sem dados',rodando:'rodando'};
function estadoGrupo(nome,g,al){if(!g||!g.ok)return'semdados';if(g.nao_configurado)return'semdados';var e=al.filter(function(a){return a.grupo===nome});if(e.some(function(a){return a.nivel==='erro'}))return'erro';if(e.length)return'aviso';return'ok'}
// Uma frase curta por sistema, a partir dos dados de cada grupo.
function somaBots(d){var t={rodando:0,na_fila:0,falhas:0};(d.bots||[]).forEach(function(b){t.rodando+=b.jobs.rodando;t.na_fila+=b.jobs.na_fila;t.falhas+=(b.falhas_24h||[]).length});return t}
var FRASE={
  maquina:function(d){var m=d.memoria||{},k=d.disco||{},o=d.gpu_oom||{};return n(m.disponivel_gb,0)+' GB livres · disco '+n(k.usado_pct,0)+'% · GPU sem memória 24 h: '+n(o.ultimas_24h,0)},
  bots:function(d){var t=somaBots(d),s=d.servicos||{},caidos=Object.keys(s).filter(function(k){return s[k]!=='active'});
    return n(t.rodando,0)+' rodando, '+n(t.na_fila,0)+' na fila, '+plural(t.falhas,'falha','falhas')+' em 24 h'+(caidos.length?' · parado: '+caidos.join(', '):'')},
  producao:function(d){var h=d.hoje||[],p=(d.presas||[]).length,f=(d.falhas||[]).length,prox=(d.timers||[]).filter(function(t){return t.proxima}).sort(function(a,b){return a.proxima-b.proxima}).filter(function(t){return true})[0];
    return plural(h.length,'rodada','rodadas')+' hoje · '+p+' presas · '+f+' falhas'+(prox?' · próxima: '+prox.unidade+' às '+hm(prox.proxima):'')},
  publicacao:function(d){var s=d.semana_por_canal||{},t=0;Object.keys(s).forEach(function(k){t+=s[k]});return plural(d.hoje||0,'vídeo','vídeos')+' hoje · '+t+' na semana'},
  creditos:function(d){var c=(d.claude&&d.claude.limites)||[],x=d.codex||{};return c.map(function(l){return String(l.nome).replace(/^Semana \(todos\)$/,'Claude semana').replace(/^Semana · /,'')+' '+n(l.pct,0)+'%'}).join(' · ')+(x.pct!=null?' · Codex '+n(x.pct,0)+'%':'')},
  sites:function(d){if(d.desligado)return'checagem desligada';var s=d.sites||[];if(!s.length)return d.checando?'checando agora…':'sem leitura ainda';var ok=s.filter(function(x){return x.ok}).length,ruins=s.filter(function(x){return!x.ok}).map(function(x){return String(x.url).replace(/^https?:\/\//,'')});return ok+' de '+s.length+' no ar'+(ruins.length?' · fora: '+ruins.join(', '):'')},
  vagas:function(d){return(d.classes||[]).filter(function(c){return c.ocupadas||c.esperando||c.classe==='gpu'||c.classe==='render'}).map(function(c){return c.classe+' '+c.ocupadas+'/'+c.vagas+(c.dono?' ('+c.dono+')':'')+(c.esperando?' +'+c.esperando+' esperando':'')}).join(' · ')},
  terminais:function(d){var v=d.vivos||[],f=v.filter(function(t){return t.origem&&t.origem.tipo==='fisica'}).length;return plural(v.length,'sessão viva','sessões vivas')+': '+f+' sua'+(f===1?'':'s')+' · '+(v.length-f)+' de agente'+(v.length-f===1?'':'s')+' · '+plural((d.interrompidos||[]).length,'interrompida','interrompidas')}
};
function sistemas(){var al=D.alertas||[];return Object.keys(NOMES).map(function(nome){var g=D.grupos[nome],st=estadoGrupo(nome,g,al),fr;
  try{fr=g&&g.ok&&g.nao_configurado?'não configurado':g&&g.ok?FRASE[nome](g.dados||{}):(g&&g.erro)||'fonte ausente'}catch(e){fr='não consegui ler: '+e.message}
  if(st==='ok'&&nome==='vagas'&&g&&g.dados&&(g.dados.classes||[]).some(function(c){return c.ocupadas}))st='rodando';
  return{nome:nome,estado:st,frase:fr}})}
function esperando(){var it=(D.grupos.esperando&&D.grupos.esperando.ok&&D.grupos.esperando.dados.itens)||[],vistos={},out=[];
  it.concat(D.alertas||[]).forEach(function(x){var k=x.texto;if(vistos[k])return;vistos[k]=1;out.push({id:idDe(k),texto:k,nivel:x.nivel||'info',tipo:x.tipo||'alerta'})});
  var ordem={erro:0,aviso:1,info:2};out.sort(function(a,b){return(ordem[a.nivel]-ordem[b.nivel])});return out}
function contagem(){var al=D.alertas||[],er=al.filter(function(a){return a.nivel==='erro'}).length,pub=(D.grupos.publicacao&&D.grupos.publicacao.dados&&D.grupos.publicacao.dados.hoje)||0;
  var v=(D.grupos.vagas&&D.grupos.vagas.dados&&D.grupos.vagas.dados.classes)||[],oc=0;v.forEach(function(c){oc+=c.ocupadas||0});
  var sis=sistemas();return{erros:er,avisos:al.length-er,publicados:pub,ocupadas:oc,ok:sis.filter(function(s){return s.estado==='ok'||s.estado==='rodando'}).length,total:sis.length,abertos:esperando().filter(function(x){return!marcas[x.id]}).length}}
// ---------- modos visuais (lista / ícones / gráficos) ----------
var MODO=LS.get('jarvis.modo','lista');if(['lista','icones','graficos'].indexOf(MODO)<0)MODO='lista';
var GLIFO={maquina:'⚙',bots:'◉',producao:'▶',publicacao:'▲',creditos:'◔',sites:'◎',vagas:'▦',terminais:'▭'};
function dg(nome){var g=D.grupos[nome];return g&&g.ok&&g.dados?g.dados:null}
function numero(nome){var d=dg(nome);if(!d)return['–','sem dados'];
  if(nome==='maquina')return[n(d.memoria&&d.memoria.disponivel_gb,0)+' GB','memória livre'];
  if(nome==='bots'){var j=somaBots(d);return[n(j.rodando,0)+' · '+n(j.na_fila,0),'rodando · fila']}
  if(nome==='producao')return[String((d.hoje||[]).length),'rodadas hoje'];
  if(nome==='publicacao')return[String(d.hoje||0),'vídeos hoje'];
  if(nome==='creditos'){var mx=0;((d.claude&&d.claude.limites)||[]).forEach(function(l){mx=Math.max(mx,l.pct||0)});if(d.codex&&d.codex.pct!=null)mx=Math.max(mx,d.codex.pct);return[n(mx,0)+'%','maior limite']}
  if(nome==='sites'){var s=d.sites||[];return[s.length?s.filter(function(x){return x.ok}).length+'/'+s.length:'…','no ar']}
  if(nome==='vagas'){var o=0,t=0;(d.classes||[]).forEach(function(c){if(c.classe==='gpu'||c.classe==='render'){o+=c.ocupadas||0;t+=c.vagas||0}});return[o+'/'+t,'gpu + render']}
  if(nome==='terminais'){var vv=d.vivos||[],ff=vv.filter(function(t){return t.origem&&t.origem.tipo==='fisica'}).length;return[ff+' · '+(vv.length-ff),'você · agentes']}return['–','']}
function sesJ(){var td=dg('terminais')||{};return td.vivos||[]}
function projS(t){return(t.retrato&&t.retrato.ativo)||t.projeto||'?'}
function emoS(t){var o=t.origem||{};return o.tipo==='fisica'?'👤':o.tipo==='agente'?'🤖':'·'}
function atS(t){var r=t.retrato||{},x=t.transcript||{};return x.ultima_atividade||r.em||t.inicio}
function subS(t){var r=t.retrato||{},x=t.transcript||{};return String(t.cwd||'').replace(/^\/home\/[^\/]+\//,'~/')+' · '+(r.modelo||x.modelo||'modelo ?')+(r.esforco?'/'+r.esforco:'')+' · ativo '+ha(atS(t))}
function icones(){return'<div class="ics">'+sistemas().map(function(s){var v=numero(s.nome);return'<button type="button" class="ic '+s.estado+'" data-det="sis:'+s.nome+'" title="'+esc(s.frase)+'"><span class="gl" aria-hidden="true">'+GLIFO[s.nome]+'</span><b>'+esc(v[0])+'</b><small>'+esc(v[1])+'</small><i>'+esc(NOMES[s.nome])+'</i></button>'}).join('')+'</div>'+(sesJ().length?'<h3>Sessões do Claude</h3><div class="ics">'+sesJ().map(function(t){var r=t.retrato||{};return'<button type="button" class="ic" data-det="term:'+esc(t.session_id)+'" title="'+esc(subS(t))+'"><span class="gl" aria-hidden="true">'+emoS(t)+'</span><b>'+esc(projS(t))+'</b><small>'+esc((r.modelo||'?')+(r.ctx_pct!=null?' · '+r.ctx_pct+'%':''))+'</small><i>'+esc(ha(atS(t)))+'</i></button>'}).join('')+'</div>':'')}
function anel(pct,rot,gr){var p=Math.max(0,Math.min(100,Number(pct)||0)),C=2*Math.PI*34,cor=p>=90?'#ff5d6c':p>=75?'#ffb020':'#5fe3ff';
  return'<div class="g-anel" data-det="sis:'+gr+'" tabindex="0" title="'+esc(rot)+' '+n(pct,0)+'%"><svg viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="34" class="trilho"></circle><circle cx="42" cy="42" r="34" class="val" style="color:'+cor+';stroke:'+cor+';stroke-dasharray:'+(C*p/100).toFixed(1)+' '+C.toFixed(1)+'"></circle></svg><b>'+n(pct,0)+'%</b><span>'+esc(rot)+'</span></div>'}
function graficos(){var h='',m=dg('maquina'),cr=dg('creditos'),pb=dg('publicacao'),vg=dg('vagas'),pr=dg('producao'),st=dg('sites'),an=[];
  if(m){var me=m.memoria||{};if(me.total_gb)an.push(anel(100*(1-(me.disponivel_gb||0)/me.total_gb),'memória usada','maquina'));if(m.disco)an.push(anel(m.disco.usado_pct,'disco','maquina'));if(m.carga&&m.carga.nucleos)an.push(anel(100*m.carga.m5/m.carga.nucleos,'carga 5 min','maquina'))}
  if(cr){((cr.claude&&cr.claude.limites)||[]).forEach(function(l){an.push(anel(l.pct,String(l.nome).replace(/^Semana \(todos\)$/,'Claude semana').replace(/^Semana · /,''),'creditos'))});if(cr.codex&&cr.codex.pct!=null)an.push(anel(cr.codex.pct,'Codex','creditos'))}
  if(an.length)h+='<h3>Máquina e limites</h3><div class="gbox aneis">'+an.join('')+'</div>';
  if(pb){var sc=pb.semana_por_canal||{},hj=pb.hoje_por_canal||{},ks=Object.keys(sc).sort(function(a,b){return sc[b]-sc[a]}),mx=ks.length?sc[ks[0]]:1;
    h+='<h3>Publicação na semana</h3><div class="gbox barras" data-det="sis:publicacao" tabindex="0">'+(ks.map(function(k){return'<div class="bl"><span>'+esc(k)+'</span><span class="tr"><i class="'+(hj[k]?'hj':'')+'" style="width:'+Math.max(3,100*sc[k]/mx).toFixed(0)+'%"></i></span><b>'+sc[k]+'</b></div>'}).join('')||'<small>nada na semana</small>')+'</div>'}
  if(vg){h+='<h3>Vagas</h3><div class="gbox" data-det="sis:vagas" tabindex="0">'+(vg.classes||[]).map(function(c){var b='';for(var i=0;i<c.vagas;i++)b+='<i class="'+(i<c.ocupadas?'on':'')+'" title="'+esc(i<c.ocupadas&&c.dono?c.dono:'livre')+'"></i>';for(var k=0;k<(c.esperando||0);k++)b+='<i class="esp" title="esperando"></i>';
    return'<div class="vg"><span>'+esc(c.classe)+'</span><span class="bl">'+b+'</span></div>'}).join('')+'</div>'}
  if(pr){var ag=Date.now()/1000,J=12*3600,ev=(pr.timers||[]).filter(function(t){return t.proxima&&t.proxima>=ag&&t.proxima<=ag+J}).sort(function(a,b){return a.proxima-b.proxima}),tl='',ult={};
    for(var q=0;q<=6;q++){var tt=ag+q*J/6;tl+='<span class="tk" style="left:'+(q*100/6).toFixed(1)+'%">'+hm(tt)+'</span>'}
    ev.forEach(function(t,i){var x=(100*(t.proxima-ag)/J),lin=0;for(var z=0;z<3;z++){if(ult[z]==null||x-ult[z]>3){lin=z;break}lin=z}ult[lin]=x;tl+='<span class="mk'+(lin===1?' al':lin===2?' al al2':'')+'" style="left:'+x.toFixed(1)+'%" title="'+esc(t.unidade)+' às '+hm(t.proxima)+'"></span>'});
    h+='<h3>Próximas 12 horas</h3><div class="gbox" data-det="sis:producao" tabindex="0"><div class="tl">'+tl+'</div><div class="tlleg">'+(ev.slice(0,10).map(function(t){return'<span><b>'+hm(t.proxima)+'</b> '+esc(t.unidade)+'</span>'}).join('')||'<span>nenhum timer nas próximas 12 h</span>')+'</div></div>'}
  if(st&&(st.sites||[]).length){var fora=st.sites.filter(function(s){return!s.ok});h+='<h3>Sites</h3><div class="gbox st" data-det="sis:sites" tabindex="0">'+st.sites.map(function(s){return'<i class="'+(s.ok?'':'fora')+'" title="'+esc(String(s.url).replace(/^https?:\/\//,''))+(s.ok?' · '+s.ms+' ms':' · '+(s.erro||'fora'))+'"></i>'}).join('')+'<small>'+(fora.length?'fora: '+esc(fora.map(function(s){return String(s.url).replace(/^https?:\/\//,'')}).join(', ')):st.sites.length+' no ar')+'</small></div>'}
  var ss=sesJ();if(ss.length)h+='<h3>Sessões do Claude · contexto usado</h3><div class="gbox barras">'+ss.map(function(t){var c=(t.retrato||{}).ctx_pct;return'<div class="bl" data-det="term:'+esc(t.session_id)+'" title="'+esc(subS(t))+'"><span>'+emoS(t)+' '+esc(projS(t))+'</span><span class="tr"><i style="width:'+Math.max(2,c||0)+'%;'+(c>=85?'background:#ff5d6c':c>=70?'background:#ffb020':'')+'"></i></span><b>'+(c!=null?c+'%':'–')+'</b></div>'}).join('')+'</div>';
  return h||'<p class="sub">sem dados para desenhar</p>'}
function marcarModo(){document.querySelectorAll('[data-modo]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.modo===MODO))})}
function trocarModo(m){MODO=m;LS.set('jarvis.modo',m);marcarModo();desenhar()}
document.querySelectorAll('[data-modo]').forEach(function(b){b.addEventListener('click',function(){trocarModo(b.dataset.modo)})});
marcarModo();
// ---------- detalhe (clique em qualquer item) ----------
var EXPLICA={
  maquina:'A saúde do computador: quanta memória sobra, quanto do disco está cheio, a carga dos processadores e quantas vezes a placa de vídeo ficou sem memória. Se a GPU fica sem memória, render e voz local falham.',
  bots:'Os seus robôs e serviços: cada banco de tarefas da config e as unidades do systemd vigiadas. Mostra o que está rodando, o que está na fila e o que falhou nas últimas 24 h.',
  producao:'As rodadas automáticas (cada trabalho que um timer ou agente roda): quantas rodaram hoje, se alguma travou ("presa") ou falhou, as esperas longas e a agenda dos próximos timers.',
  publicacao:'O que foi publicado: quantos envios hoje, quantos por canal na semana, os últimos com link e as filas com o estado de cada item.',
  creditos:'Quanto já foi usado dos limites da assinatura (Claude e Codex) e quando zera, mais os avisos manuais com prazo (ex.: renovar um login).',
  sites:'Os sites da config: se responderam e em quanto tempo. É checado a cada 5 min enquanto o painel está aberto.',
  vagas:'As vagas da máquina: quantos trabalhos pesados podem rodar ao mesmo tempo em cada classe (GPU, render, estúdio, Claude, Codex), quem está ocupando e quem espera.',
  terminais:'As sessões do Claude abertas agora (terminais) e as que foram interrompidas no meio — essas podem ter deixado trabalho pela metade.'
};
function ln(k,v,cls){return'<div class="ln"><span>'+esc(k)+'</span><b class="'+(cls||'')+'">'+v+'</b></div>'}
function lnt(k,v,cls){return ln(k,esc(v),cls)}
function bloco(t,linhas){return linhas?'<h4>'+esc(t)+'</h4>'+linhas:''}
function quando(t){return t?new Date(t*1000).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' ('+ha(t)+')':'–'}
function emQuanto(t){if(!t)return'–';var s=t-Date.now()/1000;return hm(t)+(s>0?' (daqui a '+(s<3600?Math.round(s/60)+' min':Math.round(s/3600)+' h')+')':'')}
var DET={
  maquina:function(d){var m=d.memoria||{},c=d.carga||{},k=d.disco||{},o=d.gpu_oom||{},r=(d.reinicios&&d.reinicios.em)||[];
    return bloco('Memória',lnt('livre',n(m.disponivel_gb)+' de '+n(m.total_gb)+' GB',m.disponivel_gb<10?'erro':'')+lnt('swap em uso',n(m.swap_usado_gb)+' GB'))
      +bloco('Processador',lnt('carga 1 / 5 / 15 min',n(c.m1)+' / '+n(c.m5)+' / '+n(c.m15))+lnt('núcleos',n(c.nucleos,0)))
      +bloco('Disco',lnt('usado',n(k.usado_pct,0)+'%',k.usado_pct>90?'erro':k.usado_pct>80?'aviso':'')+lnt('livre',n(k.livre_gb,0)+' de '+n(k.total_gb,0)+' GB'))
      +bloco('GPU sem memória',lnt('últimas 24 h',n(o.ultimas_24h,0),o.ultima_hora?'erro':o.ultimas_24h?'aviso':'')+lnt('última hora',n(o.ultima_hora,0))+lnt('última vez',quando(o.ultima_em)))
      +bloco('Reinícios',lnt('ligada desde',quando(d.boot_em))+r.slice(-5).reverse().map(function(t){return lnt('reinício',quando(t))}).join(''))},
  bots:function(d){var s=d.servicos||{};
    return bloco('Serviços',Object.keys(s).map(function(k){return lnt(k,s[k]==='active'?'no ar':s[k],s[k]==='active'?'':'erro')}).join(''))
      +(d.bots||[]).map(function(b){var j=b.jobs||{};return bloco(b.nome,lnt('rodando agora',n(j.rodando,0))+lnt('na fila',n(j.na_fila,0))+(j.criados_hoje!=null?lnt('pedidos hoje',n(j.criados_hoje,0)):'')+((b.falhas_24h||[]).map(function(f){return lnt('falhou #'+f.id+' '+(f.tarefa||''),(f.erro||'falhou')+' · '+ha(f.quando),'erro')}).join('')||lnt('falhas em 24 h','nenhuma')))}).join('')},
  producao:function(d){var lr=function(x){return lnt(x.unidade+(x.edicao?' · '+x.edicao:''),(x.resultado||'rodando')+(x.dur_s?' em '+Math.round(x.dur_s/60)+' min':'')+(x.motivo?' — '+x.motivo:'')+(x.presa?' · presa há '+x.aberta_min+' min':''),x.presa||x.resultado==='falhou'?'erro':'')};
    return bloco('Rodadas de hoje',(d.hoje||[]).map(lr).join('')||lnt('hoje','nenhuma rodada ainda'))+bloco('Presas',(d.presas||[]).map(lr).join(''))+bloco('Falhas',(d.falhas||[]).map(lr).join(''))
      +bloco('Esperas longas',(d.esperas||[]).map(function(e){return lnt(e.chave,e.estado+' desde '+quando(e.desde)+(e.passou_teto?' · passou do teto':''),e.passou_teto?'aviso':'')}).join(''))
      +bloco('Agenda dos timers',(d.timers||[]).filter(function(t){return t.proxima}).sort(function(a,b){return a.proxima-b.proxima}).slice(0,25).map(function(t){return lnt(t.unidade,'próxima '+emQuanto(t.proxima)+' · última '+(t.ultima?ha(t.ultima):'ainda não rodou'))}).join(''))},
  publicacao:function(d){var hj=d.hoje_por_canal||{},sc=d.semana_por_canal||{};
    return bloco('Hoje',Object.keys(hj).map(function(k){return lnt(k,plural(hj[k],'vídeo','vídeos'))}).join('')||lnt('hoje','nada ainda'))
      +bloco('Semana por canal',Object.keys(sc).sort(function(a,b){return sc[b]-sc[a]}).map(function(k){return lnt(k,plural(sc[k],'vídeo','vídeos'))}).join(''))
      +bloco('Últimos',(d.ultimos||[]).slice(0,12).map(function(u){return ln(u.canal+' · '+ha(u.quando),/^https?:\/\//.test(u.url||'')?'<a href="'+esc(u.url)+'" target="_blank" rel="noopener">'+esc(u.titulo||u.video_id)+'</a>':esc(u.titulo||u.video_id))}).join(''))
      +(d.filas_itens||[]).map(function(f){var p=f.por_estado||{};return bloco('Fila: '+f.nome,(f.problema?lnt('problema',f.problema,'erro'):'')+lnt('estado',(p.publicando||0)+' publicando · '+(p.pendente||0)+' na fila · '+(p.erro||0)+' com erro · '+(p.feito||0)+' feitos',p.erro?'aviso':'')+(f.itens||[]).filter(function(i){return i.estado!=='feito'}).slice(0,8).map(function(i){return lnt(i.nome,i.estado+(i.erro?' — '+i.erro:''),i.estado==='erro'?'erro':'')}).join(''))}).join('')},
  creditos:function(d){var c=d.claude||{},x=d.codex||{};
    return bloco('Claude',(c.limites||[]).map(function(l){return lnt(l.nome,n(l.pct,0)+'% usado · zera '+quando(l.reset_em).replace(/ \(.*\)$/,''),l.pct>=80?'aviso':'')}).join('')+(c.idade_s!=null?lnt('lido',ha(Date.now()/1000-c.idade_s)):''))
      +bloco('Codex',x.pct!=null?lnt('usado',n(x.pct,0)+'% da janela de '+n(x.janela_h,0)+' h',x.pct>=80?'aviso':'')+lnt('zera',quando(x.reset_em).replace(/ \(.*\)$/,''))+lnt('plano',x.plano||'–'):'')
      +bloco('Avisos com prazo',(d.avisos||[]).map(function(a){return lnt(a.titulo,'até '+a.ate+(a.vencido?' · VENCIDO':' · faltam '+plural(a.dias,'dia','dias')),a.vencido?'erro':a.nivel==='aviso'?'aviso':'')}).join(''))},
  sites:function(d){return bloco('Sites',(d.sites||[]).map(function(s){return lnt(String(s.url).replace(/^https?:\/\//,''),s.ok?'no ar · '+s.ms+' ms':'FORA · '+(s.erro||s.status),s.ok?'':'erro')}).join('')||lnt('sites',d.checando?'checando agora…':'sem leitura'))},
  vagas:function(d){return bloco('Classes',(d.classes||[]).map(function(c){return lnt(c.classe,c.ocupadas+' de '+c.vagas+' ocupadas'+(c.dono?' · '+c.dono+(c.desde?' desde '+String(c.desde).slice(11,16):''):'')+(c.esperando?' · '+c.esperando+' esperando':'')+' · teto '+c.teto,c.esperando?'aviso':'')}).join(''))+(d.dica?'<p class="dica">Para mudar: '+esc(d.dica)+'</p>':'')},
  terminais:function(d){var lt=function(t,cls){var o=t.origem||{},r=t.retrato||{},x=t.transcript||{};return'<div class="ln" data-det="term:'+esc(t.session_id)+'" tabindex="0"><span>'+(o.tipo==='fisica'?'👤 ':o.tipo==='agente'?'🤖 ':'')+esc(t.projeto||'?')+(r.ativo?' → '+esc(r.ativo):'')+'</span><b class="'+(cls||'')+'">'+esc(o.quem||t.tipo)+' · '+esc(r.modelo||x.modelo||'modelo ?')+(r.ctx_pct!=null?' · ctx '+r.ctx_pct+'%':'')+' · '+esc(x.ultima_atividade?'ativa '+ha(x.ultima_atividade):'aberta '+ha(t.inicio))+'</b></div>'};
    return bloco('Sessões vivas (clique para ver tudo)',(d.vivos||[]).map(function(t){return lt(t)}).join('')||lnt('vivas','nenhuma'))
      +bloco('Interrompidas — pode ter ficado trabalho pela metade',(d.interrompidos||[]).map(function(t){return lt(t,'aviso')}).join(''))}
};
var fTexto='';
function abrirDet(chave){if(!D)return;var p=chave.split(':'),tit='',h='',fala='';
  if(p[0]==='sis'){var nome=p[1],g=D.grupos[nome],s=sistemas().filter(function(x){return x.nome===nome})[0];tit=NOMES[nome];fala=tit+': '+(s?s.frase:'')+'.';
    h='<p class="exp">'+esc(EXPLICA[nome]||'')+'</p>'+ln('agora',esc(s?ROT[s.estado]+' — '+s.frase:'–'),s&&(s.estado==='erro'||s.estado==='aviso')?s.estado:'');
    var al=(D.alertas||[]).filter(function(a){return a.grupo===nome});if(al.length)h+=bloco('Alertas',al.map(function(a){return lnt(a.nivel==='erro'?'erro':'atenção',a.texto,a.nivel)}).join(''));
    try{h+=g&&g.ok&&g.nao_configurado?lnt('fonte','não configurado (veja o README)','aviso'):g&&g.ok?DET[nome](g.dados||{}):lnt('fonte',(g&&g.erro)||'sem dados','aviso')}catch(e){h+=lnt('erro ao ler',e.message,'erro')}
    if(g&&g.ausentes&&g.ausentes.length)h+=bloco('Fontes sem dados',lnt('arquivos',g.ausentes.join(', '),'aviso'))}
  else if(p[0]==='esp'){var x=esperando().filter(function(i){return i.id===p[1]})[0];if(!x)return;tit='Esperando você';fala=x.texto;
    var o={alerta:'Alerta automático do painel: uma regra viu algo fora do normal agora.',manual:'Aviso manual com prazo, guardado no arquivo de avisos da config.',pendencia:'Pendência anotada no seu arquivo de pendências (o que ficou para olhar depois).',falha:'Falha de um trabalho dos bots nas últimas 24 h.'};
    h='<p class="exp">'+esc(x.texto)+'</p>'+lnt('tipo',o[x.tipo]||x.tipo)+lnt('nível',x.nivel==='erro'?'erro':x.nivel==='aviso'?'atenção':'informação',x.nivel)+lnt('marcado na tela',marcas[x.id]?(marcas[x.id]==='aprovado'?'Visto':'Depois'):'não');
    var it=(D.grupos.esperando&&D.grupos.esperando.dados&&D.grupos.esperando.dados.itens)||[],orig=it.concat(D.alertas||[]).filter(function(i){return i.texto===x.texto})[0];
    if(orig&&orig.grupo&&NOMES[orig.grupo])h+='<p class="dica">Vem de <a href="#" data-det="sis:'+orig.grupo+'">'+esc(NOMES[orig.grupo])+'</a> — clique para ver o sistema.</p>'}
  else if(p[0]==='pub'){var u=((dg('publicacao')||{}).ultimos||[])[Number(p[1])];if(!u)return;tit='Publicado';fala=u.titulo||'';
    h=(u.miniatura&&/^https:\/\/i\.ytimg\.com\//.test(u.miniatura)?'<p><img src="'+esc(u.miniatura)+'" alt="" style="max-width:100%;border-radius:10px"></p>':'')+'<p class="exp">'+esc(u.titulo||u.video_id)+'</p>'+lnt('canal',u.canal)+lnt('quando',quando(u.quando))+lnt('público',u.publico===false?'não':'sim')+lnt('miniatura',u.thumb_ok===false?'faltando':'ok')
      +(/^https:\/\/(www\.)?youtube\.com\//.test(u.url||'')?ln('link','<a href="'+esc(u.url)+'" target="_blank" rel="noopener">abrir no YouTube</a>'):'')}
  else if(p[0]==='term'){var td=dg('terminais')||{},t=(td.vivos||[]).concat(td.interrompidos||[]).filter(function(s){return s.session_id===p[1]})[0];if(!t)return;
    var o=t.origem||{},r=t.retrato||{},x=t.transcript||{},pr=t.processo,viva=(td.vivos||[]).indexOf(t)>=0;
    tit=(o.tipo==='fisica'?'Sessão sua':o.tipo==='agente'?'Sessão de agente':'Sessão')+' · '+(t.projeto||'?');
    fala=tit+'. '+(o.quem?'Aberta por '+o.quem+'. ':'')+(r.modelo?'Modelo '+r.modelo+(r.esforco?', esforço '+r.esforco:'')+'. ':'')+(r.ctx_pct!=null?'Contexto em '+r.ctx_pct+' por cento. ':'')+(x.ultimo_pedido?'Último pedido: '+x.ultimo_pedido:'');
    var ent={cli:'aberta à mão (claude no terminal)','sdk-cli':'automática (claude -p, sem tela)'}[t.entrada]||t.entrada||'–';
    h='<p class="exp">'+esc(o.tipo==='fisica'?'Você abriu esta sessão num terminal. Ela só anda quando você digita.':o.tipo==='agente'?'Esta sessão foi aberta por um agente ('+o.quem+'). Ela trabalha sozinha e fecha quando termina.':'Não deu para saber quem abriu esta sessão.')+(viva?'':' Esta sessão foi INTERROMPIDA: o processo sumiu sem fechar direito.')+'</p>'
      +bloco('Quem abriu e controla',lnt('tipo',o.tipo==='fisica'?'física (você)':o.tipo==='agente'?'agente':'desconhecido',o.tipo==='agente'?'':'')+lnt('quem',o.quem||'–')+(o.unidade?lnt('unidade do sistema',o.unidade):'')+lnt('como entrou',ent)+((o.cadeia||[]).length?lnt('processos pais',o.cadeia.join('  ←  ')):''))
      +bloco('Sessão',(r.nome?lnt('nome',r.nome):'')+lnt('projeto',t.projeto||'?')+(r.ativo?lnt('mexendo agora em',r.ativo):'')+lnt('pasta',t.cwd||'–')+lnt('terminal',t.tty||'sem terminal')+lnt('aberta',quando(t.inicio))+lnt('id',t.session_id))
      +bloco('Modelo',lnt('modelo',r.modelo||x.modelo||'–')+(r.esforco?lnt('esforço',r.esforco):'')+(r.rapido?lnt('modo rápido','ligado'):'')+(r.versao?lnt('Claude Code',r.versao):'')+(r.em?'':lnt('retrato da statusline','sem — sessão sem barra de status (claude -p) ou ainda não desenhou','')))
      +(r.em?bloco('Uso',lnt('contexto',(r.ctx_pct!=null?r.ctx_pct+'%':'–')+(r.ctx_tokens?' · '+n(r.ctx_tokens/1000,0)+' mil de '+n((r.ctx_janela||0)/1000,0)+' mil tokens':''),r.ctx_pct>=85?'erro':r.ctx_pct>=70?'aviso':'')+lnt('custo equivalente','US$ '+Number(r.custo_usd||0).toFixed(2))+lnt('tempo total',r.dur_ms?Math.round(r.dur_ms/60000)+' min':'–')+lnt('tempo do modelo',r.api_ms?Math.round(r.api_ms/60000)+' min':'–')+lnt('linhas mudadas','+'+n(r.linhas_mais,0)+' / −'+n(r.linhas_menos,0))+lnt('lido',ha(r.em))):'')
      +(pr?bloco('Processo',lnt('CPU',n(pr.cpu)+'%')+lnt('memória',n(pr.mem_mb,0)+' MB')+lnt('rodando há',ha(Date.now()/1000-pr.rodando_s).replace('há ',''))):'')
      +bloco('Conversa',lnt('última atividade',x.ultima_atividade?quando(x.ultima_atividade):'–')+lnt('último pedido',x.ultimo_pedido||'–')+lnt('última resposta',x.ultima_resposta||'–')+(x.tamanho_mb!=null?lnt('tamanho',n(x.tamanho_mb)+' MB'):''))
      +'<h4>O que fazer com esta sessão</h4><p class="acoes"><button type="button" class="fch" id="bConv" data-sid="'+esc(t.session_id)+'">👁 Visualizar conversa</button>'
      +(viva&&t.tmux?'<button type="button" class="fch" id="bTela" data-sid="'+esc(t.session_id)+'">🖥 Ver tela ao vivo</button>'+(td.assumir?'<button type="button" class="fch quente" id="bAssumir" data-sid="'+esc(t.session_id)+'">⌨ Assumir</button>':''):'')+'</p>'
      +(viva&&!t.tmux?'<p class="dica">Ver a tela ao vivo e assumir só funcionam em sessões abertas dentro do tmux do painel (<b>tmux -L '+esc(td.tmux_servidor||'painel')+' new -s nome claude</b>). Aqui é só visualizar a conversa.</p>':'')
      +(viva&&t.tmux&&!td.assumir?'<p class="dica">Assumir está desligado (inicie o painel com PAINEL_ASSUMIR=1).</p>':'')
      +'<pre id="tela" class="tela oculto"></pre><div id="assumir" class="assumir oculto"><p class="dica">Você está digitando NESTA sessão'+(o.tipo==='fisica'?' (a mesma que está aberta no seu terminal)':'')+'. Enter envia; Shift+Enter quebra linha.</p><textarea id="aTexto" rows="3" placeholder="Escreva o pedido para esta sessão…"></textarea><p class="acoes"><button type="button" class="fch quente" data-env="texto">Enviar</button><button type="button" class="fch" data-env="Escape">Esc (parar)</button><button type="button" class="fch" data-env="C-c">Ctrl+C</button><button type="button" class="fch" data-env="Up">↑</button><button type="button" class="fch" data-env="Down">↓</button><button type="button" class="fch" data-env="Enter">Enter</button></p><p class="sub" id="aMsg"></p></div>'
      +'<div id="conv" class="conv oculto"></div>'}
  if(!tit)return;fTexto=fala;$('fTit').textContent=tit;$('fCorpo').innerHTML=h;$('folha').classList.add('aberta');$('fFechar').focus()}
var convT=null,telaT=null,confirmouAssumir=false;
function fecharDet(){$('folha').classList.remove('aberta');if(convT){clearInterval(convT);convT=null}if(telaT){clearInterval(telaT);telaT=null}}
async function lerTela(sid){var c=$('tela');if(!c)return;try{var r=await fetch('/api/painel/terminal/tela?id='+encodeURIComponent(sid),{cache:'no-store',credentials:'same-origin'});var j=await r.json();c.textContent=r.ok?j.tela:(j.erro||('HTTP '+r.status));c.scrollTop=c.scrollHeight}catch(e){c.textContent='não consegui ler a tela: '+e.message}}
function ligarTela(sid){var c=$('tela');c.classList.remove('oculto');lerTela(sid);if(telaT)clearInterval(telaT);telaT=setInterval(function(){lerTela(sid)},2000)}
async function enviar(sid,corpo){var m=$('aMsg');m.textContent='enviando…';try{var r=await fetch('/api/painel/terminal/enviar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Painel':'1'},body:JSON.stringify(Object.assign({id:sid},corpo))});var j=await r.json();m.textContent=r.ok?'enviado às '+new Date().toLocaleTimeString('pt-BR'):('não foi: '+(j.erro||('HTTP '+r.status)));if(r.ok)setTimeout(function(){lerTela(sid)},600)}catch(e){m.textContent='não foi: '+e.message}}
document.addEventListener('click',function(ev){var b=ev.target.closest('#bTela,#bAssumir,[data-env]');if(!b)return;
  if(b.id==='bTela'){ligarTela(b.dataset.sid);b.disabled=true;b.textContent='🖥 Tela ao vivo (a cada 2 s)';return}
  if(b.id==='bAssumir'){if(!confirmouAssumir&&!confirm('Assumir esta sessão? O que você digitar aqui vai direto para o Claude, que roda sem pedir permissão.'))return;confirmouAssumir=true;ligarTela(b.dataset.sid);$('assumir').classList.remove('oculto');$('assumir').dataset.sid=b.dataset.sid;var bt=$('bTela');if(bt){bt.disabled=true}b.disabled=true;b.textContent='⌨ Assumida';$('aTexto').focus();return}
  var sid=$('assumir').dataset.sid;if(!sid)return;
  if(b.dataset.env==='texto'){var t=$('aTexto').value;if(!t.trim())return;enviar(sid,{texto:t});$('aTexto').value='';$('aTexto').focus();return}
  enviar(sid,{tecla:b.dataset.env})});
document.addEventListener('keydown',function(ev){if(ev.target&&ev.target.id==='aTexto'&&ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();var sid=$('assumir').dataset.sid,t=ev.target.value;if(sid&&t.trim()){enviar(sid,{texto:t});ev.target.value=''}}},true);
var QUEM={voce:'você',claude:'claude',ferramenta:'ferramenta',resultado:'resultado'};
async function lerConv(sid){var c=$('conv');if(!c)return;try{var r=await fetch('/api/painel/terminal?id='+encodeURIComponent(sid)+'&n=120',{cache:'no-store',credentials:'same-origin'});var j=await r.json();
  if(!r.ok){c.innerHTML='<p class="sub">'+esc(j.erro||('HTTP '+r.status))+'</p>';return}
  var fim=c.scrollTop+c.clientHeight>=c.scrollHeight-30;
  c.innerHTML=(j.mensagens||[]).map(function(m){return'<div class="msg '+m.quem+'"><span>'+QUEM[m.quem]+(m.quando?' · '+hm(m.quando):'')+'</span><p>'+esc(m.texto)+'</p></div>'}).join('')||'<p class="sub">sem mensagens</p>';
  if(fim)c.scrollTop=c.scrollHeight}catch(e){c.innerHTML='<p class="sub">não consegui ler: '+esc(e.message)+'</p>'}}
document.addEventListener('click',function(ev){var b=ev.target.closest('#bConv');if(!b)return;var c=$('conv');c.classList.remove('oculto');b.textContent='Atualizando a cada 5 s (só leitura)';b.disabled=true;lerConv(b.dataset.sid).then(function(){c.scrollTop=c.scrollHeight});if(convT)clearInterval(convT);convT=setInterval(function(){lerConv(b.dataset.sid)},5000)});
$('fFechar').addEventListener('click',fecharDet);
$('fFalar').addEventListener('click',function(){if(fTexto)falar(fTexto,'detalhe')});
$('folha').addEventListener('click',function(ev){if(ev.target.id==='folha')fecharDet()});
document.addEventListener('click',function(ev){if(ev.target.closest('button[data-id]'))return;var t=ev.target.closest('[data-det]');if(!t)return;ev.preventDefault();abrirDet(t.dataset.det)});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape')fecharDet();var t=ev.target;if((ev.key==='Enter'||ev.key===' ')&&t.dataset&&t.dataset.det&&t.tagName!=='BUTTON'&&t.tagName!=='A'){ev.preventDefault();abrirDet(t.dataset.det)}});
function desenhar(){if(!D)return;var c=contagem(),sis=sistemas(),ordem={erro:0,aviso:1,rodando:2,ok:3,semdados:4};
  $('modoLista').classList.toggle('oculto',MODO!=='lista');$('vis').classList.toggle('oculto',MODO==='lista');
  if(MODO!=='lista'){var hv=MODO==='icones'?icones():graficos();if($('vis').dataset.h!==hv){$('vis').innerHTML=hv;$('vis').dataset.h=hv}}
  $('ver').textContent='v'+D.versao+' · leitura '+hm(D.gerado_em);
  $('subSis').textContent=c.total+' sistemas · '+c.ok+' ok'+(c.erros?' · '+plural(c.erros,'erro','erros'):'')+(c.avisos?' · '+plural(c.avisos,'aviso','avisos'):'');
  $('listaSis').innerHTML=sis.slice().sort(function(a,b){return ordem[a.estado]-ordem[b.estado]}).map(function(s){return'<li data-det="sis:'+s.nome+'" tabindex="0"><span class="ponto '+s.estado+'" aria-hidden="true"></span><span class="nome">'+esc(NOMES[s.nome])+'</span><span class="rot '+s.estado+'">'+ROT[s.estado]+'</span><span class="acao">'+esc(s.frase)+'</span></li>'}).join('');
  $('listaSes').innerHTML=sesJ().map(function(t){var r=t.retrato||{},rec=Date.now()/1000-atS(t)<120;return'<li data-det="term:'+esc(t.session_id)+'" tabindex="0"><span class="ponto '+(rec?'rodando':'')+'" aria-hidden="true"></span><span class="nome">'+emoS(t)+' '+esc(projS(t))+(t.tmux?' · tmux':'')+'</span><span class="rot">'+(r.ctx_pct!=null?'ctx '+r.ctx_pct+'%':'')+'</span><span class="acao">'+esc(subS(t))+'</span></li>'}).join('')||'<li><span></span><span class="acao">nenhuma sessão aberta</span></li>';
  var tm=(D.grupos.producao&&D.grupos.producao.dados&&D.grupos.producao.dados.timers)||[],agora=Date.now()/1000;
  $('listaTim').innerHTML=tm.filter(function(t){return t.proxima&&t.proxima>agora-60}).sort(function(a,b){return a.proxima-b.proxima}).slice(0,8).map(function(t){return'<li data-det="sis:producao" tabindex="0"><span class="ponto info" aria-hidden="true"></span><span class="nome">'+esc(t.unidade)+'</span><span class="rot">'+hm(t.proxima)+'</span><span class="acao">última: '+esc(t.ultima?ha(t.ultima):'ainda não rodou')+'</span></li>'}).join('')||'<li><span></span><span class="acao">nenhum timer à vista</span></li>';
  var ult=(D.grupos.publicacao&&D.grupos.publicacao.dados&&D.grupos.publicacao.dados.ultimos)||[];
  $('listaPub').innerHTML=ult.slice(0,5).map(function(u,i){return'<li data-det="pub:'+i+'" tabindex="0"><span class="ponto" aria-hidden="true"></span><span class="nome" title="'+esc(u.titulo)+'">'+esc(u.titulo||u.video_id)+'</span><span class="rot">'+esc(u.canal)+'</span><span class="acao">'+ha(u.quando)+'</span></li>'}).join('')||'<li><span></span><span class="acao">nada publicado ainda</span></li>';
  var esp=esperando();$('subEsp').textContent=plural(c.abertos,'aberto','abertos')+' · '+plural(esp.length-c.abertos,'marcado','marcados')+' na tela';
  $('listaEsp').innerHTML=esp.map(function(x){var m=marcas[x.id];return'<li class="'+(m?'marcado':'')+'" data-det="esp:'+x.id+'" tabindex="0"><span class="ponto '+x.nivel+'" aria-hidden="true"></span><span class="titulo '+x.nivel+'">'+esc(x.texto)+'</span><span class="botoes">'+(m?'<span class="marca-tela">'+(m==='aprovado'?'Visto':'Depois')+' (só na tela)</span><button type="button" data-id="'+x.id+'" data-m="">Desfazer</button>':'<button type="button" data-id="'+x.id+'" data-m="aprovado">Visto</button><button type="button" data-id="'+x.id+'" data-m="depois">Depois</button>')+'</span></li>'}).join('')||'<li><span></span><span class="titulo">Nada esperando você.</span></li>';
  $('contas').innerHTML='<span class="'+(c.erros?'er':'')+'"><b>'+c.erros+'</b> erros</span><span class="al"><b>'+c.avisos+'</b> avisos</span><span><b>'+c.publicados+'</b> publicados hoje</span><span><b>'+c.ocupadas+'</b> vagas ocupadas</span>';
  if(!falando&&partiu)$('status').textContent=c.erros?plural(c.erros,'erro','erros')+' pedindo atenção':c.avisos?plural(c.avisos,'aviso','avisos'):'tudo em ordem';
  var sair=$('sair'),ss=D.sessao;if(sair)sair.hidden=!ss||ss.via!=='senha'}
$('listaEsp').addEventListener('click',function(ev){var b=ev.target.closest('button[data-id]');if(!b)return;if(b.dataset.m)marcas[b.dataset.id]=b.dataset.m;else delete marcas[b.dataset.id];LS.set('jarvis.marcas',JSON.stringify(marcas));desenhar()});
// ---------- fala ----------
var vozPt=null;function acharVoz(){var vs=(window.speechSynthesis&&speechSynthesis.getVoices())||[];vozPt=vs.filter(function(v){return/pt[-_]BR/i.test(v.lang)})[0]||vs.filter(function(v){return/^pt/i.test(v.lang)})[0]||null}
if(window.speechSynthesis){acharVoz();speechSynthesis.onvoiceschanged=acharVoz}
var digitando=0;function digitar(texto){var alvo=$('resposta'),id=++digitando,i=0;if(REDUZ){alvo.textContent=texto;return}
  (function passo(){if(id!==digitando)return;i=Math.min(texto.length,i+Math.max(2,Math.round(2*VEL)));alvo.innerHTML=esc(texto.slice(0,i))+'<span class="cursor"></span>';if(i<texto.length)setTimeout(passo,14)})()}
function falar(texto,rotulo){digitar(texto);ondaAte=performance.now()+Math.min(9000,9*texto.length/VEL+600);$('status').textContent=rotulo||'falando';
  var fim=function(){falando=false;desenhar()};
  if(!vozLigada||!window.speechSynthesis){falando=true;setTimeout(fim,Math.min(6000,60*texto.length));return}
  try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(texto);u.lang='pt-BR';if(vozPt)u.voice=vozPt;u.rate=VEL;
    var vigia=setTimeout(fim,Math.max(3000,90*texto.length/VEL));u.onend=u.onerror=function(){clearTimeout(vigia);fim()};falando=true;speechSynthesis.speak(u)}catch(e){fim()}}
function saudacao(){var h=new Date().getHours();return h<5?'Boa madrugada':h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}
function textoBomDia(){var c=contagem(),esp=esperando().filter(function(x){return!marcas[x.id]}),prod=D.grupos.producao&&D.grupos.producao.dados,prox=null;
  if(prod)prox=(prod.timers||[]).filter(function(t){return t.proxima&&/diario|publicar|dia$/.test(t.unidade)}).sort(function(a,b){return a.proxima-b.proxima})[0];
  return saudacao()+', '+NOME+'. '+c.ok+' de '+c.total+' sistemas em ordem'+(c.erros?', '+plural(c.erros,'erro','erros'):'')+(c.avisos?', '+plural(c.avisos,'aviso','avisos'):'')+'. '
    +plural(c.publicados,'vídeo publicado','vídeos publicados')+' hoje. '+(prox?'Próxima rodada: '+prox.unidade.replace(/-/g,' ')+' às '+hm(prox.proxima)+'. ':'')
    +(esp.length?'A primeira coisa a ver: '+esp[0].texto+'.':'Nada esperando você.')}
var CMDS={
  bomdia:function(){falar(textoBomDia(),'bom dia')},
  status:function(){var s=sistemas().map(function(x){return NOMES[x.nome]+': '+x.frase}).slice(0,5).join('. ');falar('Status. '+s+'. Leitura '+ha(D.gerado_em)+'.','status')},
  espera:function(){var ab=esperando().filter(function(x){return!marcas[x.id]});if(!ab.length)return falar('Nada esperando você. Tudo marcado.','livre');
    falar(plural(ab.length,'coisa esperando','coisas esperando')+' você. '+ab.slice(0,3).map(function(x,i){return(i+1)+': '+x.texto}).join('. ')+'.','esperando você')},
  modo:function(){var ms=['lista','icones','graficos'],m=ms[(ms.indexOf(MODO)+1)%3];trocarModo(m);falar('Visão: '+{lista:'lista',icones:'ícones',graficos:'gráficos'}[m]+'.','visão')},
  foco:function(){var on=document.body.classList.toggle('foco');$('bFoco').classList.toggle('on',on);$('bFoco').setAttribute('aria-pressed',String(on));falar(on?'Modo foco ligado. Escondi os painéis.':'Modo foco desligado.',on?'modo foco':'')}
};
document.querySelectorAll('.barra button').forEach(function(b){b.addEventListener('click',function(){if(D)CMDS[b.dataset.cmd]()})});
addEventListener('keydown',function(ev){if(ev.target.closest&&ev.target.closest('input,textarea'))return;if($('folha').classList.contains('aberta')&&ev.key!=='Escape')return;var k={'1':'bomdia','2':'status','3':'espera','4':'foco','5':'modo'}[ev.key];if(k&&D)CMDS[k]()});
function pintarVoz(){$('voz').textContent='Voz: '+(vozLigada?'ligada':'desligada');$('voz').classList.toggle('desl',!vozLigada);$('voz').setAttribute('aria-pressed',String(vozLigada))}
var VELS=[1,1.3,1.6,2],VEL=Number(LS.get('jarvis.vel','1.3'));if(VELS.indexOf(VEL)<0)VEL=1.3;
function pintarVel(){$('vel').textContent='Velocidade: '+String(VEL).replace('.',',')+'×'}
$('vel').addEventListener('click',function(){VEL=VELS[(VELS.indexOf(VEL)+1)%VELS.length];LS.set('jarvis.vel',String(VEL));pintarVel();falar('Velocidade '+String(VEL).replace('.',',')+'.','velocidade')});pintarVel();
$('voz').addEventListener('click',function(){vozLigada=!vozLigada;pintarVoz();LS.set('jarvis.voz',vozLigada?'1':'0');if(!vozLigada&&window.speechSynthesis)speechSynthesis.cancel()});
if(!window.speechSynthesis){vozLigada=false;$('voz').disabled=true}
pintarVoz();
// Alertas novos (depois da primeira leitura) viram fala, uma vez cada.
function vozNovos(al){var novos=al.filter(function(a){return!falados[a.chave]});novos.forEach(function(a){falados[a.chave]=1});if(novos.length&&partiu)falar('Atenção. '+novos.slice(0,3).map(function(a){return a.texto}).join('. ')+'.','alerta novo')}
// ---------- dados ----------
async function ler(){try{var r=await fetch('/api/painel',{cache:'no-store',credentials:'same-origin'});
  if(r.status===401){location.href='/login';return}
  if(!r.ok)throw new Error('HTTP '+r.status);D=await r.json();if(D&&D.tela&&D.tela.nome_falado)NOME=D.tela.nome_falado;
  if(primeira){(D.alertas||[]).forEach(function(a){falados[a.chave]=1});primeira=false}else vozNovos(D.alertas||[]);
  desenhar()}catch(e){$('ver').textContent='sem conexão com o bot ('+e.message+') — tento de novo em 15 s'}}
// ---------- relógio ----------
function relogio(){var d=new Date();$('relogio').textContent=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});$('data').textContent=d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}
relogio();setInterval(relogio,1000);
// ---------- núcleo (canvas) ----------
var cv=$('cv'),cx=cv.getContext&&cv.getContext('2d');
function ajustar(){var r=cv.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);cv.width=Math.max(200,r.width*dpr);cv.height=Math.max(200,r.height*dpr)}
addEventListener('resize',ajustar);ajustar();
var ANEIS=[{r:.84,v:.18,seg:64,w:2,gap:.35},{r:.74,v:-.42,seg:6,w:6,gap:.5},{r:.64,v:.9,seg:24,w:3,gap:.3}];
var t0=performance.now(),visivel=true;
document.addEventListener('visibilitychange',function(){visivel=!document.hidden;if(visivel)requestAnimationFrame(quadro)});
function quadro(agora){if(!visivel||!cx)return;var t=(agora-t0)/1000,W=cv.width,H=cv.height,R=Math.min(W,H)/2,X=W/2,Y=H/2,k=W/520;
  var erro=D&&(D.alertas||[]).some(function(a){return a.nivel==='erro'}),cor=erro?'255,93,108':'95,227,255';
  cx.clearRect(0,0,W,H);var pulso=REDUZ?.7:.55+.45*(.5+.5*Math.sin(t*2.1));
  var g=cx.createRadialGradient(X,Y,0,X,Y,R*.62);g.addColorStop(0,'rgba(160,240,255,'+(.30*pulso)+')');g.addColorStop(.6,'rgba('+cor+','+(.12*pulso)+')');g.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=g;cx.beginPath();cx.arc(X,Y,R*.62,0,7);cx.fill();
  ANEIS.forEach(function(a,i){var rot=REDUZ?i:t*a.v,rr=R*a.r,passo=Math.PI*2/a.seg;cx.beginPath();
    for(var s=0;s<a.seg;s++){var ini=rot+s*passo;cx.moveTo(X+Math.cos(ini)*rr,Y+Math.sin(ini)*rr);cx.arc(X,Y,rr,ini,ini+passo*(1-a.gap))}
    cx.lineWidth=a.w*3.5*k;cx.strokeStyle='rgba('+cor+','+(.10+.10*pulso)+')';cx.stroke();
    cx.lineWidth=a.w*k;cx.strokeStyle=i===1?'rgba(232,247,255,.9)':'rgba('+cor+','+(.6+.35*pulso)+')';cx.stroke()});
  cx.strokeStyle='rgba('+cor+',.25)';cx.lineWidth=k;cx.beginPath();
  for(var s=0;s<120;s++){var an=s*Math.PI/60-(REDUZ?0:t*.05),r1=R*.9,r2=R*(s%10?.92:.95);cx.moveTo(X+Math.cos(an)*r1,Y+Math.sin(an)*r1);cx.lineTo(X+Math.cos(an)*r2,Y+Math.sin(an)*r2)}
  cx.stroke();
  if(falando||agora<ondaAte){for(var q=0;q<2;q++){cx.beginPath();for(var p=0;p<=180;p++){var b=p/180*Math.PI*2,amp=R*.035*(Math.sin(b*6+t*9+q*2)*.6+Math.sin(b*11-t*13)*.4)*(.6+.4*Math.sin(t*7+q)),r=R*(.55+q*.035)+amp,x=X+Math.cos(b)*r,y=Y+Math.sin(b)*r;if(p)cx.lineTo(x,y);else cx.moveTo(x,y)}
    cx.strokeStyle=q?'rgba(232,247,255,.45)':'rgba('+cor+',.85)';cx.lineWidth=2*k;cx.stroke()}}
  requestAnimationFrame(quadro)}
requestAnimationFrame(quadro);
// ---------- partida (~3 s) ----------
function espera(ms){return new Promise(function(r){setTimeout(r,ms)})}
async function partida(){await ler();var c=D?contagem():null;
  var linhas=['> Inicializando…','> Sistemas no ar. ('+(c?c.ok+' de '+c.total+' em ordem':'sem leitura')+')','> '+saudacao()+', '+NOME+'.'],pre=$('partidaTxt');
  if(REDUZ){pre.textContent=linhas.join('\n');await espera(800)}
  else for(var i=0;i<linhas.length;i++){for(var j=0;j<=linhas[i].length;j++){pre.textContent=linhas.slice(0,i).join('\n')+(i?'\n':'')+linhas[i].slice(0,j);await espera(22)}await espera(380)}
  $('partida').classList.add('fim');document.body.classList.remove('partindo');partiu=true;
  var hs=decodeURIComponent(location.hash.slice(1));if(/^(sis|term):[\w-]+$/.test(hs))abrirDet(hs);
  if(D)falar(saudacao()+', '+NOME+'. '+(c.erros?plural(c.erros,'erro pedindo','erros pedindo')+' atenção.':'Sistemas no ar.'),'online');
  setInterval(ler,15000)}
partida();
})();`;

const escH = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** HTML do Jarvis; `titulo` vem da config. */
export const paginaJarvis = (titulo = 'de agentes'): string => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>JARVIS — Painel ${escH(titulo)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<style>${JARVIS_CSS}</style></head>
<body class="partindo">
<div id="partida" aria-hidden="true"><pre id="partidaTxt"></pre></div>
<div class="app">
  <header>
    <span class="marca">JARVIS · ${escH(titulo.toUpperCase())}</span>
    <span class="ver" id="ver">carregando…</span>
    <span class="data" id="data"></span>
    <span class="relogio" id="relogio">--:--</span>
    <span class="seg" role="group" aria-label="Como mostrar os sistemas"><button type="button" data-modo="lista" aria-pressed="true">Lista</button><button type="button" data-modo="icones" aria-pressed="false">Ícones</button><button type="button" data-modo="graficos" aria-pressed="false">Gráficos</button></span>
    <button class="selo" id="voz" type="button" aria-pressed="true">Voz: ligada</button>
    <button class="selo" id="vel" type="button" title="Velocidade da fala (clique para trocar)">Velocidade: 1,3×</button>
    <a class="selo" href="/painel" title="Voltar ao painel com os cartões">Painel clássico</a>
    <span id="sair" hidden><form class="in" method="post" action="/logout"><button class="selo" type="submit">Sair</button></form></span>
  </header>
  <main>
    <section class="painel" aria-labelledby="hSis">
      <h2 id="hSis">Sistemas</h2>
      <p class="sub" id="subSis">lendo…</p>
      <div class="rolar">
        <div id="vis" class="oculto"></div>
        <div id="modoLista">
          <ul class="lista" id="listaSis"></ul>
          <h3>Sessões do Claude</h3><ul class="lista" id="listaSes"></ul>
          <h3>Próximos timers</h3><ul class="lista" id="listaTim"></ul>
          <h3>Últimos publicados</h3><ul class="lista" id="listaPub"></ul>
        </div>
      </div>
    </section>
    <section class="nucleo" aria-label="Núcleo do Jarvis">
      <canvas id="cv" width="520" height="520" aria-hidden="true"></canvas>
      <div class="centro"><div class="nomeia">JARVIS</div><div class="status" id="status">inicializando</div></div>
      <div class="contas" id="contas"></div>
    </section>
    <section class="painel" aria-labelledby="hEsp">
      <h2 id="hEsp">Esperando você</h2>
      <p class="sub" id="subEsp">lendo…</p>
      <div class="rolar"><ul class="lista esp" id="listaEsp"></ul></div>
      <p class="aviso-rod">Visto e Depois só marcam nesta tela (ficam neste navegador). Nada é executado.</p>
    </section>
  </main>
  <footer>
    <div class="resposta" id="resposta" aria-live="polite"></div>
    <div class="barra" role="toolbar" aria-label="Atalhos">
      <span class="pr">&gt;_</span>
      <button type="button" data-cmd="bomdia">Bom dia<kbd>1</kbd></button>
      <button type="button" data-cmd="status">Status<kbd>2</kbd></button>
      <button type="button" data-cmd="espera">O que espera<kbd>3</kbd></button>
      <button type="button" data-cmd="foco" id="bFoco" aria-pressed="false">Modo foco<kbd>4</kbd></button>
      <button type="button" data-cmd="modo" id="bModo">Trocar visão<kbd>5</kbd></button>
    </div>
  </footer>
</div>
<div class="folha" id="folha" role="dialog" aria-modal="true" aria-labelledby="fTit"><div class="cx"><div class="cab"><h2 id="fTit"></h2><button type="button" class="fch" id="fFalar">Falar</button><button type="button" class="fch" id="fFechar">Fechar (Esc)</button></div><div id="fCorpo"></div></div></div>
<script>${JARVIS_JS}</script>
</body></html>`;
