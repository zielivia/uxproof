import fs from 'node:fs'
import path from 'node:path'
import { walkFiles } from './scan.mjs'

const EXPORT_RES = [
  /export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)/g,
  /export\s+(?:const|let)\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/g,
  /export\s*\{\s*([^}]+)\s*\}/g,
]

/** Registry of PascalCase components exported from the detected component roots. */
export function extractComponents(root, componentRoots) {
  const registry = new Map()
  for (const { dir } of componentRoots) {
    const absDir = path.join(root, dir)
    const files = walkFiles(absDir, { extensions: ['.tsx', '.jsx'], maxFiles: 2000, maxDepth: 5 })
    for (const file of files) {
      const rel = path.relative(root, file)
      if (/\.(test|spec|stories)\.[jt]sx$/.test(rel)) continue
      let code
      try {
        code = fs.readFileSync(file, 'utf8')
      } catch {
        continue
      }
      const names = new Set()
      for (const re of EXPORT_RES.slice(0, 2)) {
        for (const match of code.matchAll(re)) names.add(match[1])
      }
      for (const match of code.matchAll(EXPORT_RES[2])) {
        for (const piece of match[1].split(',')) {
          const name = piece.split(/\s+as\s+/).pop()?.trim()
          if (name && /^[A-Z][A-Za-z0-9_]*$/.test(name)) names.add(name)
        }
      }
      for (const name of names) {
        if (!registry.has(name)) registry.set(name, { name, file: rel, root: dir })
      }
    }
  }
  return [...registry.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Native elements that a registry usually wraps; used by audit to nudge toward the house component. */
export const NATIVE_EQUIVALENTS = [
  { element: 'button', candidates: ['Button', 'IconButton'] },
  { element: 'input', candidates: ['Input', 'TextField', 'TextInput', 'SearchInput'] },
  { element: 'select', candidates: ['Select', 'Dropdown', 'Combobox'] },
  { element: 'textarea', candidates: ['Textarea', 'TextArea'] },
  { element: 'table', candidates: ['Table', 'DataTable', 'DataGrid'] },
  { element: 'dialog', candidates: ['Dialog', 'Modal', 'Drawer'] },
]

export function nativeEquivalentsPresent(components) {
  const names = new Set(components.map((c) => c.name))
  return NATIVE_EQUIVALENTS
    .map(({ element, candidates }) => ({
      element,
      component: candidates.find((c) => names.has(c)) ?? null,
    }))
    .filter((row) => row.component)
}
