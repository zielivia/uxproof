#!/usr/bin/env node
import process from 'node:process'
import { buildContract, writeContract, hasContract, CONTRACT_DIR } from '../src/contract.mjs'
import { installSkills } from '../src/skills.mjs'
import { auditRepo, formatFindings } from '../src/audit.mjs'
import { syncContract, formatDrift } from '../src/sync.mjs'

const HELP = `houserules — your repo's conventions, made executable.

Usage:
  houserules init            Scan the repo, write ${CONTRACT_DIR}/, install agent skills
  houserules audit           Check source files against the contract
  houserules sync [--check]  Re-scan and regenerate the contract (--check: report drift only, exit 1 on drift)
  houserules help            This message

The contract lives in ${CONTRACT_DIR}/ and is meant to be committed. The manual
section of conventions.md survives regeneration — put team judgment there.`

function main() {
  const [command, ...rest] = process.argv.slice(2)
  const root = process.cwd()

  switch (command) {
    case 'init': {
      const contract = buildContract(root)
      if (contract.framework === 'unknown' && contract.counts.components === 0) {
        console.error('houserules: this does not look like a React repo (no framework, no components found). Nothing written.')
        process.exit(1)
      }
      const dir = writeContract(root, contract)
      const skills = installSkills(root)
      console.log(`houserules init: contract written to ${dir}`)
      console.log(`  framework: ${contract.framework}${contract.workspace ? ' (monorepo)' : ''}, styling: ${contract.styling.system}`)
      console.log(`  tokens: ${contract.counts.tokens} (${contract.counts.colorTokens} colors), components: ${contract.counts.components}`)
      console.log(`  skills installed: ${skills.join(', ')}`)
      console.log('Next: open .houserules/conventions.md and fill the manual section. Commit the lot.')
      break
    }
    case 'audit': {
      if (!hasContract(root)) {
        console.error('houserules: no contract found. Run `houserules init` first.')
        process.exit(1)
      }
      const result = auditRepo(root)
      console.log(formatFindings(result))
      process.exit(result.findings.length ? 1 : 0)
      break
    }
    case 'sync': {
      const check = rest.includes('--check')
      let result
      try {
        result = syncContract(root, { check })
      } catch (err) {
        console.error(`houserules: ${err.message}`)
        process.exit(1)
      }
      console.log(formatDrift(result))
      process.exit(check && result.drifted ? 1 : 0)
      break
    }
    case 'help':
    case undefined:
    case '--help':
    case '-h':
      console.log(HELP)
      break
    default:
      console.error(`houserules: unknown command "${command}"\n`)
      console.log(HELP)
      process.exit(1)
  }
}

main()
