// JS do cliente, parte 1 (ajudantes) e parte 3 (laço, voz, detalhe, vagas).
// Sem template literal dentro do JS: o arquivo inteiro é um String.raw, então
// crase e "${" quebrariam calados. Só concatenação de string.
export const JS_AJUDA = String.raw`
var LS={get:function(k,d){try{var v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
var E={dados:null,modo:LS.get('painel.modo','lista'),voz:LS.get('painel.voz','0')==='1',aberto:null,tiles:{},folha:'',erro:null,msgVaga:''};
if(['lista','icones','imagens'].indexOf(E.modo)<0)E.modo='lista';
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function n(v,c){return v==null||isNaN(v)?'–':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:c==null?1:c})}
function hm(t){return t?new Date(t*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'–'}
function quando(t){if(!t)return'–';var d=new Date(t*1000),h=new Date();if(d.toDateString()===h.toDateString())return'hoje '+hm(t);return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+hm(t)}
function dur(s){if(s==null)return'–';s=Math.max(0,Math.round(s));if(s<60)return s+' s';if(s<3600)return Math.round(s/60)+' min';var h=Math.floor(s/3600),m=Math.round((s%3600)/60);if(h<48)return h+' h'+(m?' '+m:'');return Math.round(h/24)+' dias'}
function ha(t){return t?'há '+dur(Date.now()/1000-t):'–'}
function usd(v){return'US$ '+Number(v||0).toFixed(2)}
function plural(q,um,varios){return q+' '+(q===1?um:varios)}
function host(u){return String(u||'').replace(/^https?:\/\//,'').replace(/\/$/,'')}
// Cores de identificação (projeto/canal), nunca de estado; o amarelo da marca fica de fora.
var CORES=['#7CE0C6','#93c5fd','#f9a8d4','#fdba74','#c4b5fd','#86efac','#a5b4fc','#e2e8f0','#67e8f9','#fda4af'];
function cor(s){s=String(s||'?');var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return CORES[h%CORES.length]}
function inicial(s){var m=String(s||'?').replace(/^(fila-|canal-)/i,'').match(/[a-z0-9]/i);return(m?m[0]:'?').toUpperCase()}
function linha(k,v,cls){return'<div class="linha"><span class="k">'+k+'</span><span class="v '+(cls||'')+'">'+v+'</span></div>'}
function linhaTx(tx,v,cls){return'<div class="linha"><span class="tx">'+tx+'</span><span class="v '+(cls||'')+'">'+(v||'')+'</span></div>'}
function barra(p,lim){p=Math.max(0,Math.min(100,p||0));var c=p>=(lim||90)?'erro':p>=(lim||90)-15?'aviso':'';return'<span class="bar '+c+'"><i style="width:'+p+'%"></i></span>'}
function sem(g){return g&&g.ausentes&&g.ausentes.length?'<div class="sem">sem dados: '+esc(g.ausentes.join(', '))+'</div>':''}
function simb(nivel){return nivel==='erro'?'<span class="s-erro">✕</span>':nivel==='aviso'?'<span class="s-aviso">!</span>':nivel==='ok'?'<span class="s-ok">✓</span>':'<span class="fraco">·</span>'}
function ico(letra,rotulo,c,erro,dica){return'<div class="ico'+(erro?' erro':'')+'" title="'+esc(dica||rotulo)+'"><b style="background:'+c+'">'+esc(letra)+'</b><span>'+esc(rotulo)+'</span></div>'}
function cartao(img,letra,c,titulo,sub,erro){var st=img?'background-image:url(\''+esc(img)+'\')':'background:'+c;return'<div class="cartao'+(erro?' erro':'')+'"><div class="img" style="'+st+'">'+(img?'':esc(letra))+'</div><div class="txt"><b>'+esc(titulo)+'</b><span>'+esc(sub)+'</span></div></div>'}
function mais(q,mostra){return q>mostra?'<div class="mais">e mais '+(q-mostra)+' — clique para ver tudo</div>':''}
function sec(t,html,larga){return'<section class="sec'+(larga?' larga':'')+'"><h3>'+t+'</h3>'+html+'</section>'}
function tabela(cab,linhas){if(!linhas.length)return'<p class="sem">nada aqui agora</p>';return'<table><tr>'+cab.map(function(c){return'<th>'+c+'</th>'}).join('')+'</tr>'+linhas.map(function(l){return'<tr>'+l.map(function(c){return'<td>'+c+'</td>'}).join('')+'</tr>'}).join('')+'</table>'}
function okId(v){return/^[\w-]{11}$/.test(String(v||''))}
`;

