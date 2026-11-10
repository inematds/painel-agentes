# painel-agentes

[![painel-agentes](guia/assets/banner-es.jpg)](https://inematds.github.io/painel-agentes/guia/es/)

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

## Qué es

painel-agentes es una página que se ejecuta en tu computadora y muestra, en una sola pantalla, todo lo que están haciendo tus agentes de IA: las sesiones de Claude Code abiertas (y si las abriste tú o un robot), los bots, las colas de publicación, los límites de la suscripción y si tus sitios están en línea. Sirve para quienes dejan varios agentes trabajando y pierden la cuenta de dónde está cada uno. Puedes cambiar los cuadros de lugar como prefieras y, si quieres, conversar con un bot o una terminal desde allí mismo. Necesitas Node 20+ y Linux; para conocerlo, el modo de demostración no lee nada tuyo.

## 📖 Guía de uso

Guía completa (landing + paso a paso, con las pantallas): **https://inematds.github.io/painel-agentes/guia/es/**

Versión simple en Python (un archivo): [jarvis-painel](https://inematds.github.io/jarvis-painel/guia/).

La interfaz del panel está en portugués.

## En detalle

Panel de monitoreo para quienes dejan **agentes de IA trabajando en una máquina**
(Claude Code, Codex, bots, temporizadores de systemd). En una sola pantalla: el estado de la máquina, los
bots, las ejecuciones automáticas, las colas de publicación, los límites de la suscripción, los
sitios, las tareas pesadas en espera y **todas las sesiones de Claude Code abiertas ahora**,
con quién abrió cada una (👤 tú o 🤖 un agente).

Node 22 + TypeScript, sin framework, sin build en el cliente, sin base de datos propia. Solo lee lo
que ya está en la máquina. Inspirado en el panel de INEMA.

## Para quién es

- Quienes ejecutan varios agentes/robots en su propia máquina o en una VPS y quieren saber, de un vistazo,
  qué está en marcha, qué falló y qué está esperando por ellos.
- Quienes quieren tener un televisor/monitor encendido en un rincón mostrando el estado de todo, con una voz que avisa
  solo de las alertas nuevas.

## Qué aparece en la pantalla

**Panel clásico (`/painel`)** — 9 cuadros:

| Cuadro | Qué muestra | De dónde viene |
|---|---|---|
| Esperando você (Esperándote) | fallas, ejecuciones atascadas, esperas que superaron el límite, terminales interrumpidas, avisos con plazo, tus pendientes | reúne los otros grupos + archivo de pendientes |
| Máquina (Máquina) | memoria (y caché del disco), disco, carga, reinicios, GPU sin memoria | `/proc`, `statfs`, `journalctl` |
| Bots (Bots) | servicios de systemd y, de cada base de datos SQLite, en ejecución / en cola / fallas en 24 h | `systemctl --user`, bases de datos de la configuración (solo lectura) |
| Produção (Producción) | ejecuciones del día, atascadas (> 90 min), fallas, esperas largas, próximos temporizadores | `rodadas.jsonl`, archivo de esperas, `systemctl --user list-timers` |
| Publicação (Publicación) | envíos de hoy y de la semana por canal y **las colas elemento por elemento** | historial JSONL + colas de la configuración |
| Créditos e logins (Créditos e inicios de sesión) | % de los límites de Claude y Codex y avisos manuales con plazo | JSON de tu statusline, `~/.codex/sessions`, `avisos.json` |
| Sites (Sitios) | si cada sitio respondió y en cuánto tiempo (1 GET cada 5 min, solo con el panel abierto) | lista de la configuración |
| Vagas (Tareas) | cuántas tareas pesadas pueden ejecutarse juntas por clase (gpu, render…) y quién ocupa cada lugar | archivo de tareas + comando de estado (opcionales) |
| Terminais (Terminales) | sesiones de Claude Code activas e interrumpidas: proyecto, modelo, contexto, última actividad | `~/.claude/sessions` + `~/.claude/projects` |

- **Lista (Lista) / Ícones (Íconos) / Imagens (Imágenes)**: tres formas de ver producción, publicación y terminales.
- **Filas**: cada elemento tiene un único estado — `pendente`, `publicando`, `feito`, `erro`,
  `retirado` — sin importar si tu cola usa `status`, `estado`, `queued`, `done`…
  Un archivo de cola vacío o dañado se convierte en una alerta roja (es la señal de que quien consume
  la cola se detuvo).
- **Sesión**: haz clic en una sesión y consulta las pestañas **Dados (Datos)** (quién la abrió, procesos padre,
  modelo, contexto, costo), **Conteúdo (Contenido)** (la conversación, solo lectura, secretos enmascarados) y
  **Terminal (Terminal)** (pantalla en vivo y escritura: solo con Assumir activado y en sesiones abiertas en el tmux del panel).
- **Organizar (Organizar)**: cambia los cuadros de lugar (toca uno y luego el otro, o arrástralos).
  La disposición queda guardada en el navegador (`painel.layout`).
- **Conversar (Conversar)** (panel lateral, desactivado de forma predeterminada): habla con un bot tuyo por HTTP o
  con una sesión abierta en el tmux del panel, y abre un **Novo terminal (Nuevo terminal)**.
- **Voz**: con la voz activada, el navegador solo dice las alertas que aparezcan después.

**Jarvis (`/jarvis`)** — los mismos datos en una interfaz HUD: núcleo animado, frase breve
por sistema, agenda de temporizadores, saludo hablado «Buenos días, <nombre>» (el nombre viene de la configuración) y atajos
de teclado (1 Buenos días · 2 Estado · 3 Qué espera · 4 Modo enfoque · 5 Cambiar vista).

## Instalación

```bash
git clone https://github.com/inematds/painel-agentes
cd painel-agentes
npm ci && npm run build
cp painel.config.exemplo.json painel.config.json   # edite los caminos (o borre lo que no usa)
npm run senha                                       # define la contraseña (solo el hash queda en disco)
npm start                                           # http://127.0.0.1:3143/painel
```

Requisitos: Node 20+ (probado en 22), Linux (los datos de la máquina vienen de `/proc`).
`better-sqlite3` es **opcional**: si no se instala (o no se compila), el cuadro Bots solo muestra
los servicios.

Para dejarlo funcionando automáticamente, basta con un servicio de systemd del usuario:

```ini
# ~/.config/systemd/user/painel-agentes.service
[Service]
WorkingDirectory=%h/painel-agentes
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
[Install]
WantedBy=default.target
```

## Modo de demostración

```bash
npm run build && npm run demo        # = PAINEL_DEMO=1 node dist/index.js
```

Datos **inventados** y plausibles en los 9 grupos (colas con elementos en todos los estados, 6
sesiones de ejemplo con 👤 y 🤖, alertas, créditos, sitios, tareas). No lee ningún archivo,
no ejecuta ningún comando, no accede a la red. **Sin inicio de sesión**, por eso solo responde en
`127.0.0.1` (se rechaza el bind desde fuera) y toda escritura devuelve 403. Sirve para capturas,
grabaciones de video y para conocer la pantalla antes de configurar.

## Configuración (`painel.config.json`)

Todas las claves son opcionales. Sin la clave, el cuadro muestra **«no configurado»** — nunca un error.
Un archivo configurado que no existe aparece como «sin datos». `~` representa tu carpeta.
Otra ruta: `PAINEL_CONFIG=/caminho/config.json`.

| Clave | Qué es | Valor predeterminado |
|---|---|---|
| `titulo` | nombre en la parte superior: "Painel <titulo>" | `de agentes` |
| `nome_falado` | cómo te llama Jarvis | `você` |
| `porta`, `bind` | dónde escuchar (también `PAINEL_PORT`, `PAINEL_BIND`) | `3143`, `127.0.0.1` |
| `pasta_dados` | contraseña (hash), sesiones de inicio de sesión y registros | `~/.config/painel-agentes` |
| `maquina.memoria_min_gb` / `disco_max_pct` / `gpu` | límites de las alertas; `gpu:false` desactiva la lectura del kernel | `1` / `90` / `true` |
| `servicos` | unidades del systemd del usuario que se deben vigilar | `[]` |
| `bots` | lista de `{nome, banco, tabela}`: SQLite abierto solo para lectura; solo `id` y `status` son obligatorios (`tarefa`, `fila`, `erro`, `resultado`, `criado_em`, `terminado_em` se incluyen si existen) | `[]` |
| `producao.rodadas` | JSONL con `{ts, unidade, fase: inicio\|fim, resultado, motivo, dur_s}` | — |
| `producao.esperas` | JSON `{chave: {estado, desde, teto_h}}` de tareas largas | — |
| `producao.timers` / `timers_ignorar` | muestra `systemctl --user list-timers` / regex de temporizadores que se deben ocultar | `false` / — |
| `publicacao.historico` | JSONL de envíos `{data, canal, titulo, url, video_id}` | — |
| `publicacao.filas` | lista de `{chave, nome, arquivo, formato: json\|txt\|esperas, quem}` (`quem` = quién consume la cola, solo para lectura humana) | `[]` |
| `creditos.limites_claude` | JSON que tu statusline guarda con `rate_limits` | — |
| `creditos.sessoes_codex` | carpeta de sesiones de Codex | `~/.codex/sessions` |
| `creditos.avisos` | lista `[{titulo, ate: "AAAA-MM-DD", nivel: aviso\|erro\|info}]` | `~/.config/painel-agentes/avisos.json` |
| `sites` | URLs que se deben comprobar | `[]` |
| `vagas.arquivo` | `{"gpu": 1, "_teto": {"gpu": 2}}` | — |
| `vagas.status_comando` | comando que imprime el estado en JSON (lista de argumentos) | — |
| `vagas.mudar_comando` | comando llamado como `<cmd> <classe> <n>` por los botones − / + | — (solo lectura) |
| `vagas.internas` | concurrencia interna de cada bot, solo para mostrar | `{}` |
| `terminais.sessoes_claude` / `projetos_claude` | dónde Claude Code guarda sesiones y conversaciones | `~/.claude/sessions` / `~/.claude/projects` |
| `terminais.retratos` | carpeta con `<id>.json` que tu statusline guarda (modelo, contexto, costo) | — |
| `terminais.comando` | alternativa: un comando tuyo que enumera las sesiones en JSON | — |
| `terminais.unidades` | nombre amigable por unidad: `{"robo.service": "robô diário"}` | `{}` |
| `assumir.tmux_servidor` | servidor tmux de Assumir (`tmux -L <nome>`) | `painel` |
| `novo_terminal.raiz` / `lancador` | dónde puede abrirse «Novo terminal» y qué se ejecuta | `~/projetos` / `claude` |
| `chat.bot.nome` / `url` | bot del panel Conversar: `POST {texto}` → `{respostas: [...]}` | `Bot` / — (desactivado) |
| `pendencias` | Markdown cuyos `- **título**` y `### título` (antes de `## Resolvidas`) se convierten en elementos | — |

El ejemplo completo está en [`painel.config.exemplo.json`](painel.config.exemplo.json).

## Seguridad

- **Loopback de forma predeterminada.** Se inicia en `127.0.0.1`. Para abrirlo en la red, `bind: "0.0.0.0"` —
  y entonces **la contraseña es obligatoria**: sin una contraseña definida, el panel rechaza el bind y permanece en
  loopback.
- **Contraseña**: `npm run senha` guarda solo el hash scrypt (archivo 600). Sesión en cookie
  HttpOnly + SameSite, dispositivo recordado por 365 días deslizantes, 5 errores por IP = 15 min
  bloqueado, «Cerrar sesión en todos los dispositivos». Todo POST exige el encabezado `X-Painel: 1` y el
  mismo origen (CSRF).
- **Solo lectura**: el panel no llama a modelos ni a API; las bases de datos se abren con `readonly`; los secretos
  que aparecen en conversaciones y terminales (claves `sk-…`, tokens de GitHub, JWT, `senha=`…) se
  enmascaran antes de salir.
- **Assumir y Novo terminal: desactivados de forma predeterminada** (`PAINEL_ASSUMIR=1` los activa).
  ⚠️ **Riesgo**: Assumir **escribe en la terminal del agente**. Si Claude se ejecuta allí sin pedir
  permiso, quien entre al panel controla la máquina. Solo funciona en sesiones abiertas en el tmux
  del panel (`tmux -L painel new -s nome claude`); «Novo terminal» solo abre dentro de la raíz
  configurada y cada envío va a `<pasta_dados>/assumir.log` (solo el inicio, enmascarado).
- **Conversación con el bot: desactivada de forma predeterminada** (`PAINEL_CHAT=1` **y** `chat.bot.url`).
  ⚠️ El mismo riesgo: el texto va directamente a tu bot.
- Recomendación: con Assumir o Conversar activados, úsalo **solo en una red local o en una VPN**;
  nunca lo expongas directamente a Internet. Inicio de sesión opcional mediante Cloudflare Access
  (`PAINEL_CF_ACCESS_AUD`, `PAINEL_CF_ACCESS_TEAM`, `PAINEL_EMAILS`) si publicas el
  panel mediante un túnel.

## El proceso, de principio a fin

Leyenda: 🧠 tú · ⚙️ script/servicio · 🤖 agente

1. 🧠 **Instalar** — `npm ci && npm run build`.
2. 🧠 **Conocer la pantalla** — `npm run demo` y abrir `http://127.0.0.1:3143/painel` (y `/jarvis`).
3. 🧠 **Configurar** — `cp painel.config.exemplo.json painel.config.json`; borrar lo que no se usa e indicar las rutas.
4. 🧠 **Definir la contraseña** — `npm run senha` (o `npm run senha -- --gerar`).
5. ⚙️ **Iniciar** — `npm start` (o el servicio de systemd anterior).
6. 🤖 **Los agentes trabajan** — tus temporizadores, bots y sesiones de Claude Code escriben en los archivos de ejecuciones, colas y esperas; Claude Code guarda las sesiones en `~/.claude`.
7. ⚙️ **El panel lee** — cada 15 s la pantalla solicita `/api/painel`; la recopilación tiene una caché de 5 s y nunca escribe nada.
8. ⚙️ **Alertas** — las reglas marcan lo que requiere atención; la voz solo dice lo que sea nuevo.
9. 🧠 **Actuar** — abrir el cuadro, ver la falla completa y la conversación de la sesión, cambiar las tareas (si `mudar_comando` está configurado).
10. 🧠 **(Opcional) Assumir / Conversar** — `PAINEL_ASSUMIR=1` y/o `PAINEL_CHAT=1`, solo en una red de confianza.

## Desarrollo

```bash
npm test                 # vitest (65 testes, inclusive modo demo e config vazia)
npx tsc --noEmit
```

Regla de la pantalla: el JS del cliente vive dentro de `String.raw` en `src/tela/*.ts` — **nada de
crase ni `${` dentro de él**, solo concatenación (ES5). Los tests lo comprueban.

## Licencia

MIT © INEMA
