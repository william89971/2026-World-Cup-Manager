import { PITCH } from '../constants'
import type { Mentality, Pressing } from '../../data/types'
import type { MatchSetup, Side, SimPlayer, Vec2, WorldState } from '../types'
import { attackDir, byId, onPitch, other, ownGoalY, targetGoalY } from './world'
import { clamp, dist2, lerp, v } from '../util'

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

/** What the off-ball brain needs to know about the current attack. */
interface OffBallCtx {
  /** y of the opposition's offside line (2nd-deepest outfielder), in this side's attack frame. */
  oppLineY: number
  /** y of the opposition's midfield line. */
  oppMidY: number
  buildup: boolean // in possession, ball in own third
  finalThird: boolean // ball in attacking third
  ownerIsMid: boolean // a CM/CDM/CAM/WM teammate carries the ball
  owner: SimPlayer | null
}

function offBallContext(world: WorldState, side: Side, owner: SimPlayer | null, inPoss: boolean): OffBallCtx {
  const dir = attackDir(side)
  const opps = onPitch(world, other(side)).filter((p) => p.role !== 'GK')
  // opposition defensive line = their 2nd-deepest outfielder (offside line)
  const depths = opps.map((p) => p.pos.y * dir).sort((a, b) => b - a)
  const oppLineY = (depths[1] ?? depths[0] ?? PITCH.HALF_L - 12) * dir
  const mids = opps.filter((p) => p.role === 'CM' || p.role === 'CDM' || p.role === 'CAM')
  const oppMidY = mids.length > 0 ? mids.reduce((s, p) => s + p.pos.y, 0) / mids.length : world.ball.pos.y
  const ballAdv = world.ball.pos.y * dir
  return {
    oppLineY,
    oppMidY,
    buildup: inPoss && ballAdv < -PITCH.HALF_L / 3,
    finalThird: ballAdv > PITCH.HALF_L / 3,
    ownerIsMid: !!owner && owner.side === side && (owner.role === 'CM' || owner.role === 'CDM' || owner.role === 'CAM' || owner.role === 'WM'),
    owner: owner && owner.side === side ? owner : null,
  }
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
  // goal celebration: scorer to the corner, teammates chase him
  if (world.phase === 'celebrate') {
    celebrateTargets(world, out)
    return out
  }

  const owner = byId(world, world.ball.ownerId)
  const ball = world.ball.pos
  // predicted ball position used by receivers / pressers chasing a loose ball
  // (the lead window stretches with the dilated ball speed)
  const predicted = v(ball.x + world.ball.vel.x * 0.8, ball.y + world.ball.vel.y * 0.8)
  const loose = !owner
  // side "in possession": the carrier's side, or the last team to touch a ball in flight
  const attackingSide: Side | null = owner ? owner.side : world.ball.inFlight ? world.ball.lastTouch : null
  const transition = world.transition && world.tick < world.transition.untilTick ? world.transition : null

  for (const side of ['home', 'away'] as Side[]) {
    const tac = tacticsOf(setup, side)
    const dir = attackDir(side)
    const inPoss = attackingSide === side
    const mates = onPitch(world, side)
    const ctx = shapeContext(world, side)
    const off = offBallContext(world, side, owner ?? null, inPoss)

    // who chases the ball for this side: the intended receiver runs to the
    // pass destination; otherwise the nearest player chases the live ball.
    const intendedId =
      loose && inPoss && world.ball.targetReceiverId ? world.ball.targetReceiverId : undefined
    const intendedTarget = world.ball.passTarget ?? predicted
    const chaser = loose && !intendedId ? nearestOfSide(mates, predicted) : undefined

    // ── pressing assignment (defending team closes the carrier down) ──
    // high press: front players hunt anywhere in the opposition half; momentum
    // adds a presser; workhorses join from further out.
    const pressers = new Set<string>()
    if (!inPoss && !loose) {
      const range = PRESS_RANGE[tac.pressing]
      const ballInOppHalf = ball.y * dir > 0
      const pool = mates.filter((p) => p.role !== 'GK')
      const pressDist = (p: SimPlayer) => dist2(p.pos, ball) * (p.archetype === 'workhorse' ? 0.6 : 1)
      const bonus = world.momentum[side] >= 65 ? 1 : 0
      if (tac.pressing === 'high' && ballInOppHalf) {
        const front = [...pool]
          .sort((a, b) => b.pos.y * dir - a.pos.y * dir)
          .slice(0, 5)
          .sort((a, b) => pressDist(a) - pressDist(b))
        front.slice(0, 3 + bonus).forEach((p) => pressers.add(p.id))
      } else {
        const sorted = [...pool].sort((a, b) => pressDist(a) - pressDist(b))
        sorted.slice(0, PRESS_COUNT[tac.pressing] + bonus).forEach((p, idx) => {
          if (idx === 0 || dist2(p.pos, ball) < range * range) pressers.add(p.id)
        })
      }
    }

    // counter-attack runners: the most advanced teammates sprint beyond the ball
    const counterRunners = new Set<string>()
    if (transition && transition.side === side && transition.counter && inPoss) {
      ;[...mates]
        .filter((p) => p.role !== 'GK' && p.id !== world.ball.ownerId)
        .sort((a, b) => b.pos.y * dir - a.pos.y * dir)
        .slice(0, 2)
        .forEach((p) => counterRunners.add(p.id))
    }
    // caught in transition: the other team's shape reforms slowly
    const reforming = transition && transition.side !== side
    let sprintersBack: Set<string> | null = null
    if (reforming) {
      sprintersBack = new Set(
        [...mates]
          .filter((p) => p.role !== 'GK')
          .sort((a, b) => dist2(a.pos, ball) - dist2(b.pos, ball))
          .slice(0, 2)
          .map((p) => p.id),
      )
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

      // counter: sprint into the space beyond the ball
      if (counterRunners.has(p.id)) {
        out.set(p.id, v(clamp(p.pos.x * 0.85, -(PITCH.HALF_W - 3), PITCH.HALF_W - 3), clamp(p.pos.y + dir * 18, -(PITCH.HALF_L - 2), PITCH.HALF_L - 2)))
        continue
      }

      const shaped = shapedTarget(p, ball, dir, inPoss, tac, ctx, off, mates, world)

      // caught upfield while the opponent counters: the nearest two sprint
      // back at full tilt, the rest reform gradually (shape takes seconds)
      if (reforming && (p.pos.y - ball.y) * dir > 0) {
        if (sprintersBack?.has(p.id)) {
          out.set(p.id, v(p.anchor.x, p.anchor.y - dir * MENTALITY_DROP[tac.mentality]))
        } else {
          out.set(p.id, v(lerp(p.pos.x, shaped.x, 0.35), lerp(p.pos.y, shaped.y, 0.35)))
        }
        continue
      }

      out.set(p.id, shaped)
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
  off: OffBallCtx,
  mates: SimPlayer[],
  world: WorldState,
): Vec2 {
  let tx = p.anchor.x * ctx.width
  let ty = p.anchor.y

  // whole-block follow toward the ball — loose enough that the team still
  // spans most of the pitch instead of bunching around the ball
  ty += (ball.y - p.anchor.y) * 0.14
  tx += (ball.x - p.anchor.x) * 0.08

  // attack push when in possession, drop when defending — scaled by game state
  ty += inPoss ? dir * MENTALITY_PUSH[tac.mentality] * ctx.push : -dir * MENTALITY_DROP[tac.mentality] * ctx.drop

  switch (p.role) {
    case 'Wing': {
      tx = inPoss ? Math.sign(p.anchor.x || 1) * (PITCH.HALF_W - 4) * Math.min(ctx.width, 1) : tx * 0.7
      if (inPoss) ty += dir * 6
      // overlap/underlap interplay with the fullback on this flank
      if (inPoss && off.owner && off.owner.role === 'FB' && Math.sign(off.owner.anchor.x) === Math.sign(p.anchor.x)) {
        if (Math.abs(off.owner.pos.x) > 19) {
          // fullback is wide on the ball → cut inside (underlap)
          tx *= 0.45
          ty += dir * 6
        } else {
          // fullback deeper → hold maximum width and depth
          ty += dir * 3
        }
      }
      break
    }
    case 'WM':
      tx = inPoss ? Math.sign(p.anchor.x || 1) * (PITCH.HALF_W - 7) : tx * 0.8
      break
    case 'FB': {
      if (inPoss && ball.y * dir > 6) ty += dir * 10 * ctx.push
      // push right up in the final third; overlap a winger on the ball
      if (inPoss && off.finalThird) ty += dir * 6
      if (inPoss && off.owner && off.owner.role === 'Wing' && Math.sign(off.owner.anchor.x) === Math.sign(p.anchor.x)) {
        ty = off.owner.pos.y + dir * 6 // overlap beyond the winger
        tx = Math.sign(p.anchor.x || 1) * (PITCH.HALF_W - 2.5)
        break
      }
      tx = Math.sign(p.anchor.x || 1) * Math.min(Math.abs(tx) + (inPoss ? 4 : 0), PITCH.HALF_W - 3)
      if (!inPoss) tx *= 0.78 // tuck in when defending
      break
    }
    case 'ST': {
      if (inPoss) ty += dir * 7
      tx += (ball.x - tx) * 0.18
      // timed runs in behind: when a midfielder carries the ball facing play,
      // ride the offside line and burst beyond it in waves (pace times the run)
      if (inPoss && off.ownerIsMid && !off.buildup) {
        const phase = Math.sin(world.tick * (0.025 + p.attrs.pace * 0.0003) + p.number)
        const lineY = off.oppLineY * dir // in attack frame
        const hold = lineY - 0.8
        const burst = lineY + (phase > 0.35 ? 2.5 + p.attrs.pace * 0.02 : 0)
        ty = (phase > 0.35 ? burst : Math.max(ty * dir, hold)) * dir
        if (p.archetype === 'targetman') ty = hold * dir // he pins the line instead
      }
      break
    }
    case 'CAM': {
      if (inPoss) ty += dir * 4
      // float into the pocket between their midfield and defensive lines
      if (inPoss && !off.buildup) {
        const pocketY = lerp(off.oppMidY, off.oppLineY, 0.55)
        ty = lerp(ty, pocketY, 0.6)
        tx += (ball.x > 0 ? -1 : 1) * 4 // drift into the far half-space
      }
      break
    }
    case 'CM': {
      // third-man instinct: after laying the ball off, move into new space
      if (inPoss && p.kickCd > 0) ty += dir * 5
      break
    }
    case 'CDM':
      ty -= dir * 3
      // buildup: drop between the centre-backs as the recycling option
      if (inPoss && off.buildup) {
        const cbs = mates.filter((m) => m.role === 'CB')
        if (cbs.length >= 2) {
          tx = (cbs[0].pos.x + cbs[1].pos.x) / 2
          ty = (cbs[0].pos.y + cbs[1].pos.y) / 2 + dir * 5
        }
      }
      break
    case 'CB':
      tx += (ball.x - p.anchor.x) * 0.04
      break
  }

  // rapid attackers make runs in behind when their team has the ball upfield
  if (inPoss && p.archetype === 'speedster' && (p.role === 'ST' || p.role === 'Wing' || p.role === 'CAM')) {
    if (ball.y * dir > -10) ty += dir * 4
  }
  // workhorses cover more ground toward the ball when defending
  if (!inPoss && p.archetype === 'workhorse') {
    ty += (ball.y - ty) * 0.12
    tx += (ball.x - tx) * 0.08
  }

  tx = clamp(tx, -(PITCH.HALF_W - 1), PITCH.HALF_W - 1)
  ty = clamp(ty, -(PITCH.HALF_L - 1), PITCH.HALF_L - 1)
  return v(tx, ty)
}

// ── goal celebrations ────────────────────────────────────────────
function celebrateTargets(world: WorldState, out: Map<string, Vec2>): void {
  const scorer = byId(world, world.lastScorerId)
  if (!scorer) return
  // first beat after the goal: everyone freezes and lets the moment land
  if (world.tick < world.celebrateUntil - 70) {
    for (const p of onPitch(world)) out.set(p.id, { ...p.pos })
    return
  }
  const dir = attackDir(scorer.side)
  // scorer wheels away toward the corner flag
  const corner = v(Math.sign(scorer.pos.x || 1) * (PITCH.HALF_W - 3), targetGoalY(scorer.side) - dir * 6)
  out.set(scorer.id, corner)
  for (const p of onPitch(world)) {
    if (p.id === scorer.id || p.role === 'GK') continue
    if (p.side === scorer.side) {
      // teammates mob the scorer
      out.set(p.id, v(scorer.pos.x + (p.number % 5) - 2, scorer.pos.y - dir * ((p.number % 3) + 1)))
    } else {
      out.set(p.id, { ...p.anchor })
    }
  }
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
