import fs from 'node:fs'
import path from 'node:path'
import { readContract, CONTRACT_DIR } from './contract.mjs'

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Resolve one alias hop so swatches can render var(--x) tokens. */
function resolvedValue(token, byName) {
  const target = /var\(--([a-zA-Z0-9-_]+)/.exec(token.value)?.[1]
  return target ? byName.get(target)?.value ?? token.value : token.value
}

/**
 * Self-contained gallery page generated from the contract: color swatches
 * (click copies the token), other tokens, component inventory, screen shapes.
 * No build step, no network — a file the whole team can open.
 */
export function generateGallery(root) {
  const { contract, tokens, components } = readContract(root)
  const byName = new Map(tokens.map((t) => [t.name, t]))
  const colors = tokens.filter((t) => t.kind === 'color' || (t.kind === 'alias' && byName.get(/var\(--([a-zA-Z0-9-_]+)/.exec(t.value)?.[1] ?? '')?.kind === 'color'))
  const others = tokens.filter((t) => !colors.includes(t) && t.kind !== 'alias')

  const byRoot = new Map()
  for (const c of components) {
    if (!byRoot.has(c.root)) byRoot.set(c.root, [])
    byRoot.get(c.root).push(c)
  }

  const html = `<!doctype html>
<meta charset="utf-8">
<title>House rules — ${esc(path.basename(root))}</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 32px 24px; color: #171717; }
  h1 { font-size: 22px; } h2 { font-size: 16px; margin-top: 36px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
  .muted { color: #737373; }
  .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .swatch { border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px; cursor: pointer; background: #fff; text-align: left; }
  .swatch:hover { background: #fafafa; }
  .chip { height: 36px; border-radius: 4px; border: 1px solid #e5e5e5; margin-bottom: 6px; }
  code { font: 11px/1.4 ui-monospace, monospace; word-break: break-all; color: #525252; }
  table { border-collapse: collapse; width: 100%; } td, th { text-align: left; padding: 4px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: #171717; color: #fff; padding: 6px 12px; border-radius: 6px; opacity: 0; transition: opacity .2s; }
  .toast.show { opacity: 1; }
</style>
<h1>House rules</h1>
<p class="muted">Generated from <code>${CONTRACT_DIR}/</code> — ${esc(contract.framework)}${contract.workspace ? ' (monorepo)' : ''}, ${esc(contract.styling.system)}. Regenerate with <code>uxproof gallery</code>.</p>

<h2>Colors (${colors.length}) <span class="muted">— click to copy the token</span></h2>
<div class="swatches">
${colors.map((t) => `  <button class="swatch" data-copy="--${esc(t.name)}"><div class="chip" style="background:${esc(resolvedValue(t, byName))}"></div><code>--${esc(t.name)}</code></button>`).join('\n')}
</div>

<h2>Other tokens (${others.length})</h2>
<table>
${others.map((t) => `  <tr><td><code>--${esc(t.name)}</code></td><td class="muted"><code>${esc(t.value)}</code></td><td class="muted">${esc(t.kind)}</td></tr>`).join('\n')}
</table>

<h2>Components (${components.length})</h2>
${[...byRoot.entries()].map(([rootDir, list]) => `<h3><code>${esc(rootDir)}</code> <span class="muted">(${list.length})</span></h3>
<table>
${list.map((c) => `  <tr><td>${esc(c.name)}</td><td class="muted"><code>${esc(c.file)}</code></td></tr>`).join('\n')}
</table>`).join('\n')}

${contract.archetypes?.length ? `<h2>Screen shapes</h2>
<table>
${contract.archetypes.map((a) => `  <tr><td><strong>${esc(a.kind)}</strong> (${a.count})</td><td class="muted">${a.examples.map((e) => `<code>${esc(e)}</code>`).join('<br>')}</td></tr>`).join('\n')}
</table>` : ''}

<div class="toast" id="toast"></div>
<script>
  document.querySelectorAll('[data-copy]').forEach((el) => {
    el.addEventListener('click', async () => {
      await navigator.clipboard.writeText(el.dataset.copy)
      const toast = document.getElementById('toast')
      toast.textContent = el.dataset.copy + ' copied'
      toast.classList.add('show')
      setTimeout(() => toast.classList.remove('show'), 1200)
    })
  })
</script>
`
  const file = path.join(root, CONTRACT_DIR, 'gallery.html')
  fs.writeFileSync(file, html)
  return file
}
