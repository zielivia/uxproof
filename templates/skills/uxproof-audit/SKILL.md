---
name: uxproof-audit
description: Check code against this repo's .uxproof contract and fix violations. Use before opening a PR, after generating UI code, or when the user asks whether code follows the project conventions.
---

# Audit — does it match the house?

This repo has an executable contract in `.uxproof/`. The audit answers one question: would this code pass as native here?

## Procedure

1. Run `npx uxproof audit`. Each finding has a file:line, a rule and an evidence tag. `[PRODUCT]` means the rule is grounded in this repo's own contract — it is not an opinion you can argue with in review.
2. Fix findings in place:
   - `no-hardcoded-colors` — replace the raw value with the closest token from `.uxproof/tokens.json`. If no token is close, say so explicitly and propose adding one; do not silently pick a wrong token.
   - `prefer-house-component` — swap the raw element for the registry component. Read the component's file first (path is in `.uxproof/components.json`) so you use its real API instead of guessing props.
3. Run `npx uxproof sync --check`. If the contract drifted (tokens or components changed since init), tell the user before relying on it, and offer to run `uxproof sync`.
4. Re-run the audit until clean, then report: findings found, findings fixed, anything deliberately left (with the reason).

## What the CLI cannot see

The CLI checks the mechanical layer. You additionally check, by reading neighboring code:

- Naming: do the new files, props and translations follow the same naming as the sibling screens?
- States: does every list have an empty state, every mutation an error path, every restricted page a no-permission view — in the same style the repo already uses?
- The manual section of `.uxproof/conventions.md`: team-specific rules live there and outrank any default.

Report these as findings too, marked `[HEURISTIC]` unless the conventions file states them explicitly (then `[PRODUCT]`).
