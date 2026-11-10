# painel-agentes

Painel de monitoramento para quem deixa **agentes de IA trabalhando numa máquina**
(Claude Code, Codex, bots, timers do systemd). Numa tela só: a saúde da máquina, os
bots, as rodadas automáticas, as filas de publicação, os limites da assinatura, os
sites, as vagas de trabalho pesado e **todas as sessões do Claude Code abertas agora**,
com quem abriu cada uma (👤 você ou 🤖 um agente).

Node 22 + TypeScript, sem framework, sem build no cliente, sem banco próprio. Só lê o
que já está na máquina. Inspirado no painel do INEMA.

> Guia completo: https://inematds.github.io/painel-agentes/guia/
> Versão simples em Python (um arquivo): [jarvis-painel](https://github.com/inematds/jarvis-painel).

## Para quem é

- Quem roda vários agentes/robôs na própria máquina ou numa VPS e quer saber, de relance,
  o que está rodando, o que falhou e o que está esperando por você.
- Quem quer uma TV/monitor ligado no canto mostrando o estado de tudo, com voz avisando
  só os alertas novos.

## O que aparece na tela

**Painel clássico (`/painel`)** — 9 quadros:

| Quadro | O que mostra | De onde vem |
|---|---|---|
| Esperando você | falhas, rodadas presas, esperas que passaram do teto, terminais interrompidos, avisos com prazo, suas pendências | junta os outros grupos + arquivo de pendências |
| Máquina | memória (e cache de disco), disco, carga, reinícios, GPU sem memória | `/proc`, `statfs`, `journalctl` |
| Bots | serviços do systemd e, de cada banco SQLite, rodando / na fila / falhas 24 h | `systemctl --user`, bancos da config (só leitura) |
| Produção | rodadas do dia, presas (> 90 min), falhas, esperas longas, próximos timers | `rodadas.jsonl`, arquivo de esperas, `systemctl --user list-timers` |
| Publicação | envios de hoje e da semana por canal e **as filas item por item** | histórico JSONL + filas da config |
| Créditos e logins | % dos limites do Claude e do Codex e avisos manuais com prazo | JSON da sua statusline, `~/.codex/sessions`, `avisos.json` |
| Sites | se cada site respondeu e em quanto tempo (1 GET a cada 5 min, só com o painel aberto) | lista da config |
| Vagas | quantos trabalhos pesados podem rodar juntos por classe (gpu, render…) e quem ocupa | arquivo de vagas + comando de status (opcionais) |
| Terminais | sessões do Claude Code vivas e interrompidas: projeto, modelo, contexto, última atividade | `~/.claude/sessions` + `~/.claude/projects` |

- **Lista / Ícones / Imagens**: três jeitos de ver produção, publicação e terminais.
- **Filas**: cada item com um estado só — `pendente`, `publicando`, `feito`, `erro`,
  `retirado` — não importa se a sua fila usa `status`, `estado`, `queued`, `done`…
  Arquivo de fila vazio ou corrompido vira alerta vermelho (é o sinal de que quem consome
  a fila parou).
- **Sessão**: clique numa sessão e veja as abas **Dados** (quem abriu, processos pais,
  modelo, contexto, custo), **Conteúdo** (a conversa, só leitura, segredos mascarados) e
  **Terminal** (tela ao vivo e digitar: só com o Assumir ligado e em sessões abertas no tmux do painel).
- **Organizar**: troca os quadros de lugar (toque num e depois no outro, ou arraste).
  Fica guardado no navegador (`painel.layout`).
- **Conversar** (gaveta lateral, desligada por padrão): falar com um bot seu por HTTP ou
  com uma sessão aberta no tmux do painel, e abrir um **Novo terminal**.
- **Voz**: com a voz ligada, o navegador fala só os alertas que aparecerem depois.

**Jarvis (`/jarvis`)** — os mesmos dados num visual de HUD: núcleo animado, frase curta
por sistema, agenda dos timers, "Bom dia, <nome>" falado (o nome vem da config) e atalhos
de teclado (1 Bom dia · 2 Status · 3 O que espera · 4 Modo foco · 5 Trocar visão).

## Instalação

```bash
git clone https://github.com/inematds/painel-agentes
cd painel-agentes
npm ci && npm run build
cp painel.config.exemplo.json painel.config.json   # edite os caminhos (ou apague o que não usa)
npm run senha                                       # define a senha (só o hash fica em disco)
npm start                                           # http://127.0.0.1:3143/painel
```

Requisitos: Node 20+ (testado no 22), Linux (os dados da máquina vêm do `/proc`).
`better-sqlite3` é **opcional**: se não instalar (ou não compilar), o quadro Bots só mostra
os serviços.

Para deixar rodando sozinho, um serviço do systemd do usuário basta:

```ini
# ~/.config/systemd/user/painel-agentes.service
[Service]
WorkingDirectory=%h/painel-agentes
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
[Install]
WantedBy=default.target
```

## Modo demonstração

```bash
npm run build && npm run demo        # = PAINEL_DEMO=1 node dist/index.js
```

Dados **inventados** e plausíveis nos 9 grupos (filas com itens em todos os estados, 6
sessões de exemplo com 👤 e 🤖, alertas, créditos, sites, vagas). Não lê nenhum arquivo,
não roda nenhum comando, não acessa a rede. **Sem login**, por isso só responde no
`127.0.0.1` (bind de fora é recusado) e toda escrita devolve 403. Serve para print,
gravação de vídeo e para conhecer a tela antes de configurar.

## Configuração (`painel.config.json`)

Toda chave é opcional. Sem a chave, o quadro mostra **"não configurado"** — nunca erro.
Arquivo configurado que não existe aparece como "sem dados". `~` vale para a sua pasta.
Outro caminho: `PAINEL_CONFIG=/caminho/config.json`.

| Chave | O que é | Padrão |
|---|---|---|
| `titulo` | nome no topo: "Painel <titulo>" | `de agentes` |
| `nome_falado` | como o Jarvis chama você | `você` |
| `porta`, `bind` | onde ouvir (também `PAINEL_PORT`, `PAINEL_BIND`) | `3143`, `127.0.0.1` |
| `pasta_dados` | senha (hash), sessões de login e logs | `~/.config/painel-agentes` |
| `maquina.memoria_min_gb` / `disco_max_pct` / `gpu` | limites dos alertas; `gpu:false` desliga a leitura do kernel | `1` / `90` / `true` |
| `servicos` | unidades do systemd do usuário a vigiar | `[]` |
| `bots` | lista de `{nome, banco, tabela}`: SQLite aberto só para leitura; só `id` e `status` são obrigatórios (`tarefa`, `fila`, `erro`, `resultado`, `criado_em`, `terminado_em` entram se existirem) | `[]` |
| `producao.rodadas` | JSONL com `{ts, unidade, fase: inicio\|fim, resultado, motivo, dur_s}` | — |
| `producao.esperas` | JSON `{chave: {estado, desde, teto_h}}` de trabalhos longos | — |
| `producao.timers` / `timers_ignorar` | mostra `systemctl --user list-timers` / regex de timers a esconder | `false` / — |
| `publicacao.historico` | JSONL de envios `{data, canal, titulo, url, video_id}` | — |
| `publicacao.filas` | lista de `{chave, nome, arquivo, formato: json\|txt\|esperas, quem}` (`quem` = quem consome a fila, só para leitura humana) | `[]` |
| `creditos.limites_claude` | JSON que a sua statusline grava com `rate_limits` | — |
| `creditos.sessoes_codex` | pasta das sessões do Codex | `~/.codex/sessions` |
| `creditos.avisos` | lista `[{titulo, ate: "AAAA-MM-DD", nivel: aviso\|erro\|info}]` | `~/.config/painel-agentes/avisos.json` |
| `sites` | URLs a checar | `[]` |
| `vagas.arquivo` | `{"gpu": 1, "_teto": {"gpu": 2}}` | — |
| `vagas.status_comando` | comando que imprime o status em JSON (lista de argumentos) | — |
| `vagas.mudar_comando` | comando chamado como `<cmd> <classe> <n>` pelos botões − / + | — (só leitura) |
| `vagas.internas` | concorrência interna de cada bot, só para mostrar | `{}` |
| `terminais.sessoes_claude` / `projetos_claude` | onde o Claude Code grava sessões e conversas | `~/.claude/sessions` / `~/.claude/projects` |
| `terminais.retratos` | pasta com `<id>.json` que a sua statusline grava (modelo, contexto, custo) | — |
| `terminais.comando` | alternativa: um comando seu que lista as sessões em JSON | — |
| `terminais.unidades` | nome amigável por unidade: `{"robo.service": "robô diário"}` | `{}` |
| `assumir.tmux_servidor` | servidor tmux do Assumir (`tmux -L <nome>`) | `painel` |
| `novo_terminal.raiz` / `lancador` | onde o "Novo terminal" pode abrir e o que roda | `~/projetos` / `claude` |
| `chat.bot.nome` / `url` | bot da gaveta Conversar: `POST {texto}` → `{respostas: [...]}` | `Bot` / — (desligado) |
| `pendencias` | Markdown cujos `- **título**` e `### título` (antes de `## Resolvidas`) viram itens | — |

O exemplo completo está em [`painel.config.exemplo.json`](painel.config.exemplo.json).

## Segurança

- **Loopback por padrão.** Sobe em `127.0.0.1`. Para abrir na rede, `bind: "0.0.0.0"` —
  e aí **a senha é obrigatória**: sem senha definida o painel recusa o bind e fica no
  loopback.
- **Senha**: `npm run senha` guarda só o hash scrypt (arquivo 600). Sessão em cookie
  HttpOnly + SameSite, aparelho lembrado por 365 dias deslizantes, 5 erros por IP = 15 min
  bloqueado, "Sair de todos os aparelhos". Todo POST exige o cabeçalho `X-Painel: 1` e a
  mesma origem (CSRF).
- **Só leitura**: o painel não chama modelo nem API; os bancos abrem `readonly`; segredos
  que aparecem em conversa e terminal (chaves `sk-…`, tokens do GitHub, JWT, `senha=`…) são
  mascarados antes de sair.
- **Assumir e Novo terminal: desligados por padrão** (`PAINEL_ASSUMIR=1` liga).
  ⚠️ **Risco**: Assumir **digita no terminal do agente**. Se o Claude ali roda sem pedir
  permissão, quem entrar no painel manda na máquina. Só funciona em sessões abertas no tmux
  do painel (`tmux -L painel new -s nome claude`), "Novo terminal" só abre dentro da raiz
  configurada e cada envio vai para `<pasta_dados>/assumir.log` (só o início, mascarado).
- **Conversa com bot: desligada por padrão** (`PAINEL_CHAT=1` **e** `chat.bot.url`).
  ⚠️ Mesmo risco: o texto vai direto para o seu bot.
- Recomendação: com Assumir ou Conversa ligados, use **só em rede local ou numa VPN**;
  nunca exponha direto na internet. Login opcional pelo Cloudflare Access
  (`PAINEL_CF_ACCESS_AUD`, `PAINEL_CF_ACCESS_TEAM`, `PAINEL_EMAILS`) se você publicar o
  painel por um túnel.

## O processo, do início ao fim

Legenda: 🧠 você · ⚙️ script/serviço · 🤖 agente

1. 🧠 **Instalar** — `npm ci && npm run build`.
2. 🧠 **Conhecer a tela** — `npm run demo` e abrir `http://127.0.0.1:3143/painel` (e `/jarvis`).
3. 🧠 **Configurar** — `cp painel.config.exemplo.json painel.config.json`; apagar o que não usa, apontar os caminhos.
4. 🧠 **Definir a senha** — `npm run senha` (ou `npm run senha -- --gerar`).
5. ⚙️ **Subir** — `npm start` (ou o serviço do systemd acima).
6. 🤖 **Os agentes trabalham** — seus timers, bots e sessões do Claude Code escrevem nos arquivos de rodadas, filas e esperas; o Claude Code grava as sessões em `~/.claude`.
7. ⚙️ **O painel lê** — a cada 15 s a tela pede `/api/painel`; a coleta tem cache de 5 s e nunca escreve nada.
8. ⚙️ **Alertas** — as regras marcam o que pede atenção; a voz fala só o que for novo.
9. 🧠 **Agir** — abrir o quadro, ver a falha completa, a conversa da sessão, mudar vagas (se `mudar_comando` estiver configurado).
10. 🧠 **(Opcional) Assumir / Conversar** — `PAINEL_ASSUMIR=1` e/ou `PAINEL_CHAT=1`, só em rede de confiança.

## Desenvolvimento

```bash
npm test                 # vitest (65 testes, inclusive modo demo e config vazia)
npx tsc --noEmit
```

Regra da tela: o JS do cliente vive dentro de `String.raw` em `src/tela/*.ts` — **nada de
crase nem `${` dentro dele**, só concatenação (ES5). Os testes conferem.

## Licença

MIT © INEMA
