import { buildContract, writeContract, readContract, hasContract } from './contract.mjs'

/** Compare the stored contract with a fresh scan; report what drifted. */
export function checkDrift(root) {
  const fresh = buildContract(root)
  const stored = readContract(root)

  const storedTokens = new Set(stored.tokens.map((t) => t.name))
  const freshTokens = new Set(fresh._tokens.map((t) => t.name))
  const storedComponents = new Set(stored.components.map((c) => c.name))
  const freshComponents = new Set(fresh._components.map((c) => c.name))

  const diff = {
    tokensAdded: [...freshTokens].filter((n) => !storedTokens.has(n)),
    tokensRemoved: [...storedTokens].filter((n) => !freshTokens.has(n)),
    componentsAdded: [...freshComponents].filter((n) => !storedComponents.has(n)),
    componentsRemoved: [...storedComponents].filter((n) => !freshComponents.has(n)),
  }
  const drifted = Object.values(diff).some((list) => list.length > 0)
  return { drifted, diff, fresh }
}

export function syncContract(root, { check = false } = {}) {
  if (!hasContract(root)) {
    throw new Error('No contract found. Run `uxproof init` first.')
  }
  const { drifted, diff, fresh } = checkDrift(root)
  if (check) return { drifted, diff, wrote: false }
  if (drifted) writeContract(root, fresh)
  return { drifted, diff, wrote: drifted }
}

export function formatDrift({ drifted, diff, wrote }) {
  if (!drifted) return 'uxproof sync: contract is in sync with the repo.'
  const lines = ['uxproof sync: drift detected.']
  const label = {
    tokensAdded: 'tokens added',
    tokensRemoved: 'tokens removed',
    componentsAdded: 'components added',
    componentsRemoved: 'components removed',
  }
  for (const [key, items] of Object.entries(diff)) {
    if (items.length) {
      const shown = items.slice(0, 15).join(', ')
      lines.push(`  ${label[key]} (${items.length}): ${shown}${items.length > 15 ? ', …' : ''}`)
    }
  }
  lines.push(wrote ? 'Contract regenerated (manual rules preserved).' : 'Run `uxproof sync` without --check to regenerate.')
  return lines.join('\n')
}