export const JS_LACO = String.raw`
var NOMES={esperando:'Esperando você',maquina:'Máquina',bots:'Bots',producao:'Produção',publicacao:'Publicação',creditos:'Créditos e logins',sites:'Sites',vagas:'Vagas',terminais:'Terminais'};
var ROT={ok:'✓ ok',erro:'✕ erro',aviso:'! atenção',semdados:'– sem dados',naoconf:'– não configurado'};
function estadoGrupo(nome,g,al){if(!g||!g.ok)return'semdados';if(g.nao_configurado)return'naoconf';var e=al.filter(function(a){return a.grupo===nome});if(e.some(function(a){return a.nivel==='erro'}))return'erro';if(e.length)return'aviso';if(nome==='esperando'&&g.dados){var it=g.dados.itens;if(it.some(function(i){return i.nivel==='erro'}))return'erro';if(it.some(function(i){return i.nivel==='aviso'}))return'aviso'}return'ok'}
function hdr(){return{}}
function tile(nome){var d=E.dados,g=d.grupos[nome],st=estadoGrupo(nome,g,d.alertas),r;
  try{r=g&&g.ok&&g.nao_configurado?{frase:'<p class="frase vazia">não configurado</p>',corpo:'<div class="sem">veja o painel.config.json (README)</div>'}:g&&g.ok?G[nome].tile(g.dados,g):{frase:'<p class="frase vazia">sem dados</p>',corpo:'<div class="sem">'+esc(g&&g.erro||'fonte ausente')+'</div>'}}catch(e){r={frase:'<p class="frase vazia">sem dados</p>',corpo:'<div class="sem">erro ao desenhar: '+esc(e.message)+'</div>'}}
  return{cls:'tile t-'+nome+(st==='erro'?' erro':st==='aviso'?' aviso':''),html:'<div class="cab"><h2>'+NOMES[nome]+'</h2><span class="estado '+st+'">'+ROT[st]+'</span></div>'+r.frase+'<div class="corpo">'+r.corpo+'</div>'}}
function desenhar(){var d=E.dados;if(!d)return;
  document.getElementById('ver').textContent=(d.tela&&d.tela.demo?'DEMONSTRAÇÃO · ':'')+'v'+d.versao+' · leitura '+hm(d.gerado_em)+' em '+d.ms+' ms';
  var f=document.getElementById('faixa'),al=d.alertas,ne=al.filter(function(a){return a.nivel==='erro'}).length,na=al.length-ne,hf;
  if(al.length)hf='<span class="conta">'+(ne?plural(ne,'erro','erros'):'')+(ne&&na?', ':'')+(na?plural(na,'aviso','avisos'):'')+'</span><div class="lista">'+al.map(function(a){return'<span>'+simb(a.nivel)+' '+esc(a.texto)+'</span>'}).join('')+'</div>';
  else hf='<span class="conta s-ok">✓</span><span class="calmo">Nada pedindo atenção agora. Última leitura às '+hm(d.gerado_em)+'.</span>';
  f.className='faixa'+(al.length?' tem':'');if(E.tiles._faixa!==hf){f.innerHTML=hf;E.tiles._faixa=hf}
  Object.keys(NOMES).forEach(function(nome){var el=document.getElementById('t-'+nome),t=tile(nome);if(el.className!==t.cls)el.className=t.cls;if(E.tiles[nome]!==t.html){el.innerHTML=t.html;E.tiles[nome]=t.html}});
  marcarRolagem();
  if(E.aberto)desenharFolha(false)}
function desenharFolha(forcar){var nome=E.aberto,d=E.dados,c=document.getElementById('folha-conteudo');if(!nome||!d)return;
  if(E.sessao&&nome==='terminais'){if(forcar&&typeof sessaoMostrar==='function')sessaoMostrar();return}
  var a=document.activeElement;if(!forcar&&a&&a.tagName==='INPUT'&&c.contains(a))return;
  var g=d.grupos[nome],h;try{h=g&&g.ok&&g.nao_configurado?sec('Não configurado','<p class="sem">Nada deste grupo está na config. Veja a seção de configuração do README.</p>',1):g&&g.ok?G[nome].detalhe(g.dados,g):sec('Sem dados','<p class="sem">'+esc(g&&g.erro||'fonte ausente')+'</p>',1)}catch(e){h=sec('Erro ao desenhar','<p class="erroapi">'+esc(e.message)+'</p>',1)}
  var al=d.alertas.filter(function(x){return x.grupo===nome});if(al.length)h=sec('Alertas deste grupo',al.map(function(x){return'<div class="linha"><span class="tx">'+simb(x.nivel)+' '+esc(x.texto)+'</span></div>'}).join(''),1)+h;
  h+=sem(g)?sec('Fontes sem dados',sem(g),1):'';
  if(forcar||E.folha!==h){c.innerHTML=h;E.folha=h}}
function abrir(nome){if(typeof pararSessao==='function'){pararSessao();E.sessao=null}E.aberto=nome;E.folha='';document.getElementById('folha-titulo').textContent=NOMES[nome];var f=document.getElementById('folha');f.classList.add('aberta');desenharFolha(true);document.getElementById('fechar').focus()}
function fechar(){var n=E.aberto;E.aberto=null;if(typeof pararSessao==='function'){pararSessao();E.sessao=null}document.getElementById('folha').classList.remove('aberta');if(n)document.getElementById('t-'+n).focus()}
var falados={};try{JSON.parse(LS.get('painel.falados','[]')).forEach(function(k){falados[k]=1})}catch(e){}
function vozNovos(al){var novos=al.filter(function(a){return!falados[a.chave]});novos.forEach(function(a){falados[a.chave]=1});
  var ks=Object.keys(falados);if(ks.length>400)ks=ks.slice(-400);LS.set('painel.falados',JSON.stringify(ks));
  if(!E.voz||!novos.length||!window.speechSynthesis)return;
  var txt=novos.slice(0,3).map(function(a){return a.texto}).join('. ')+(novos.length>3?'. E mais '+(novos.length-3)+' alertas.':'');
  try{var u=new SpeechSynthesisUtterance('Atenção. '+txt);u.lang='pt-BR';speechSynthesis.speak(u)}catch(e){}}
var primeira=true;
async function ler(){try{var r=await fetch('/api/painel',{headers:hdr(),cache:'no-store'});
  if(r.status===401){location.href='/login';return}
  if(!r.ok)throw new Error('HTTP '+r.status);E.dados=await r.json();E.erro=null;
  // Na primeira leitura os alertas que já existem contam como vistos: a voz fala só o que aparecer depois.
  if(primeira){E.dados.alertas.forEach(function(a){falados[a.chave]=1});primeira=false}else vozNovos(E.dados.alertas);
  // Na porta com login (3143) a resposta traz a sessão: mostra "Sair".
  var sair=document.getElementById('sair'),ss=E.dados.sessao;if(sair){sair.hidden=!ss||ss.via!=='senha';
    var bt=document.getElementById('sair-todos-btn');if(bt&&ss)bt.textContent='Sair de todos ('+plural(ss.aparelhos||1,'aparelho','aparelhos')+')'}
  desenhar()}catch(e){E.erro=e.message;document.getElementById('ver').textContent='sem conexão com o painel ('+e.message+') — tento de novo em 15 s'}}
async function mudarVaga(classe,valor){
  E.msgVaga='Gravando '+classe+' = '+valor+'…';desenharFolha(true);
  try{var r=await fetch('/api/vagas',{method:'POST',headers:Object.assign({'Content-Type':'application/json','X-Painel':'1'},hdr()),body:JSON.stringify({classe:classe,valor:valor})});var j=await r.json();
    E.msgVaga=r.ok?('Gravado: '+classe+' = '+valor+(j.aviso?' — '+j.aviso:'')):('Não mudou: '+(j.erro||('HTTP '+r.status)));}catch(e){E.msgVaga='Não mudou: '+e.message}
  E.tiles={};await ler();desenharFolha(true)}
async function verFalha(bot,id){var c=document.getElementById('falha-'+bot+'-'+id);if(!c)return;c.style.display='block';c.textContent='carregando…';
  try{var r=await fetch('/api/painel/falha?bot='+encodeURIComponent(bot)+'&id='+encodeURIComponent(id),{headers:hdr()});var j=await r.json();c.textContent=(j.erro?'erro:\n'+j.erro+'\n\n':'')+(j.resultado?'resultado:\n'+j.resultado:'')||JSON.stringify(j,null,2)}catch(e){c.textContent='não consegui ler: '+e.message}}
function relogio(){var d=new Date();document.getElementById('hora').firstChild.nodeValue=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});document.getElementById('data').textContent=d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}
function marcarModo(){document.querySelectorAll('[data-modo]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.modo===E.modo))})}
function marcarVoz(){var b=document.getElementById('voz');b.setAttribute('aria-pressed',String(E.voz));b.textContent=E.voz?'Voz ligada':'Voz desligada'}
document.addEventListener('click',function(ev){var t=ev.target.closest('[data-modo],[data-abrir],[data-vaga],[data-falha],#voz,#fechar');if(!t){if(ev.target.id==='folha')fechar();return}
  if(t.dataset.modo){E.modo=t.dataset.modo;LS.set('painel.modo',E.modo);marcarModo();E.tiles={};desenhar();return}
  if(t.dataset.abrir){abrir(t.dataset.abrir);return}
  if(t.dataset.vaga){var p=t.dataset.vaga.split(':');mudarVaga(p[0],Number(p[1]));return}
  if(t.dataset.falha){var q=t.dataset.falha.split(':');verFalha(q[0],q[1]);return}
  if(t.id==='voz'){E.voz=!E.voz;LS.set('painel.voz',E.voz?'1':'0');marcarVoz();if(E.voz&&window.speechSynthesis){try{var u=new SpeechSynthesisUtterance('Voz ligada. Vou falar só os alertas novos.');u.lang='pt-BR';speechSynthesis.speak(u)}catch(e){}}return}
  if(t.id==='fechar'){fechar();return}});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&E.aberto)fechar();var t=ev.target;if((ev.key==='Enter'||ev.key===' ')&&t.dataset&&t.dataset.abrir&&t.tagName!=='BUTTON'){ev.preventDefault();abrir(t.dataset.abrir)}});
var st=document.getElementById('sair-todos');if(st)st.addEventListener('submit',function(ev){if(!confirm('Sair de todos os aparelhos? Cada um vai pedir a senha de novo.'))ev.preventDefault()});
// Quadro com mais conteúdo do que cabe: esmaece embaixo e mostra "role ↓" (antes parecia cortado).
function marcarRolagem(){var el=document.getElementById('t-terminais');if(!el)return;var c=el.querySelector('.corpo');if(!c)return;
  var falta=c.scrollHeight-c.clientHeight-c.scrollTop>4;if(falta)el.setAttribute('data-rola','role ↓ para ver mais');else el.removeAttribute('data-rola')}
if(typeof document!=='undefined')document.addEventListener('scroll',function(ev){if(ev.target&&ev.target.classList&&ev.target.classList.contains('corpo'))marcarRolagem()},true);
// Organizar: cada quadro pode trocar de lugar com outro (os lugares têm tamanhos fixos: o da esquerda é alto,
// o de baixo é largo). Fica guardado neste aparelho. Arrastar com o mouse ou tocar num e depois no outro.
var AREAS={esperando:'esp',maquina:'maq',bots:'bot',producao:'pro',publicacao:'pub',creditos:'cre',sites:'sit',vagas:'vag',terminais:'ter'};
function lerLayout(){var m;try{m=JSON.parse(LS.get('painel.layout','{}'))||{}}catch(e){m={}}
  var usadas=Object.keys(AREAS).map(function(g){return m[g]||AREAS[g]}),ok=Object.keys(AREAS).every(function(g){return usadas.indexOf(AREAS[g])>=0});return ok?m:{}}
function aplicarLayout(){var m=lerLayout();Object.keys(AREAS).forEach(function(g){var el=document.getElementById('t-'+g);if(el)el.style.gridArea=m[g]||''})}
function trocarQuadros(a,b){if(!a||!b||a===b)return;var m=lerLayout(),aa=m[a]||AREAS[a],ab=m[b]||AREAS[b];m[a]=ab;m[b]=aa;LS.set('painel.layout',JSON.stringify(m));aplicarLayout()}
function marcarOrg(){var on=document.body.classList.contains('organizando'),b=document.getElementById('organizar'),r=document.getElementById('restaurar');
  if(b){b.textContent=on?'Pronto':'Organizar';b.setAttribute('aria-pressed',on?'true':'false')}if(r)r.hidden=!on;var dc=document.getElementById('dica-org');if(dc)dc.hidden=!on;
  Object.keys(AREAS).forEach(function(g){var el=document.getElementById('t-'+g);if(el){el.draggable=on;el.removeAttribute('data-esc')}});E.escolhido=null}
document.addEventListener('click',function(ev){var t=ev.target.closest('#organizar,#restaurar');
  if(t&&t.id==='organizar'){document.body.classList.toggle('organizando');marcarOrg();return}
  if(t&&t.id==='restaurar'){LS.set('painel.layout','{}');aplicarLayout();marcarOrg();return}
  if(!document.body.classList.contains('organizando'))return;var q=ev.target.closest('.grade .tile');if(!q)return;
  ev.preventDefault();ev.stopPropagation();var g=q.id.replace(/^t-/,'');
  if(!E.escolhido){E.escolhido=g;q.setAttribute('data-esc','1');return}
  var a=E.escolhido;var ea=document.getElementById('t-'+a);if(ea)ea.removeAttribute('data-esc');E.escolhido=null;trocarQuadros(a,g)},true);
document.addEventListener('dragstart',function(ev){var q=ev.target.closest&&ev.target.closest('.grade .tile');if(!q||!document.body.classList.contains('organizando'))return;E.arrasta=q.id.replace(/^t-/,'');try{ev.dataTransfer.setData('text/plain',E.arrasta)}catch(e){}});
document.addEventListener('dragover',function(ev){if(E.arrasta&&ev.target.closest&&ev.target.closest('.grade .tile'))ev.preventDefault()});
document.addEventListener('drop',function(ev){var q=ev.target.closest&&ev.target.closest('.grade .tile');if(!q||!E.arrasta)return;ev.preventDefault();trocarQuadros(E.arrasta,q.id.replace(/^t-/,''));E.arrasta=null});
document.addEventListener('dragend',function(){E.arrasta=null});
aplicarLayout();
marcarModo();marcarVoz();relogio();setInterval(relogio,1000);ler();setInterval(ler,15000);
`;
