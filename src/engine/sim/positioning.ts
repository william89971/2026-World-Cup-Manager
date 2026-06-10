import { PITCH } from '../constants'
import type { Mentality, Pressing } from '../../data/types'
import type { MatchSetup, Side, SimPlayer, Vec2, WorldState } from '../types'
import { attackDir, byId, onPitch, other, ownGoalY, targetGoalY } from './world'
import { clamp, dist2, v } from '../util'

interface SideTactics {
  mentality: Mentality
  pressing: Pressing
}

function tacticsOf(setup: MatchSetup, side: Side): SideTactics {
  const t = side === 'home' ? setup.home : setup.away
  return { mentality: t.mentality, pressing: t.pressing }
}

const MENTALITY_PUSH: Record<Mentality, number> = { defensive: 2, balanced: 7, attacking: 13 }
const MENTALITY_DROP: Record<Mentality, number> = { defensive: 16, balanced: 11, attacking: 7 }
const PRESS_RANGE: Record<Pressing, number> = { low: 18, medium: 30, high: 46 }
const PRESS_COUNT: Record<Pressing, number> = { low: 1, medium: 2, high: 3 }

/** Scoreline/clock-aware shape modifiers, applied on top of mentality. */
interface ShapeCtx {
  push: number // multiplier on the in-possession push upfield
  drop: number // multiplier on the defending drop
  width: number // lateral spread multiplier
}

function shapeContext(world: WorldState, side: Side): ShapeCtx {
  const diff = world.score[side] - world.score[other(side)]
  const min = world.timeSec / 60
  if (diff > 0) {
    // protecting a lead: tighten and sit deeper, more so late on
    const late = min >= 70 ? 1 : 0
    return { push: 0.8 - late * 0.15, drop: 1.18 + late * 0.12, width: 0.92 }
  }
  if (diff < 0 && min >= 70) {
    // chasing the game late: push higher and stretch the pitch
    const desperate = diff <= -2 ? 1 : 0
    return { push: 1.45 + desperate * 0.35, drop: 0.6 - desperate * 0.15, width: 1.12 + desperate * 0.08 }
  }
  return { push: 1, drop: 1, width: 1 }
}

