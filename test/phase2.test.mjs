import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { parseColor, colorDistance, nearestToken } from '../src/color.mjs'
import { detectArchetypes, classifyPage } from '../src/archetypes.mjs'
import { buildContract, writeContract } from '../src/contract.mjs'
import { auditRepo } from '../src/audit.mjs'
import { generateGallery } from '../src/gallery.mjs'

const FIXTURE_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'demo-app')
let root

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'houserules-p2-'))
  fs.cpSync(FIXTURE_SRC, root, { recursive: true })
  writeContract(root, buildContract(root))
})

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

test('color parsing: hex, rgb and oklch round-trip sanely', () => {
  assert.deepEqual(parseColor('#fff'), { r: 1, g: 1, b: 1 })
  const red = parseColor('#ff0000')
  assert.equal(red.r, 1)
  const rgb = parseColor('rgb(255, 0, 0)')
  assert.ok(colorDistance(red, rgb) < 0.001)
  // oklch red ≈ srgb red (values from CSS Color 4 conversion)
  const oklchRed = parseColor('oklch(0.6279 0.2577 29.23)')
  assert.ok(colorDistance(red, oklchRed) < 0.01, `distance was ${colorDistance(red, oklchRed)}`)
  assert.equal(parseColor('var(--nope)'), null)
})

test('nearestToken finds close tokens and rejects distant ones', () => {
  const tokens = [
    { name: 'danger', value: '#dc2626', kind: 'color' },
    { name: 'primary', value: 'oklch(0.2 0 0)', kind: 'color' },
    { name: 'color-danger', value: 'var(--danger)', kind: 'alias' },
  ]
  const hit = nearestToken('#dd2828', tokens)
  // Alias and raw value tie on distance — the semantic alias wins by design.
  assert.equal(hit.token.name, 'color-danger')
  // Pure green is far from both palette entries.
  assert.equal(nearestToken('#00ff00', tokens), null)
})

test('archetype detection classifies the fixture pages', () => {
  const archetypes = detectArchetypes(root)
  const byKind = Object.fromEntries(archetypes.map((a) => [a.kind, a]))
  assert.ok(byKind.list.examples.some((e) => e.includes('orders/page.tsx')))
  assert.ok(byKind.detail.examples.some((e) => e.includes('[id]')))
  assert.ok(byKind.form.examples.some((e) => e.includes('settings')))
  assert.equal(classifyPage('src/app/dashboard/page.tsx', 'import { BarChart } from "recharts"'), 'dashboard')
})

test('archetypes land in contract.json and conventions.md', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(root, '.houserules', 'contract.json'), 'utf8'))
  assert.ok(contract.archetypes.length >= 2)
  const conventions = fs.readFileSync(path.join(root, '.houserules', 'conventions.md'), 'utf8')
  assert.ok(conventions.includes('## Screen shapes'))
})

test('audit --fix replaces a close hex with var(--token) and leaves distant ones', () => {
  const pagePath = path.join(root, 'src', 'app', 'page.tsx')
  const original = fs.readFileSync(pagePath, 'utf8')
  // #dd2828 is near --danger (#dc2626); #00ff00 is near nothing in the palette.
  fs.writeFileSync(pagePath, original.replace("'#ff0000'", "'#dd2828'").replace('rgba(255,0,0,0.5)', '#00ff00'))

  const result = auditRepo(root, { fix: true })
  const fixed = fs.readFileSync(pagePath, 'utf8')
  // On a distance tie the semantic alias (--color-danger → --danger) wins over the raw value.
  assert.ok(fixed.includes('var(--color-danger)'), 'close hex should be replaced with the semantic token')
  assert.ok(fixed.includes('#00ff00'), 'distant color must not be auto-fixed')
  assert.ok(result.fixes.some((f) => f.from === '#dd2828' && f.to === 'var(--color-danger)'))
  assert.ok(result.findings.some((f) => f.message.includes('#00ff00') && f.message.includes('No token close enough')))
})

test('gallery.html renders swatches, components and shapes', () => {
  const file = generateGallery(root)
  const html = fs.readFileSync(file, 'utf8')
  assert.ok(html.includes('--danger'))
  assert.ok(html.includes('data-copy="--primary"'))
  assert.ok(html.includes('Button'))
  assert.ok(html.includes('Screen shapes'))
  // Self-contained: no external URLs.
  assert.ok(!/https?:\/\//.test(html))
})

test('init --no-skills writes the contract but skips skill installation', async () => {
  const { execFileSync } = await import('node:child_process')
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-noskills-'))
  fs.cpSync(FIXTURE_SRC, scratch, { recursive: true })
  const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'houserules.mjs')
  const out = execFileSync(process.execPath, [bin, 'init', '--no-skills'], { cwd: scratch, encoding: 'utf8' })
  assert.ok(out.includes('skills: skipped'))
  assert.ok(fs.existsSync(path.join(scratch, '.houserules', 'contract.json')))
  assert.ok(!fs.existsSync(path.join(scratch, '.claude', 'skills')))
  fs.rmSync(scratch, { recursive: true, force: true })
})
