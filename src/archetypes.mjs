import fs from 'node:fs'
import path from 'node:path'
import { walkFiles } from './scan.mjs'

/**
 * Classify page/screen files into archetypes so `create` can answer
 * "which existing screen do I model this on" with a file path, not a vibe.
 * Heuristics over content and route path — cheap, explainable, good enough.
 */

const PAGE_FILE_RE = /(?:^|\/)(page|index)\.(tsx|jsx)$/

function isPageFile(rel) {
  if (PAGE_FILE_RE.test(rel)) return true
  // pages-router style: any tsx directly under a pages/ dir
  return /(?:^|\/)pages\/[^/]+\.(tsx|jsx)$/.test(rel)
}

const RULES = [
  {
    kind: 'form',
    test: ({ code }) =>
      /useForm|<form|onSubmit|handleSubmit/.test(code) && !/DataTable|useReactTable/.test(code),
  },
  {
    kind: 'detail',
    test: ({ rel }) => /\[[^\]]+\]/.test(rel),
  },
  {
    kind: 'settings',
    test: ({ rel }) => /settings|config|preferences/i.test(rel),
  },
  {
    kind: 'dashboard',
    test: ({ rel, code }) =>
      /dashboard/i.test(rel) || /(Chart|chart)\w*\s|recharts/.test(code),
  },
  {
    kind: 'list',
    test: ({ code }) =>
      /DataTable|useReactTable|<[Tt]able|columns\s*[:=]/.test(code) ||
      /\.map\(\s*\(?\w+\)?\s*=>\s*\(?\s*</.test(code),
  },
]

export function classifyPage(rel, code) {
  for (const rule of RULES) {
    if (rule.test({ rel, code })) return rule.kind
  }
  return 'other'
}

export function detectArchetypes(root) {
  // Deeper than the default walk: module systems nest pages far below the root
  // (e.g. packages/*/src/modules/*/backend/<route>/page.tsx).
  const files = walkFiles(root, { extensions: ['.tsx', '.jsx'], maxFiles: 20000, maxDepth: 12 })
  const buckets = new Map()
  for (const file of files) {
    const rel = path.relative(root, file)
    if (!isPageFile(rel)) continue
    if (/\.(test|spec|stories)\./.test(rel)) continue
    let code
    try {
      code = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const kind = classifyPage(rel, code)
    if (!buckets.has(kind)) buckets.set(kind, [])
    buckets.get(kind).push(rel)
  }
  return [...buckets.entries()]
    .map(([kind, pages]) => ({
      kind,
      count: pages.length,
      // Shortest paths first — they tend to be the canonical, least-nested examples.
      examples: pages.sort((a, b) => a.length - b.length).slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count)
}
