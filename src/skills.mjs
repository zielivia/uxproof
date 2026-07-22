import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'skills')

/** Copy skill templates into the target repo's .claude/skills/. Existing skills are overwritten (they are generated, not hand-edited). */
export function installSkills(root) {
  const targetBase = path.join(root, '.claude', 'skills')
  const installed = []
  for (const entry of fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const from = path.join(TEMPLATES_DIR, entry.name)
    const to = path.join(targetBase, entry.name)
    fs.mkdirSync(to, { recursive: true })
    for (const file of fs.readdirSync(from)) {
      fs.copyFileSync(path.join(from, file), path.join(to, file))
    }
    installed.push(entry.name)
  }
  return installed
}
