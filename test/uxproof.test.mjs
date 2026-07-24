import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { scanRepo } from '../src/scan.mjs'
import { extractTokens, colorTokens } from '../src/tokens.mjs'
import { extractComponents, nativeEquivalentsPresent } from '../src/components.mjs'
import { buildContract, writeContract, readContract } from '../src/contract.mjs'
import { auditRepo } from '../src/audit.mjs'
import { syncContract } from '../src/sync.mjs'
import { installSkills } from '../src/skills.mjs'

const FIXTURE_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'demo-app')
let root

before(() => {
  // Copy the fixture to a temp dir so tests can mutate it freely.
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxproof-test-'))
  fs.cpSync(FIXTURE_SRC, root, { recursive: true })
})

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

test('scan detects framework, styling and libraries', () => {
  const scan = scanRepo(root)
  assert.equal(scan.framework, 'next')
  assert.equal(scan.styling.system, 'tailwind')
  assert.equal(scan.styling.tailwind.version, '4')
  assert.deepEqual(scan.libraries.forms, ['react-hook-form'])
  assert.deepEqual(scan.libraries.validation, ['zod'])
  assert.ok(scan.componentRoots.length === 0 || scan.componentRoots[0].dir.includes('components'))
})

test('token extraction classifies colors, sizes and aliases', () => {
  const { tokens } = extractTokens(root, ['src/app/globals.css'])
  const byName = Object.fromEntries(tokens.map((t) => [t.name, t]))
  assert.equal(byName['danger'].kind, 'color')
  assert.equal(byName['primary'].kind, 'color')
  assert.equal(byName['radius'].kind, 'size')
  assert.equal(byName['shadow-card'].kind, 'shadow')
  assert.equal(byName['color-primary'].kind, 'alias')
  // Alias to a color counts as a color token.
  const colors = colorTokens(tokens)
  assert.ok(colors.some((t) => t.name === 'color-primary'))
})

test('component registry finds function, arrow and re-exports', () => {
  const components = extractComponents(root, [{ dir: 'src/components', fileCount: 2 }])
  const names = components.map((c) => c.name)
  assert.ok(names.includes('Button'))
  assert.ok(names.includes('IconButton'))
  assert.ok(names.includes('Input'))
  assert.ok(names.includes('TextField'))
  const equivalents = nativeEquivalentsPresent(components)
  assert.ok(equivalents.some((e) => e.element === 'button' && e.component === 'Button'))
  assert.ok(equivalents.some((e) => e.element === 'input' && e.component === 'Input'))
})

test('init writes contract files and audit finds the planted violations', () => {
  const contract = buildContract(root)
  writeContract(root, contract)
  const { contract: stored } = readContract(root)
  assert.equal(stored.framework, 'next')
  assert.ok(stored.counts.colorTokens >= 2)

  const result = auditRepo(root)
  const rules = result.findings.map((f) => `${f.rule}:${path.basename(f.file)}`)
  // page.tsx plants: one hex, one rgba, one raw <button>, one raw <input>.
  assert.ok(rules.filter((r) => r.startsWith('no-hardcoded-colors:page.tsx')).length >= 2)
  assert.ok(rules.includes('prefer-house-component:page.tsx'))
  // Registry components wrap raw elements by design — their own files are exempt.
  assert.ok(!result.findings.some((f) => f.file.includes('src/components/')))
  const pageFindings = result.findings.filter((f) => f.file.endsWith('page.tsx'))
  assert.ok(pageFindings.some((f) => f.message.includes('<Button>')))
  // Every finding carries an evidence tag.
  assert.ok(result.findings.every((f) => f.evidence === 'PRODUCT'))
})

test('conventions.md manual section survives regeneration', () => {
  const file = path.join(root, '.uxproof', 'conventions.md')
  const edited = fs.readFileSync(file, 'utf8').replace(
    /<!-- uxproof:manual-start -->[\s\S]*<!-- uxproof:manual-end -->/,
    '<!-- uxproof:manual-start -->\nNigdy nie używamy amber w chipach.\n<!-- uxproof:manual-end -->',
  )
  fs.writeFileSync(file, edited)
  writeContract(root, buildContract(root))
  const regenerated = fs.readFileSync(file, 'utf8')
  assert.ok(regenerated.includes('Nigdy nie używamy amber w chipach.'))
})

test('sync detects drift when a token is added, and regenerates', () => {
  const cssFile = path.join(root, 'src', 'app', 'globals.css')
  fs.appendFileSync(cssFile, '\n:root { --brand-yellow: #EEFB63; }\n')
  const checked = syncContract(root, { check: true })
  assert.equal(checked.drifted, true)
  assert.ok(checked.diff.tokensAdded.includes('brand-yellow'))
  assert.equal(checked.wrote, false)

  const synced = syncContract(root)
  assert.equal(synced.wrote, true)
  const after = syncContract(root, { check: true })
  assert.equal(after.drifted, false)
})

test('skills install into .claude/skills', () => {
  const installed = installSkills(root)
  assert.deepEqual(
    installed.sort(),
    ['uxproof-audit', 'uxproof-create', 'uxproof-review'],
  )
  const skill = fs.readFileSync(
    path.join(root, '.claude', 'skills', 'uxproof-review', 'SKILL.md'),
    'utf8',
  )
  assert.ok(skill.includes('[ASSUMPTION]'))
  assert.ok(skill.includes('acceptance criterion'))
})
