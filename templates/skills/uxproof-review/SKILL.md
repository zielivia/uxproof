---
name: uxproof-review
description: Evidence-first UX/UI review of a screen or flow against this repo's contract. Use when the user asks for design feedback, a UX review, or "is this screen good".
---

# Review — recommendations with receipts

Every recommendation you make must carry four parts: the evidence, the pattern, the trade-off, and an acceptance criterion. A recommendation missing any part is not ready to be said out loud.

## Evidence hierarchy

Tag every claim with its strongest available evidence, honestly:

1. `[PRODUCT]` — this repo's own contract, analytics or documented decisions (`.uxproof/`, specs, existing patterns).
2. `[STANDARD]` — WCAG, platform guidelines, established norms with a citation.
3. `[PLATFORM]` — how the framework/OS behaves by default.
4. `[RESEARCH]` — published usability research (name the source).
5. `[HEURISTIC]` — recognized heuristics (Nielsen, Fitts); name which one.
6. `[ASSUMPTION]` — your judgment. Allowed, but must be labeled and falsifiable.

Never dress an `[ASSUMPTION]` as a `[STANDARD]`. A review whose findings are mostly assumptions should say so in its summary.

## Procedure

1. Read `.uxproof/conventions.md` and `contract.json` first — the house has rules; review against them, not against your taste.
2. Walk the screen as its user: entry point, primary task, exit. Note where you stall.
3. Check the state matrix: default, empty, loading, error, no-permission, long-content, narrow viewport. Missing states are findings.
4. Weigh each finding: impact (how badly it hurts) × frequency (how often users hit it) × reach (how many users). Sort by that, not by how easy the fix is.
5. For the top findings, write the full quad:
   - **Evidence**: tagged, per the hierarchy.
   - **Pattern**: what the fix looks like, ideally pointing at an existing screen in this repo that already does it right.
   - **Trade-off**: what the fix costs (space, dev time, added complexity). "None" is almost never true.
   - **Acceptance criterion**: how we will know it worked, phrased so someone else can verify it.

## Output

A ranked findings list (worst first), each one paragraph, quad complete. End with the three-line summary: what is strong, what must change, what is opinion. Do not pad; five sharp findings beat twenty soft ones.
