// Canvas rendering for shareable match / tournament cards (1200×630).
// Pure canvas drawing — no React. Components call these and embed the result.
import type { MatchCardInput, TournamentCardInput } from '../types/share'

export const CARD_W = 1200
export const CARD_H = 630

const BG = '#0c1322'
const BG_DEEP = '#070b14'
const TEXT = '#e7ecf4'
const MUTED = '#6b7a93'
const ACCENT = '#18d96b'
const GOLD = '#f2c14e'

const FONT = (weight: number, px: number) => `${weight} ${px}px Inter, system-ui, -apple-system, sans-serif`

function makeCanvas(): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas')
  cv.width = CARD_W
  cv.height = CARD_H
  const ctx = cv.getContext('2d')!
  return { cv, ctx }
}

/** Dark navy base with a subtle diagonal texture and team-colour glows. */
function drawBackground(ctx: CanvasRenderingContext2D, leftColor: string, rightColor: string) {
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  grad.addColorStop(0, BG)
  grad.addColorStop(1, BG_DEEP)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // subtle diagonal texture
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.022)'
  ctx.lineWidth = 2
  for (let x = -CARD_H; x < CARD_W + CARD_H; x += 18) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + CARD_H, CARD_H)
    ctx.stroke()
  }
  ctx.restore()

  // team-colour corner glows
  for (const [color, cx] of [
    [leftColor, 140],
    [rightColor, CARD_W - 140],
  ] as const) {
    const glow = ctx.createRadialGradient(cx, 90, 0, cx, 90, 420)
    glow.addColorStop(0, hexWithAlpha(color, 0.16))
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, CARD_W, CARD_H)
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function drawBranding(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = FONT(700, 22)
  ctx.fillText('2026 WORLD CUP MANAGER', CARD_W - 36, CARD_H - 30)
  ctx.fillStyle = ACCENT
  ctx.fillRect(CARD_W - 332, CARD_H - 56, 4, 28)
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.45
    const x = cx + Math.cos(ang) * rad
    const y = cy + Math.sin(ang) * rad
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  if (filled) {
    ctx.fillStyle = GOLD
    ctx.fill()
  } else {
    ctx.strokeStyle = hexWithAlpha(GOLD, 0.35)
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

/** Post-match result card. */
export function renderMatchCard(input: MatchCardInput): HTMLCanvasElement {
  const { cv, ctx } = makeCanvas()
  drawBackground(ctx, input.home.color, input.away.color)

  // occasion line
  ctx.textAlign = 'center'
  ctx.fillStyle = ACCENT
  ctx.font = FONT(800, 26)
  ctx.fillText(input.occasion.toUpperCase(), CARD_W / 2, 78)

  // flags + names
  ctx.font = '150px system-ui'
  ctx.fillText(input.home.flag, 240, 280)
  ctx.fillText(input.away.flag, CARD_W - 240, 280)
  ctx.fillStyle = TEXT
  ctx.font = FONT(800, 38)
  ctx.fillText(fitText(ctx, input.home.name, 360), 240, 348)
  ctx.fillText(fitText(ctx, input.away.name, 360), CARD_W - 240, 348)

  // scoreline
  ctx.fillStyle = TEXT
  ctx.font = FONT(900, 150)
  ctx.fillText(`${input.homeScore} – ${input.awayScore}`, CARD_W / 2, 290)
  if (input.shootout) {
    ctx.fillStyle = MUTED
    ctx.font = FONT(700, 30)
    ctx.fillText(`(${input.shootout.home}–${input.shootout.away} on penalties)`, CARD_W / 2, 338)
  }

  // scorers, grouped under each side
  ctx.font = FONT(600, 26)
  const homeScorers = input.scorers.filter((s) => s.side === 'home')
  const awayScorers = input.scorers.filter((s) => s.side === 'away')
  const listY = 410
  ctx.fillStyle = MUTED
  homeScorers.slice(0, 5).forEach((s, i) => {
    ctx.textAlign = 'center'
    ctx.fillText(`⚽ ${s.name} ${s.minute}'`, 240, listY + i * 36)
  })
  awayScorers.slice(0, 5).forEach((s, i) => {
    ctx.fillText(`⚽ ${s.name} ${s.minute}'`, CARD_W - 240, listY + i * 36)
  })

  // star rating
  const starY = 420
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, CARD_W / 2 - 88 + i * 44, starY, 19, i < input.stars)
  }
  ctx.fillStyle = MUTED
  ctx.font = FONT(700, 20)
  ctx.fillText('PERFORMANCE', CARD_W / 2, starY + 48)

  // manager identity
  ctx.textAlign = 'left'
  ctx.fillStyle = TEXT
  ctx.font = FONT(700, 26)
  ctx.fillText(`${input.managerFlag} ${input.managerNation} Head Coach`, 36, CARD_H - 30)

  drawBranding(ctx)
  return cv
}

