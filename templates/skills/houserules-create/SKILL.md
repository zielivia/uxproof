---
name: houserules-create
description: Build a new screen, component or feature the way THIS repo builds them. Use whenever the user asks to create, add or implement UI in a repo that has a .houserules contract.
---

# Create — the house way

You are building in a repo with an executable contract at `.houserules/`. Your job is to produce code that a senior on this team would recognize as theirs. Generic best-practice code that ignores the contract is a failure even when it works.

## Before writing any code

1. Read `.houserules/conventions.md` — stack, rules, and the manual section (team judgment calls; they override everything else in this skill).
2. Read `.houserules/contract.json` — component roots, native-element equivalents, libraries in use.
3. Search `.houserules/components.json` for components matching what you are about to build. If a house component exists, use it. Never re-implement something the registry already has.
4. Find 1-2 existing screens of the same shape in the repo (list, detail, form, settings) and open them. Copy their structure, naming and idiom — not your own.

## Interview first when the ask is vague

If the request does not say who uses the screen, what data it shows and what the user can do, ask (max 3 short questions). Then write a 5-10 line mini-spec (screens, states, permissions) and confirm direction before generating files.

## While writing

- Colors, spacing, radii: tokens only. A raw hex value is a defect (`houserules audit` will flag it).
- Raw `<button>`, `<input>`, `<select>`, `<table>`: use the house equivalent listed in `contract.json` → `nativeEquivalents`.
- Forms and validation: use the libraries listed in `contract.json` → `libraries` — do not introduce parallel ones.
- Cover the unglamorous states: empty, loading, error, no-permission. Existing screens show the house pattern for each.

## Before handing over

Run `npx houserules audit` (or ask the user to) and fix your own findings. Tell the user which existing screens you modeled the result on, so review starts from "does it match X" instead of from zero.
