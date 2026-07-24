import fs from 'node:fs'
import path from 'node:path'
import { walkFiles } from './scan.mjs'
import { parseColor, colorDistance } from './color.mjs'

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g
const RGB_RE = /rgba?\(\s*\d+[\s,]+\d+[\s,]+\d+[^)]*\)/g

/**
 * A repo with no tokens almost always HAS a design system — unwritten, spread
 * across color literals in the code. Derive it: collect literals, cluster
 * perceptually (Oklab), return the de facto palette as PROPOSED tokens.
 * Proposed tokens document reality; they never arm the audit — a codebase is
 * not punished for disagreeing with a palette we just guessed from it.
 */
export function deriveDefactoPalette(root, { maxColors = 12, clusterDistance = 0.09 } = {}) {
  const counts = new Map()
  const files = walkFiles(root, { extensions: ['.tsx', '.jsx', '.css', '.scss'], maxFiles: 20000, maxDepth: 12 })
  for (const file of files) {
    const rel = path.relative(root, file)
    if (/\.(test|spec|stories)\.|__tests__|node_modules/.test(rel)) continue
    let code
    try {
      code = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const re of [HEX_RE, RGB_RE]) {
      for (const match of code.matchAll(re)) {
        const literal = match[0].toLowerCase()
        counts.set(literal, (counts.get(literal) ?? 0) + 1)
      }
    }
  }

  // Greedy clustering, most-used literal first: each literal joins the first
  // cluster within the perceptual threshold, else founds its own.
  const sorted = [...counts.entries()]
    .map(([literal, count]) => ({ literal, count, rgb: parseColor(literal) }))
    .filter((item) => item.rgb)
    .sort((a, b) => b.count - a.count)
  const clusters = []
  for (const item of sorted) {
    const home = clusters.find((c) => colorDistance(c.rgb, item.rgb) <= clusterDistance)
    if (home) {
      home.count += item.count
      home.variants += 1
    } else {
      clusters.push({ literal: item.literal, rgb: item.rgb, count: item.count, variants: 1 })
    }
  }

  return clusters
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map((cluster, index) => ({
      name: `proposed-${index + 1}`,
      value: cluster.literal,
      kind: 'color',
      source: '(derived from code literals)',
      proposed: true,
      usageCount: cluster.count,
      mergedVariants: cluster.variants,
    }))
}
