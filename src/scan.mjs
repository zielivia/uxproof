import fs from 'node:fs'
import path from 'node:path'

const SKIP_DIRS = new Set([
  // Dependencies, build output and caches.
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage',
  '.turbo', '.cache', '.vercel', 'storybook-static', '.parcel-cache',
  '.svelte-kit', '.astro', '.output', '.yarn', '.pnpm-store', 'target',
  // Scratch space. A contract built from throwaway files judges by garbage:
  // real repos accumulate extraction dumps and experiments here.
  'tmp', 'temp', '.tmp', '.temp', 'scratch',
  // Vendored code and language environments — not this team's design system.
  'vendor', '.venv', 'venv', '__pycache__',
  // Editor state.
  '.idea', '.vscode',
])

/**
 * Files that look like scratch or generated output even when they sit in a
 * scanned directory (extraction dumps, backups, copies). Their tokens are
 * still read, because they may be the only source in an unusual layout, but
 * they raise a warning: a contract dominated by them is not the team's system.
 */
export function looksLikeScratch(relPath) {
  return /(^|[/\-_])(extracted|generated|backup|bak|old|copy|sample|draft)([/\-_.]|$)/i.test(relPath)
}

/** Walk the repo collecting files, bounded by depth and count so huge monorepos stay fast. */
export function walkFiles(root, { maxDepth = 7, maxFiles = 20000, extensions = null } = {}) {
  const results = []
  const stack = [{ dir: root, depth: 0 }]
  while (stack.length && results.length < maxFiles) {
    const { dir, depth } = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        if (depth < maxDepth) stack.push({ dir: full, depth: depth + 1 })
      } else if (entry.isFile()) {
        if (!extensions || extensions.includes(path.extname(entry.name))) {
          results.push(full)
          if (results.length >= maxFiles) break
        }
      }
    }
  }
  return results
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** All package.json files near the root (root + one workspace level), merged dep view. */
function collectDependencies(root) {
  const deps = {}
  const pkgFiles = [path.join(root, 'package.json')]
  for (const wsGlob of ['packages', 'apps', 'libs']) {
    const wsDir = path.join(root, wsGlob)
    if (!fs.existsSync(wsDir)) continue
    for (const entry of fs.readdirSync(wsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) pkgFiles.push(path.join(wsDir, entry.name, 'package.json'))
    }
  }
  for (const file of pkgFiles) {
    const pkg = readJsonSafe(file)
    if (!pkg) continue
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      Object.assign(deps, pkg[section] ?? {})
    }
  }
  return deps
}

function detectFramework(deps) {
  if (deps.next) return 'next'
  if (deps['@remix-run/react'] || deps['react-router']) return 'react-router'
  if (deps.vite && deps.react) return 'vite-react'
  if (deps['react-scripts']) return 'cra'
  if (deps.react) return 'react'
  return 'unknown'
}

function detectStyling(root, deps) {
  const styling = { system: 'css', tailwind: null, cssFiles: [] }
  if (deps.tailwindcss) {
    const major = String(deps.tailwindcss).replace(/[^0-9.]/g, '').split('.')[0]
    styling.system = 'tailwind'
    styling.tailwind = { version: major || 'unknown', configFile: null }
    for (const candidate of ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs']) {
      if (fs.existsSync(path.join(root, candidate))) {
        styling.tailwind.configFile = candidate
        break
      }
    }
  } else if (deps['styled-components'] || deps['@emotion/react']) {
    styling.system = 'css-in-js'
  }
  const cssFiles = walkFiles(root, { extensions: ['.css'], maxFiles: 300 })
  // Token-bearing files first: globals/theme/tokens/variables in the name, or any file declaring custom props.
  styling.cssFiles = cssFiles
    .map((file) => path.relative(root, file))
    .filter((file) => !file.includes('node_modules'))
  return styling
}

const LIB_HINTS = [
  ['react-hook-form', 'forms'],
  ['formik', 'forms'],
  ['zod', 'validation'],
  ['yup', 'validation'],
  ['@tanstack/react-table', 'tables'],
  ['@tanstack/react-query', 'data-fetching'],
  ['swr', 'data-fetching'],
  ['next-intl', 'i18n'],
  ['react-i18next', 'i18n'],
  ['i18next', 'i18n'],
  ['@radix-ui/react-dialog', 'headless-ui'],
  ['lucide-react', 'icons'],
  ['react-icons', 'icons'],
  ['recharts', 'charts'],
  ['storybook', 'component-workbench'],
]

function detectLibraries(deps) {
  const found = {}
  for (const [dep, role] of LIB_HINTS) {
    if (deps[dep]) {
      found[role] = found[role] ?? []
      found[role].push(dep)
    }
  }
  return found
}

/** Directories that look like component roots: many .tsx/.jsx files with PascalCase exports. */
function detectComponentRoots(root) {
  const candidates = new Map()
  const files = walkFiles(root, { extensions: ['.tsx', '.jsx'], maxFiles: 8000 })
  for (const file of files) {
    const rel = path.relative(root, file)
    const segments = rel.split(path.sep)
    const idx = segments.findIndex((s) =>
      ['components', 'primitives', 'ui', 'design-system'].includes(s.toLowerCase()),
    )
    if (idx === -1) continue
    const dir = segments.slice(0, idx + 1).join('/')
    candidates.set(dir, (candidates.get(dir) ?? 0) + 1)
  }
  return [...candidates.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([dir, fileCount]) => ({ dir, fileCount }))
    .slice(0, 8)
}

export function scanRepo(root) {
  const deps = collectDependencies(root)
  const framework = detectFramework(deps)
  const styling = detectStyling(root, deps)
  const libraries = detectLibraries(deps)
  const componentRoots = detectComponentRoots(root)
  const workspace = fs.existsSync(path.join(root, 'packages')) || fs.existsSync(path.join(root, 'apps'))
  return { root, framework, workspace, styling, libraries, componentRoots }
}