function nearestOfSide(mates: SimPlayer[], point: Vec2, excludeGk = true): SimPlayer | undefined {
  let best: SimPlayer | undefined
  let bestD = Infinity
  for (const p of mates) {
    if (excludeGk && p.role === 'GK') continue
    const d = dist2(p.pos, point)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

/** Compute the desired movement target for every on-pitch player (except the
 *  ball owner, whose target is set by the decision module). */
export function computeTargets(world: WorldState, setup: MatchSetup): Map<string, Vec2> {
  const out = new Map<string, Vec2>()

  // set-piece routines replace open-play shape while the restart is forming
  if ((world.phase === 'corner' || world.phase === 'freekick') && world.restart) {
    setPieceTargets(world, out)
    return out
  }

  const owner = byId(world, world.ball.ownerId)
  const ball = world.ball.pos
  // predicted ball position used by receivers / pressers chasing a loose ball
  const predicted = v(ball.x + world.ball.vel.x * 0.25, ball.y + world.ball.vel.y * 0.25)
  const loose = !owner
  // side "in possession": the carrier's side, or the last team to touch a ball in flight
  const attackingSide: Side | null = owner ? owner.side : world.ball.inFlight ? world.ball.lastTouch : null

  for (const side of ['home', 'away'] as Side[]) {
    const tac = tacticsOf(setup, side)
    const dir = attackDir(side)
    const inPoss = attackingSide === side
    const mates = onPitch(world, side)
    const ctx = shapeContext(world, side)

    // who chases the ball for this side: the intended receiver runs to the
    // pass destination; otherwise the nearest player chases the live ball.
    const intendedId =
      loose && inPoss && world.ball.targetReceiverId ? world.ball.targetReceiverId : undefined
    const intendedTarget = world.ball.passTarget ?? predicted
    const chaser = loose && !intendedId ? nearestOfSide(mates, predicted) : undefined

    // ── pressing assignment (defending team closes the carrier down) ──
    // high press: the front players hunt the carrier anywhere in the
    // opposition half; low press only engages once the ball comes to them.
    const pressers = new Set<string>()
    if (!inPoss && !loose) {
      const range = PRESS_RANGE[tac.pressing]
      const ballInOppHalf = ball.y * dir > 0
      const pool = mates.filter((p) => p.role !== 'GK')
      if (tac.pressing === 'high' && ballInOppHalf) {
        // front line presses: most advanced players closest to the ball
        const front = [...pool]
          .sort((a, b) => b.pos.y * dir - a.pos.y * dir)
          .slice(0, 5)
          .sort((a, b) => dist2(a.pos, ball) - dist2(b.pos, ball))
        front.slice(0, 3).forEach((p) => pressers.add(p.id))
      } else {
        const sorted = [...pool].sort((a, b) => dist2(a.pos, ball) - dist2(b.pos, ball))
        sorted.slice(0, PRESS_COUNT[tac.pressing]).forEach((p, idx) => {
          if (idx === 0 || dist2(p.pos, ball) < range * range) pressers.add(p.id)
        })
      }
    }

    for (const p of mates) {
      if (p.id === world.ball.ownerId) continue

      if (p.role === 'GK') {
        out.set(p.id, gkTarget(side, ball, p))
        continue
      }

      // intended receiver runs onto the pass
      if (intendedId && p.id === intendedId) {
        out.set(p.id, { ...intendedTarget })
        continue
      }
      // loose-ball pursuit by the nearest player
      if (chaser && p.id === chaser.id) {
        out.set(p.id, { ...predicted })
        continue
      }

      if (pressers.has(p.id)) {
        out.set(p.id, { x: ball.x, y: ball.y - dir * 1.2 })
        continue
      }

      out.set(p.id, shapedTarget(p, ball, dir, inPoss, tac, ctx))
    }
  }
  return out
}

/** Keeper positioning: hold the line, shade toward the near post, and step out
 *  with the play. Physical keepers (75+) command more of the goal mouth. */
function gkTarget(side: Side, ball: Vec2, gk: SimPlayer): Vec2 {
  const dir = attackDir(side)
  const goalY = ownGoalY(side)
  const advance = clamp((ball.y - goalY) * dir, 0, 30) * 0.18
  // angle coverage: bisect the shooting angle by shading toward the ball side
  const command = gk.attrs.physicality >= 75 ? 0.32 : 0.25
  const maxShade = gk.attrs.physicality >= 75 ? 7 : 6
  return v(clamp(ball.x * command, -maxShade, maxShade), goalY + dir * (1.4 + advance))
}

function shapedTarget(
  p: SimPlayer,
  ball: Vec2,
  dir: number,
  inPoss: boolean,
  tac: SideTactics,
  ctx: ShapeCtx,
): Vec2 {
  let tx = p.anchor.x * ctx.width
  let ty = p.anchor.y

  // whole-block follow toward the ball (compactness)
  ty += (ball.y - p.anchor.y) * 0.22
  tx += (ball.x - p.anchor.x) * 0.12

  // attack push when in possession, drop when defending — scaled by game state
  ty += inPoss ? dir * MENTALITY_PUSH[tac.mentality] * ctx.push : -dir * MENTALITY_DROP[tac.mentality] * ctx.drop

  switch (p.role) {
    case 'Wing':
      tx = inPoss ? Math.sign(p.anchor.x || 1) * (PITCH.HALF_W - 4) * Math.min(ctx.width, 1) : tx * 0.7
      if (inPoss) ty += dir * 6
      break
    case 'WM':
      tx = inPoss ? Math.sign(p.anchor.x || 1) * (PITCH.HALF_W - 7) : tx * 0.8
      break
    case 'FB':
      if (inPoss && ball.y * dir > 6) ty += dir * 10 * ctx.push
      tx = Math.sign(p.anchor.x || 1) * Math.min(Math.abs(tx) + (inPoss ? 4 : 0), PITCH.HALF_W - 3)
      break
    case 'ST':
      if (inPoss) ty += dir * 7
      tx += (ball.x - tx) * 0.18
      break
    case 'CAM':
      if (inPoss) ty += dir * 4
      break
    case 'CDM':
      ty -= dir * 3
      break
    case 'CB':
      tx += (ball.x - p.anchor.x) * 0.04
      break
  }

  // rapid attackers make runs in behind when their team has the ball upfield
  if (inPoss && p.attrs.pace >= 85 && (p.role === 'ST' || p.role === 'Wing' || p.role === 'CAM')) {
    if (ball.y * dir > -10) ty += dir * 4
  }

  tx = clamp(tx, -(PITCH.HALF_W - 1), PITCH.HALF_W - 1)
  ty = clamp(ty, -(PITCH.HALF_L - 1), PITCH.HALF_L - 1)
  return v(tx, ty)
}

// ── set-piece routines ───────────────────────────────────────────
// While a corner / attacking free kick is forming (restart delay running),
// attackers run patterns (near post / far post / penalty spot / edge of box)
// and defenders drop in to mark zonally.

function setPieceTargets(world: WorldState, out: Map<string, Vec2>): void {
  const r = world.restart!
  const atk = r.side
  const def = other(atk)
  const dir = attackDir(atk)
  const goalY = targetGoalY(atk)
  const corner = world.phase === 'corner'
  const xs = Math.sign(r.pos.x) || 1

  // delivery target zones, oriented to the attacking side
  const spots: Vec2[] = corner
    ? [
        v(xs * 2.2, goalY - dir * 4), // near post run
        v(-xs * 3, goalY - dir * 5.5), // far post run
        v(0, goalY - dir * 11), // penalty spot
        v(-xs * 1.5, goalY - dir * 18.5), // edge of the box
        v(xs * 8, goalY - dir * 9), // short option / chaos zone
      ]
    : [
        v(2.5, goalY - dir * 6),
        v(-3, goalY - dir * 7),
        v(0, goalY - dir * 12),
        v(5, goalY - dir * 18),
        v(-6, goalY - dir * 18),
      ]

  // attackers: best aerial threats attack the box, two stay back for cover
  const attackers = onPitch(world, atk).filter((p) => p.id !== world.ball.ownerId && p.role !== 'GK')
  const ranked = [...attackers].sort(
    (a, b) => b.attrs.physicality + b.attrs.shooting - (a.attrs.physicality + a.attrs.shooting),
  )
  ranked.forEach((p, i) => {
    if (i < spots.length) {
      out.set(p.id, { ...spots[i] })
    } else {
      // rest guard the halfway line against the counter
      out.set(p.id, v(p.anchor.x * 0.6, dir > 0 ? Math.min(p.anchor.y, 5) : Math.max(p.anchor.y, -5)))
    }
  })
  const atkGk = onPitch(world, atk).find((p) => p.role === 'GK')
  if (atkGk) out.set(atkGk.id, v(0, ownGoalY(atk) + attackDir(atk) * 2))

  // defenders: keeper holds his line, markers take goal-side spots
  const defenders = onPitch(world, def)
  const gk = defenders.find((p) => p.role === 'GK')
  if (gk) out.set(gk.id, v(clamp(r.pos.x * 0.1, -2.5, 2.5), ownGoalY(def) + attackDir(def) * 1.2))
  const markers = defenders.filter((p) => p !== gk)
  const defDir = attackDir(def)
  markers.forEach((p, i) => {
    const spot = spots[i % spots.length]
    // goal-side of the runner's spot, slightly toward own goal
    out.set(p.id, v(spot.x * 0.9, spot.y + defDir * -1.6))
  })
}
