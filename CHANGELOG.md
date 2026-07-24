# Changelog

## 0.1.0 (2026-07-24)

First cut. Contract extraction (init, with --no-skills for external skill
collections), audit with scoped paths and perceptual color autofix, drift
guard (sync --check), self-contained gallery, screen archetypes, three
bundled agent skills. Zero runtime dependencies; node:test suite; verified
end-to-end from an npm-pack tarball in a fresh project.

## 0.2.0 (2026-07-24)

De facto palette for repos with no declared tokens: init collects the
color literals the code actually uses, clusters them perceptually in
Oklab, and writes them as proposed-* tokens with usage counts — day one
of a design system instead of an empty contract. Proposed tokens never
arm the audit and are excluded from --fix suggestions; declaring real
tokens and re-running sync arms the rules.

## 0.3.0 (2026-07-24)

Renamed to uxproof: the npm similarity rule blocks the previous name
(an existing package differs only by a hyphen). Same tool, new command
(npx uxproof), new contract directory (.uxproof/), bundled skills
renamed accordingly. No behavior changes.
