# CLAUDE.md — painel-agentes

Painel de monitoramento público (MIT) para quem roda agentes de IA numa máquina.
Node 22 + TypeScript, testes vitest. Entrada: `src/index.ts`; servidor: `src/servidor-painel.ts`;
coletores em `src/fontes/`; tela (HTML/CSS/JS do cliente) em `src/tela/`; dados inventados em `src/demo.ts`.

- Tudo que é pessoal vem de `painel.config.json` (`src/config.ts`). Nada de caminho, nome ou domínio de alguém no código, nos testes ou nos exemplos.
- Fonte sem config = "não configurado"; arquivo configurado ausente = "sem dados". Nunca erro.
- JS do cliente dentro de `String.raw`: sem crase e sem `${`, só concatenação (ES5).
- Escritas (vagas, Assumir, Novo terminal, Conversa) exigem sessão + `X-Painel: 1` + mesma origem; Assumir/Conversa desligados por padrão; modo demo nunca escreve.
- Antes de commitar: `npm test` e o portão de privacidade (grep por nomes/caminhos pessoais) com 0 linhas.
- Autor dos commits: conta `inematds`.
- Mudou o fluxo? Atualizar a seção "O processo, do início ao fim" do README no mesmo commit.

## Self-learning

When I correct you, or you catch yourself making a mistake: before continuing, add the lesson as a one-line rule at the TOP of [LESSONS.md](LESSONS.md) (not here), so it never happens again.

## Lessons

- As lições ficam em [LESSONS.md](LESSONS.md) (mais recente no topo).
