# painel-agentes

[![painel-agentes](guia/assets/banner-en.jpg)](https://inematds.github.io/painel-agentes/guia/en/)

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

## What it is

painel-agentes is a page that runs on your computer and shows, all on one screen, what all your AI agents are doing: open Claude Code sessions (and whether you or a bot opened them), bots, publishing queues, subscription limits, and whether your websites are up. It is for people who leave several agents working and lose track of where each one is. You can rearrange the panels as you like and, if you want, chat with a bot or terminal right there. It requires Node 20+ and Linux; for a quick look, demo mode does not read any of your data.

## 📖 User guide

Complete guide (landing page + walkthrough, with screenshots): **https://inematds.github.io/painel-agentes/guia/en/**

Simple Python version (one file): [jarvis-painel](https://inematds.github.io/jarvis-painel/guia/).

The dashboard interface is in Portuguese.

## In detail

A monitoring dashboard for people who leave **AI agents working on a machine**
(Claude Code, Codex, bots, systemd timers). All on one screen: machine health,
bots, automated runs, publishing queues, subscription limits, websites, heavy
work slots, and **all Claude Code sessions currently open**, including who opened
each one (👤 you or 🤖 an agent).

Node 22 + TypeScript, no framework, no client-side build, no database of its own. It only reads
what is already on the machine. Inspired by the INEMA dashboard.

## Who it’s for

- People running several agents/bots on their own machine or a VPS who want to see at a glance
  what is running, what failed, and what is waiting for them.
- People who want a TV/monitor in the corner showing the status of everything, with voice alerts
  only for new alerts.

## What appears on screen

**Classic dashboard (`/painel`)** — 9 panels:

| Panel | What it shows | Source |
|---|---|---|
| Esperando você (Waiting for you) | failures, stuck runs, waits past their limit, interrupted terminals, deadline alerts, your pending items | combines the other groups + pending-items file |
| Máquina (Machine) | memory (and disk cache), disk, load, reboots, GPU out of memory | `/proc`, `statfs`, `journalctl` |
| Bots (Bots) | systemd services and, for each SQLite database, running / queued / failures in the last 24 h | `systemctl --user`, config databases (read-only) |
| Produção (Production) | today's runs, stuck runs (> 90 min), failures, long waits, upcoming timers | `rodadas.jsonl`, waits file, `systemctl --user list-timers` |
| Publicação (Publishing) | today's and this week's sends by channel and **queues item by item** | JSONL history + config queues |
| Créditos e logins (Credits and logins) | % of Claude and Codex limits and manual deadline alerts | your statusline JSON, `~/.codex/sessions`, `avisos.json` |
| Sites (Sites) | whether each site responded and how long it took (1 GET every 5 min, only while the dashboard is open) | config list |
| Vagas (Slots) | how many heavy jobs can run at once per class (gpu, render…) and what is occupying them | slots file + status command (optional) |
| Terminais (Terminals) | active and interrupted Claude Code sessions: project, model, context, last activity | `~/.claude/sessions` + `~/.claude/projects` |

- **Lista (List) / Ícones (Icons) / Imagens (Images)**: three ways to view production, publishing, and terminals.
- **Queues**: each item has a single status — `pendente`, `publicando`, `feito`, `erro`,
  `retirado` — regardless of whether your queue uses `status`, `estado`, `queued`, `done`…
  An empty or corrupted queue file becomes a red alert (a sign that the process consuming
  the queue has stopped).
- **Session**: click a session to see the **Dados (Data)** tab (who opened it, parent
  processes, model, context, cost), the **Conteúdo (Content)** tab (the conversation,
  read-only, with secrets masked), and the **Terminal (Terminal)** tab (live screen and typing:
  only when Assumir (Take over) is enabled and for sessions open in the dashboard's tmux).
- **Organizar (Organize)**: rearrange the panels (tap one, then another, or drag them).
  The layout is saved in your browser (`painel.layout`).
- **Conversar (Chat)** (side drawer, off by default): talk to one of your bots over HTTP or
  to a session open in the dashboard's tmux, and open a **Novo terminal (New terminal)**.
- **Voice**: when voice is enabled, the browser speaks only alerts that appear afterward.

**Jarvis (`/jarvis`)** — the same data in a HUD-style view: animated core, a short description
for each system, timer schedule, spoken "Good morning, <name>" (the name comes from the config),
and keyboard shortcuts (1 Good morning · 2 Status · 3 What's waiting · 4 Focus mode · 5 Switch view).

## Installation

```bash
git clone https://github.com/inematds/painel-agentes
cd painel-agentes
npm ci && npm run build
cp painel.config.exemplo.json painel.config.json   # edit the paths (or remove anything you don't use)
npm run senha                                       # set the password (only the hash is stored on disk)
npm start                                           # http://127.0.0.1:3143/painel
```

Requirements: Node 20+ (tested on 22), Linux (machine data comes from `/proc`).
`better-sqlite3` is **optional**: if it is not installed (or does not compile), the Bots panel only shows
services.

To keep it running automatically, a user systemd service is enough:

```ini
# ~/.config/systemd/user/painel-agentes.service
[Service]
WorkingDirectory=%h/painel-agentes
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
[Install]
WantedBy=default.target
```

## Demo mode

```bash
npm run build && npm run demo        # = PAINEL_DEMO=1 node dist/index.js
```

Plausible **invented** data across all 9 groups (queues with items in every status, 6
example sessions with 👤 and 🤖, alerts, credits, sites, slots). It does not read any files,
run any commands, or access the network. **No login**, so it only responds on
`127.0.0.1` (binding externally is rejected) and all writes return 403. Useful for screenshots,
video recording, and previewing the screen before configuration.

## Configuration (`painel.config.json`)

Every key is optional. Without the key, the panel shows **"not configured"** — never an error.
A configured file that does not exist appears as "no data". `~` means your home folder.
To use another path: `PAINEL_CONFIG=/path/config.json`.

| Key | What it is | Default |
|---|---|---|
| `titulo` | name at the top: "Painel <titulo>" | `de agentes` |
| `nome_falado` | what Jarvis calls you | `você` |
| `porta`, `bind` | where to listen (also `PAINEL_PORT`, `PAINEL_BIND`) | `3143`, `127.0.0.1` |
| `pasta_dados` | password (hash), login sessions, and logs | `~/.config/painel-agentes` |
| `maquina.memoria_min_gb` / `disco_max_pct` / `gpu` | alert limits; `gpu:false` disables kernel reading | `1` / `90` / `true` |
| `servicos` | user systemd units to monitor | `[]` |
| `bots` | list of `{nome, banco, tabela}`: SQLite opened read-only; only `id` and `status` are required (`tarefa`, `fila`, `erro`, `resultado`, `criado_em`, `terminado_em` are used if present) | `[]` |
| `producao.rodadas` | JSONL with `{ts, unidade, fase: inicio\|fim, resultado, motivo, dur_s}` | — |
| `producao.esperas` | JSON `{chave: {estado, desde, teto_h}}` for long-running jobs | — |
| `producao.timers` / `timers_ignorar` | shows `systemctl --user list-timers` / regex for timers to hide | `false` / — |
| `publicacao.historico` | JSONL of sends `{data, canal, titulo, url, video_id}` | — |
| `publicacao.filas` | list of `{chave, nome, arquivo, formato: json\|txt\|esperas, quem}` (`quem` = who consumes the queue, for human reading only) | `[]` |
| `creditos.limites_claude` | JSON written by your statusline with `rate_limits` | — |
| `creditos.sessoes_codex` | Codex sessions folder | `~/.codex/sessions` |
| `creditos.avisos` | list `[{titulo, ate: "AAAA-MM-DD", nivel: aviso\|erro\|info}]` | `~/.config/painel-agentes/avisos.json` |
| `sites` | URLs to check | `[]` |
| `vagas.arquivo` | `{"gpu": 1, "_teto": {"gpu": 2}}` | — |
| `vagas.status_comando` | command that prints status as JSON (list of arguments) | — |
| `vagas.mudar_comando` | command called as `<cmd> <classe> <n>` by the − / + buttons | — (read-only) |
| `vagas.internas` | internal concurrency of each bot, for display only | `{}` |
| `terminais.sessoes_claude` / `projetos_claude` | where Claude Code stores sessions and conversations | `~/.claude/sessions` / `~/.claude/projects` |
| `terminais.retratos` | folder with `<id>.json` written by your statusline (model, context, cost) | — |
| `terminais.comando` | alternative: a command of your own that lists sessions as JSON | — |
| `terminais.unidades` | friendly name per unit: `{"robo.service": "robô diário"}` | `{}` |
| `assumir.tmux_servidor` | Assumir tmux server (`tmux -L <nome>`) | `painel` |
| `novo_terminal.raiz` / `lancador` | where "Novo terminal" can open and what it runs | `~/projetos` / `claude` |
| `chat.bot.nome` / `url` | bot in the Conversar drawer: `POST {texto}` → `{respostas: [...]}` | `Bot` / — (off) |
| `pendencias` | Markdown whose `- **title**` and `### title` entries (before `## Resolvidas`) become items | — |

The complete example is in [`painel.config.exemplo.json`](painel.config.exemplo.json).

## Security

- **Loopback by default.** Runs on `127.0.0.1`. To open it on the network, set `bind: "0.0.0.0"` —
  then **a password is required**: without a password, the dashboard rejects the bind and stays
  on loopback.
- **Password**: `npm run senha` stores only the scrypt hash (file mode 600). Session in an HttpOnly
  + SameSite cookie, device remembered for 365 rolling days, 5 errors per IP = 15 min
  blocked, "Log out of all devices". Every POST requires the `X-Painel: 1` header and the
  same origin (CSRF).
- **Read-only**: the dashboard does not call a model or API; databases are opened `readonly`; secrets
  found in conversations and terminals (`sk-…` keys, GitHub tokens, JWTs, `senha=`…) are
  masked before being sent.
- **Assumir and Novo terminal: off by default** (`PAINEL_ASSUMIR=1` enables them).
  ⚠️ **Risk**: Assumir **types in the agent's terminal**. If Claude is running there without asking
  for permission, anyone who accesses the dashboard controls the machine. It only works in sessions
  opened in the dashboard's tmux (`tmux -L painel new -s nome claude`); "Novo terminal" only opens
  inside the configured root, and every submission is written to `<pasta_dados>/assumir.log` (only
  the beginning, with secrets masked).
- **Bot chat: off by default** (`PAINEL_CHAT=1` **and** `chat.bot.url`).
  ⚠️ Same risk: the text goes directly to your bot.
- Recommendation: when Assumir or Chat is enabled, use it **only on a local network or VPN**;
  never expose it directly to the internet. Optional login through Cloudflare Access
  (`PAINEL_CF_ACCESS_AUD`, `PAINEL_CF_ACCESS_TEAM`, `PAINEL_EMAILS`) if you publish the
  dashboard through a tunnel.

## The process, from start to finish

Legend: 🧠 you · ⚙️ script/service · 🤖 agent

1. 🧠 **Install** — `npm ci && npm run build`.
2. 🧠 **Preview the screen** — run `npm run demo` and open `http://127.0.0.1:3143/painel` (and `/jarvis`).
3. 🧠 **Configure** — `cp painel.config.exemplo.json painel.config.json`; remove what you don't use and set the paths.
4. 🧠 **Set the password** — `npm run senha` (or `npm run senha -- --gerar`).
5. ⚙️ **Start** — `npm start` (or the systemd service above).
6. 🤖 **Agents work** — your timers, bots, and Claude Code sessions write to the runs, queues, and waits files; Claude Code stores sessions in `~/.claude`.
7. ⚙️ **The dashboard reads** — every 15 s, the screen requests `/api/painel`; collection is cached for 5 s and never writes anything.
8. ⚙️ **Alerts** — rules flag what needs attention; voice speaks only new alerts.
9. 🧠 **Take action** — open a panel, see the full failure, the session conversation, or change slots (if `mudar_comando` is configured).
10. 🧠 **(Optional) Take over / Chat** — `PAINEL_ASSUMIR=1` and/or `PAINEL_CHAT=1`, only on a trusted network.

## Development

```bash
npm test                 # vitest (65 tests, including demo mode and empty config)
npx tsc --noEmit
```

Screen rule: the client-side JS lives inside `String.raw` in `src/tela/*.ts` — **no
backticks or `${` inside it**, concatenation only (ES5). The tests check this.

## License

MIT © INEMA
