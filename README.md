# houserules

Your repo's conventions, made executable.

Every team has a "how we do things here" that lives in seniors' heads. AI agents don't know it, so AI-generated code always reads like a transplant: right framework, wrong house. `houserules` extracts those conventions into a committed contract and installs agent skills that create, audit and review code against it.

```
npx houserules init
```

## What init does

1. **Scans the repo** — framework, styling system, design tokens (CSS custom properties), component registry (exported components from your component directories), libraries in use (forms, validation, tables, icons).
2. **Writes the contract** to `.houserules/`:
   - `contract.json` — the machine-readable summary
   - `tokens.json` / `components.json` — the full registries
   - `conventions.md` — the human-readable house rules, with a manual section for the judgment calls only your team can know. The manual section survives regeneration.
3. **Installs skills** into `.claude/skills/` (works with Claude Code out of the box):
   - `houserules-create` — build new UI the way this repo builds it: registry components, tokens, existing screens as models
   - `houserules-audit` — check code against the contract and fix violations
   - `houserules-review` — evidence-first UX review: every recommendation carries evidence, pattern, trade-off and an acceptance criterion

Commit the lot. The contract is versioned, reviewable and argued about in PRs — like code, because now it is code.

## Commands

| Command | What it does |
|---|---|
| `houserules init` | Scan, write contract, install skills |
| `houserules audit` | Check source files against the contract (exit 1 on findings — CI-friendly) |
| `houserules sync` | Re-scan and regenerate the contract; manual rules survive |
| `houserules sync --check` | Report drift only, exit 1 if the contract is stale (CI-friendly) |

## Audit rules (MVP)

- `no-hardcoded-colors` — raw hex/rgb in component code when the repo defines color tokens
- `prefer-house-component` — raw `<button>`/`<input>`/`<select>`/`<table>`/`<dialog>` when the registry has a house equivalent (registry component files themselves are exempt — wrapping raw elements is their job)

Every finding carries an evidence tag. These rules are `[PRODUCT]`: grounded in the repo's own contract, not in opinion.

## Requirements

Node 20+. React repos (Next.js, Vite, CRA). Zero runtime dependencies.