/** Gold trophy silhouette (drawn, not an asset). */
function drawTrophy(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  const grad = ctx.createLinearGradient(-60, -90, 60, 90)
  grad.addColorStop(0, '#ffe9a8')
  grad.addColorStop(0.5, GOLD)
  grad.addColorStop(1, '#b8860b')
  ctx.fillStyle = grad

  // cup bowl
  ctx.beginPath()
  ctx.moveTo(-52, -90)
  ctx.lineTo(52, -90)
  ctx.bezierCurveTo(52, -30, 30, -4, 0, -4)
  ctx.bezierCurveTo(-30, -4, -52, -30, -52, -90)
  ctx.closePath()
  ctx.fill()
  // handles
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(s * 62, -62, 18, 26, 0, 0, Math.PI * 2)
    ctx.lineWidth = 10
    ctx.strokeStyle = grad
    ctx.stroke()
  }
  // stem + base
  ctx.fillRect(-8, -4, 16, 34)
  ctx.beginPath()
  ctx.moveTo(-34, 52)
  ctx.lineTo(34, 52)
  ctx.lineTo(24, 30)
  ctx.lineTo(-24, 30)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Tournament-end (elimination or trophy) card. */
export function renderTournamentCard(input: TournamentCardInput): HTMLCanvasElement {
  const { cv, ctx } = makeCanvas()
  drawBackground(ctx, input.nation.color, input.champion ? GOLD : input.nation.color)

  // header: flag + headline
  ctx.textAlign = 'left'
  ctx.font = '76px system-ui'
  ctx.fillText(input.nation.flag, 40, 104)
  ctx.fillStyle = input.champion ? GOLD : TEXT
  ctx.font = FONT(900, 52)
  ctx.fillText(fitText(ctx, input.headline.toUpperCase(), 700), 140, 96)
  ctx.fillStyle = MUTED
  ctx.font = FONT(700, 26)
  ctx.fillText(`${input.nation.name} — 2026 FIFA World Cup`, 142, 134)

  if (input.champion) drawTrophy(ctx, CARD_W - 150, 230, 1.1)

  // bracket path — every result, two columns if needed
  ctx.font = FONT(600, 25)
  const startY = 196
  const colX = [40, 620]
  const perCol = 7
  input.path.forEach((step, i) => {
    const col = Math.floor(i / perCol)
    if (col > 1) return
    const x = colX[col]
    const y = startY + (i % perCol) * 44
    ctx.textAlign = 'left'
    ctx.fillStyle = MUTED
    ctx.font = FONT(700, 18)
    ctx.fillText(step.roundLabel.toUpperCase(), x, y - 18)
    ctx.fillStyle = step.won ? ACCENT : step.drawn ? TEXT : '#ef5d5d'
    ctx.font = FONT(700, 25)
    ctx.fillText(`${step.won ? '✓' : step.drawn ? '–' : '✗'}  ${step.score}  vs ${step.oppFlag} ${fitText(ctx, step.oppName, 280)}`, x, y + 6)
  })

  // record strip
  const rec = input.record
  ctx.fillStyle = hexWithAlpha('#ffffff', 0.05)
  ctx.fillRect(36, CARD_H - 132, CARD_W - 72, 64)
  ctx.textAlign = 'center'
  const cells: [string, string][] = [
    ['P', String(rec.played)],
    ['W', String(rec.won)],
    ['D', String(rec.drawn)],
    ['L', String(rec.lost)],
    ['GF', String(rec.gf)],
    ['GA', String(rec.ga)],
  ]
  cells.forEach(([label, value], i) => {
    const x = 120 + i * 130
    ctx.fillStyle = MUTED
    ctx.font = FONT(700, 18)
    ctx.fillText(label, x, CARD_H - 108)
    ctx.fillStyle = TEXT
    ctx.font = FONT(900, 32)
    ctx.fillText(value, x, CARD_H - 78)
  })
  if (input.topScorer) {
    ctx.textAlign = 'right'
    ctx.fillStyle = GOLD
    ctx.font = FONT(800, 26)
    ctx.fillText(`⚽ ${input.topScorer.name} — ${input.topScorer.goals} goals`, CARD_W - 64, CARD_H - 88)
  }

  drawBranding(ctx)
  return cv
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 3 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

// ── export helpers ───────────────────────────────────────────────

export function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

export async function downloadCard(cv: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(cv)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Copy the card PNG to the clipboard. Returns false if unsupported/denied. */
export async function copyCardToClipboard(cv: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await canvasToBlob(cv)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
