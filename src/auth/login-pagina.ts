// Tela de entrada do painel, no mesmo visual (preto, amarelo só no botão).
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function paginaLogin(o: { mensagem?: string; erro?: boolean; semSenha?: boolean; google?: boolean; titulo?: string } = {}): string {
  const tit = esc(o.titulo ?? 'de agentes');
  const msg = o.mensagem ? `<p class="msg${o.erro ? ' erro' : ''}" role="alert">${esc(o.mensagem)}</p>` : '';
  const form = o.semSenha
    ? `<p class="msg erro" role="alert">A senha do painel ainda não foi definida.</p><p class="dica">No terminal da máquina: <code>npm run senha</code> (pede a senha sem mostrar) ou <code>npm run senha -- --gerar</code>.</p>`
    // Usuário fixo "painel" (oculto, mas presente) para o gerenciador de senhas do navegador guardar o par.
    : `<form method="post" action="/login" autocomplete="on">
  <input class="oculto" type="text" name="username" value="painel" autocomplete="username" readonly tabindex="-1" aria-hidden="true">
  <label for="senha">Senha do painel</label>
  <input id="senha" name="senha" type="password" autocomplete="current-password" required autofocus maxlength="1024">
  <button type="submit">Entrar</button>
  <p class="dica">Este aparelho fica lembrado por um ano a cada uso. Para tirar, use "Sair deste aparelho" no painel.</p>
</form>`;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Entrar no painel ${tit}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0c0c10;--card:#16161e;--line:#272730;--txt:#e9e9ee;--mut:#9a9aa6;--amb:#FACC15;--bad:#F0918A}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--txt);font:400 17px/1.5 Inter,system-ui,sans-serif}
main{min-height:100vh;display:grid;place-items:center;padding:16px}
.caixa{width:min(100%,26rem);background:var(--card);border:1px solid var(--line);border-radius:16px;padding:2rem 1.6rem}
h1{font:700 1.6rem Sora,Inter,sans-serif;margin:0 0 .3rem}h1 i{font-style:normal;color:var(--amb)}
.sub{color:var(--mut);margin:0 0 1.4rem}
label{display:block;font-weight:500;margin-bottom:.4rem}
input{width:100%;background:#0c0c10;border:1px solid #34343f;border-radius:10px;color:var(--txt);font:inherit;padding:.7rem .8rem;min-height:46px}
input:focus-visible,button:focus-visible{outline:3px solid var(--amb);outline-offset:2px}
button{margin-top:1rem;width:100%;background:var(--amb);color:#1a1206;border:0;border-radius:10px;font:600 1rem Sora,Inter,sans-serif;min-height:46px;cursor:pointer}
.msg{margin:0 0 1rem;color:var(--mut)}.msg.erro{color:var(--bad)}
.dica{color:var(--mut);font-size:.95rem}
.oculto{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);border:0}code{font:400 .9rem ui-monospace,monospace;color:var(--txt)}
</style></head><body><main><div class="caixa">
<h1>Painel <i>${tit}</i></h1><p class="sub">Entre para ver a máquina, os agentes e a produção.</p>
${msg}${form}
${o.google ? '<p class="dica">Pelo endereço protegido pelo Cloudflare Access a entrada também pode ser pela conta Google.</p>' : ''}
</div></main></body></html>`;
}
