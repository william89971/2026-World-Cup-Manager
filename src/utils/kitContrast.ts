// Resolves the kits both teams actually wear so they always read clearly on
// the pitch: bright home colours, a guaranteed-contrast away kit, and a
// goalkeeper colour distinct from both. Pure colour math — no three.js.

export interface TeamKitColors {
  primary: string
  secondary: string
  goalkeeper: string
}

export interface ResolvedKit {
  shirt: string
  shorts: string
}

export interface ResolvedMatchKits {
  home: ResolvedKit
  away: ResolvedKit
  /** GK shirts (one per side, both distinct from all outfield kits). */
  homeGk: string
  awayGk: string
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function colorDistance(a: string, b: string): number {
  const [ar, ag, ab] = rgb(a)
  const [br, bg, bb] = rgb(b)
  return Math.sqrt((ar - br) ** 2 * 2 + (ag - bg) ** 2 * 4 + (ab - bb) ** 2)
}

/** Mix a colour toward white to keep dark kits readable on a dark pitch. */
function brighten(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex)
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

const AWAY_LIGHT = '#f4f4f4' // white change kit
const AWAY_DARK = '#1c2a6b' // deep navy change kit
const GK_YELLOW = '#ffd400'
const GK_ORANGE = '#ff7a1a'

function isYellowish(hex: string): boolean {
  const [r, g, b] = rgb(hex)
  return r > 170 && g > 140 && b < 120
}

/** Pick what both teams wear so they never blend into each other. */
export function resolveMatchKits(home: TeamKitColors, away: TeamKitColors): ResolvedMatchKits {
  // home wears its primary, lifted if it's too dark to read at distance
  let homeShirt = home.primary
  if (luminance(homeShirt) < 70) homeShirt = brighten(homeShirt, 0.3)

  // away: its own primary if it genuinely contrasts, else its second kit,
  // else a forced light/dark change strip opposite to the home shirt
  let awayShirt = away.primary
  if (luminance(awayShirt) < 70) awayShirt = brighten(awayShirt, 0.3)
  if (colorDistance(homeShirt, awayShirt) < 150) {
    awayShirt = away.secondary
    if (luminance(awayShirt) < 70) awayShirt = brighten(awayShirt, 0.3)
    if (colorDistance(homeShirt, awayShirt) < 150) {
      awayShirt = luminance(homeShirt) > 140 ? AWAY_DARK : AWAY_LIGHT
    }
  }

  const homeShorts = colorDistance(home.secondary, homeShirt) > 90 ? home.secondary : luminance(homeShirt) > 140 ? '#1a2235' : '#e8e8e8'
  const awayShorts = colorDistance(away.secondary, awayShirt) > 90 ? away.secondary : luminance(awayShirt) > 140 ? '#1a2235' : '#e8e8e8'

  // keepers: bright yellow unless an outfield kit is already yellowish
  const gk = isYellowish(homeShirt) || isYellowish(awayShirt) ? GK_ORANGE : GK_YELLOW

  return {
    home: { shirt: homeShirt, shorts: homeShorts },
    away: { shirt: awayShirt, shorts: awayShorts },
    homeGk: gk,
    awayGk: gk,
  }
}
