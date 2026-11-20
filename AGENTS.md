# Inventory 2.0

Data.gov's [Inventory](https://inventory.data.gov/) rewrite for DCAT-US 3.0: a browser-only React editor in `editor/`. Architecture: [editor/README.md](editor/README.md); decisions: [docs/decisions/](docs/decisions/).

**Read [DESIGN.md](DESIGN.md) before any user interface or design change.** Review UI changes with the [user-experience-review](.claude/skills/user-experience-review/SKILL.md) skill, and open pull requests with the [pull-request](.claude/skills/pull-request/SKILL.md) skill.

## Commands

Node 24 (`editor/.nvmrc`). All scripts: [editor/README.md](editor/README.md#npm-scripts).

```bash
git submodule update --init   # DCAT-US schema; without it the app shows "DCAT-US schema missing" and e2e hangs
cd editor && npm ci
npm run build                 # typecheck, lint, Vite build
npm run lint
npx vitest run                # unit
npx playwright test           # e2e with axe, on the production build
```

## Agent files

- `CLAUDE.md` imports this file; edit `AGENTS.md`.
- Skills live in `.claude/skills/<name>/`, each linked for Codex: `ln -s ../../.claude/skills/<name> .agents/skills/<name>`.
