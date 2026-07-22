import fs from 'node:fs'
import path from 'node:path'

const CUSTOM_PROP_RE = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g
const COLOR_VALUE_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\()/

function classify(name, value) {
  const v = value.trim()
  if (COLOR_VALUE_RE.test(v)) return 'color'
  if (v.startsWith('var(')) return 'alias'
  if (/^-?[\d.]+(px|rem|em|%)$/.test(v)) return 'size'
  if (/shadow/.test(name)) return 'shadow'
  if (/font/.test(name)) return 'font'
  if (/^\d+$/.test(v)) return 'number'
  return 'other'
}

/**
 * Extract CSS custom properties from the given files.
 * Later files win on name collisions (mirrors CSS cascade for same-scope overrides).
 */
export function extractTokens(root, cssFiles) {
  const tokens = new Map()
  const sources = []
  for (const rel of cssFiles) {
    const file = path.join(root, rel)
    let css
    try {
      css = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    let count = 0
    for (const match of css.matchAll(CUSTOM_PROP_RE)) {
      const [, name, rawValue] = match
      const value = rawValue.trim()
      tokens.set(name, { name, value, kind: classify(name, value), source: rel })
      count += 1
    }
    if (count > 0) sources.push({ file: rel, tokenCount: count })
  }
  return {
    sources: sources.sort((a, b) => b.tokenCount - a.tokenCount),
    tokens: [...tokens.values()],
  }
}

/** The subset of tokens that resolve to colors (directly or through one alias hop). */
export function colorTokens(tokens) {
  const byName = new Map(tokens.map((t) => [t.name, t]))
  return tokens.filter((t) => {
    if (t.kind === 'color') return true
    if (t.kind !== 'alias') return false
    const target = /var\(--([a-zA-Z0-9-_]+)/.exec(t.value)?.[1]
    return target ? byName.get(target)?.kind === 'color' : false
  })
}
