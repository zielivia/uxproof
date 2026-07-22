import fs from 'node:fs'
import path from 'node:path'
import { walkFiles } from './scan.mjs'
import { readContract } from './contract.mjs'

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
export function auditRepo(root, { files = null } = {}) {
  const { contract } = readContract(root)
  const findings = []
  const hasColorTokens = contract.counts.colorTokens > 0

  const targets = (files ?? walkFiles(root, { extensions: ['.tsx', '.jsx'], maxFiles: 20000 })
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
      for (const match of code.matchAll(HEX_COLOR_RE)) {
        findings.push({
          rule: 'no-hardcoded-colors',
          evidence: 'PRODUCT',
          file: rel,
          line: lineOf(code, match.index),
          message: `Hardcoded color #${match[1]} — this repo defines ${contract.counts.colorTokens} color tokens; use one.`,
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
  return { findings, filesChecked: targets.length }
}

export function formatFindings({ findings, filesChecked }) {
  if (!findings.length) {
    return `houserules audit: ${filesChecked} files checked, no findings. Clean.`
  }
  const lines = findings.map(
    (f) => `${f.file}:${f.line}  [${f.evidence}] ${f.rule}  ${f.message}`,
  )
  lines.push('', `${findings.length} finding(s) across ${filesChecked} files.`)
  return lines.join('\n')
}
