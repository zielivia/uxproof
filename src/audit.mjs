import fs from 'node:fs'
import path from 'node:path'
import { walkFiles } from './scan.mjs'
import { readContract } from './contract.mjs'
import { nearestToken } from './color.mjs'

const HEX_COLOR_RE = /(?:^|[^&\w-])#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const RGB_COLOR_RE = /(?:^|[^\w-])(rgba?\(\s*\d)/g
const RAW_ELEMENT_RE = (element) => new RegExp(`<${element}(?=[\\s>/])`, 'g')

/** Lines that legitimately carry raw values: token definitions, svg fills in icon files, tests. */
function isExemptFile(rel) {
  return (
    rel.includes('.houserules/') ||
    /\.(css|scss|json|md|svg)$/.test(rel) ||
    /\.(test|spec|stories)\.[jt]sx?$/.test(rel) ||
    rel.includes('__tests__') ||
    rel.includes('__integration__')
  )
}

function lineOf(code, index) {
  return code.slice(0, index).split('\n').length
}

/**
 * Audit source files against the contract.
 * Every finding carries an evidence tag: these two checks are grounded in the
 * repo's own contract, so they are [PRODUCT]-level evidence, not opinion.
 */
export function auditRepo(root, { files = null, fix = false, scope = null } = {}) {
  const { contract, tokens } = readContract(root)
  const findings = []
  const fixes = []
  const hasColorTokens = contract.counts.colorTokens > 0
  const paletteTokens = tokens.filter((t) => t.kind === 'color' || t.kind === 'alias')

  const scopeRoot = scope ? path.join(root, scope) : root
  const targets = (files ?? walkFiles(scopeRoot, { extensions: ['.tsx', '.jsx'], maxFiles: 20000, maxDepth: 12 })
    .map((f) => path.relative(root, f)))
    .filter((rel) => !isExemptFile(rel))

  for (const rel of targets) {
    let code
    try {
      code = fs.readFileSync(path.join(root, rel), 'utf8')
    } catch {
      continue
    }

    if (hasColorTokens) {
      let mutated = code
      for (const match of code.matchAll(HEX_COLOR_RE)) {
        const raw = `#${match[1]}`
        const near = fix ? nearestToken(raw, paletteTokens) : null
        if (near) {
          mutated = mutated.replaceAll(raw, `var(--${near.token.name})`)
          fixes.push({ file: rel, from: raw, to: `var(--${near.token.name})`, distance: near.distance })
          continue
        }
        findings.push({
          rule: 'no-hardcoded-colors',
          evidence: 'PRODUCT',
          file: rel,
          line: lineOf(code, match.index),
          message: `Hardcoded color ${raw} — this repo defines ${contract.counts.colorTokens} color tokens; use one.${fix ? ' No token close enough to auto-fix.' : ''}`,
        })
      }
      for (const match of code.matchAll(RGB_COLOR_RE)) {
        findings.push({
          rule: 'no-hardcoded-colors',
          evidence: 'PRODUCT',
          file: rel,
          line: lineOf(code, match.index),
          message: 'Hardcoded rgb()/rgba() color — use a token.',
        })
      }
      if (fix && mutated !== code) {
        fs.writeFileSync(path.join(root, rel), mutated)
        code = mutated
      }
    }

    // Registry components wrap raw elements by design — the rule targets consumers.
    const insideRegistry = (contract.componentRoots ?? []).some((r) => rel.startsWith(r.dir + '/'))
    for (const { element, component } of insideRegistry ? [] : contract.nativeEquivalents ?? []) {
      for (const match of code.matchAll(RAW_ELEMENT_RE(element))) {
        findings.push({
          rule: 'prefer-house-component',
          evidence: 'PRODUCT',
          file: rel,
          line: lineOf(code, match.index),
          message: `Raw <${element}> — this repo has <${component}> for that.`,
        })
      }
    }
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  return { findings, fixes, filesChecked: targets.length }
}

export function formatFindings({ findings, fixes = [], filesChecked }) {
  const lines = []
  for (const fx of fixes) {
    lines.push(`${fx.file}  fixed: ${fx.from} → ${fx.to} (Δ ${fx.distance.toFixed(3)})`)
  }
  if (!findings.length) {
    lines.push(`houserules audit: ${filesChecked} files checked, ${fixes.length ? `${fixes.length} fix(es) applied, ` : ''}no findings left. Clean.`)
    return lines.join('\n')
  }
  for (const f of findings) {
    lines.push(`${f.file}:${f.line}  [${f.evidence}] ${f.rule}  ${f.message}`)
  }
  lines.push('', `${findings.length} finding(s) across ${filesChecked} files${fixes.length ? `, ${fixes.length} fix(es) applied` : ''}.`)
  return lines.join('\n')
}
