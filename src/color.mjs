// Color parsing and perceptual distance, dependency-free.
// Distances are measured in Oklab, where euclidean distance approximates
// perceived difference (Björn Ottosson's conversions).

function srgbChannelToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearChannelToSrgb(c) {
  const clamped = Math.min(1, Math.max(0, c))
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
}

export function srgbToOklab({ r, g, b }) {
  const lr = srgbChannelToLinear(r)
  const lg = srgbChannelToLinear(g)
  const lb = srgbChannelToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

function oklabToSrgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: linearChannelToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearChannelToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearChannelToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  }
}

function parseHex(value) {
  const hex = value.replace('#', '')
  const size = hex.length === 3 || hex.length === 4 ? 1 : 2
  if (![3, 4, 6, 8].includes(hex.length)) return null
  const read = (i) => {
    const part = hex.slice(i * size, i * size + size)
    const n = parseInt(size === 1 ? part + part : part, 16)
    return Number.isNaN(n) ? null : n / 255
  }
  const r = read(0), g = read(1), b = read(2)
  if (r === null || g === null || b === null) return null
  return { r, g, b }
}

function parseRgb(value) {
  const match = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(value)
  if (!match) return null
  return { r: Number(match[1]) / 255, g: Number(match[2]) / 255, b: Number(match[3]) / 255 }
}

function parseOklch(value) {
  const match = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/.exec(value)
  if (!match) return null
  let L = Number(match[1].replace('%', ''))
  if (match[1].endsWith('%')) L /= 100
  const C = Number(match[2])
  const H = (Number(match[3]) * Math.PI) / 180
  return oklabToSrgb({ L, a: C * Math.cos(H), b: C * Math.sin(H) })
}

/** Parse a CSS color literal to sRGB {r,g,b} in 0..1, or null if unsupported. */
export function parseColor(value) {
  const v = value.trim()
  if (v.startsWith('#')) return parseHex(v)
  if (v.startsWith('rgb')) return parseRgb(v)
  if (v.startsWith('oklch')) return parseOklch(v)
  return null
}

export function colorDistance(a, b) {
  const la = srgbToOklab(a)
  const lb = srgbToOklab(b)
  return Math.hypot(la.L - lb.L, la.a - lb.a, la.b - lb.b)
}

/**
 * Nearest color token to a raw value. Tokens with unparseable or alias values
 * are resolved one hop, then skipped if still unparseable.
 */
export function nearestToken(rawValue, tokens, { maxDistance = 0.08 } = {}) {
  const target = parseColor(rawValue)
  if (!target) return null
  const byName = new Map(tokens.map((t) => [t.name, t]))
  let best = null
  const EPSILON = 1e-6
  for (const token of tokens) {
    let value = token.value
    const aliasTarget = /var\(--([a-zA-Z0-9-_]+)/.exec(value)?.[1]
    if (aliasTarget) value = byName.get(aliasTarget)?.value ?? value
    const parsed = parseColor(value)
    if (!parsed) continue
    const distance = colorDistance(target, parsed)
    const beats =
      !best ||
      distance < best.distance - EPSILON ||
      // Equal distance: prefer the semantic alias over the raw palette value.
      (Math.abs(distance - best.distance) <= EPSILON && token.kind === 'alias' && best.token.kind !== 'alias')
    if (beats) best = { token, distance }
  }
  return best && best.distance <= maxDistance ? best : null
}
