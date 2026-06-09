import { PITCH } from '../constants'
import type { Mentality, Pressing } from '../../data/types'
import type { MatchSetup, Side, SimPlayer, Vec2, WorldState } from '../types'
import { attackDir, byId, onPitch, ownGoalY } from './world'
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

    // who chases the ball for this side: the intended receiver runs to the
    // pass destination; otherwise the nearest player chases the live ball.
    const intendedId =
      loose && inPoss && world.ball.targetReceiverId ? world.ball.targetReceiverId : undefined
    const intendedTarget = world.ball.passTarget ?? predicted
    const chaser = loose && !intendedId ? nearestOfSide(mates, predicted) : undefined

    // pressing assignment (defending team closes the carrier down)
    const pressers = new Set<string>()
    if (!inPoss && !loose) {
      const range = PRESS_RANGE[tac.pressing]
      const sorted = [...mates]
        .filter((p) => p.role !== 'GK')
        .sort((a, b) => dist2(a.pos, ball) - dist2(b.pos, ball))
      sorted.slice(0, PRESS_COUNT[tac.pressing]).forEach((p, idx) => {
        if (idx === 0 || dist2(p.pos, ball) < range * range) pressers.add(p.id)
      })
    }

    for (const p of mates) {
      if (p.id === world.ball.ownerId) continue

      if (p.role === 'GK') {
        out.set(p.id, gkTarget(side, ball))
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

      out.set(p.id, shapedTarget(p, ball, dir, inPoss, tac))
    }
  }
  return out
}

function gkTarget(side: Side, ball: Vec2): Vec2 {
  const dir = attackDir(side)
  const goalY = ownGoalY(side)
  const advance = clamp((ball.y - goalY) * dir, 0, 30) * 0.18
  return v(clamp(ball.x * 0.25, -6, 6), goalY + dir * (1.4 + advance))
}

function shapedTarget(p: SimPlayer, ball: Vec2, dir: number, inPoss: boolean, tac: SideTactics): Vec2 {
  let tx = p.anchor.x
  let ty = p.anchor.y

  // whole-block follow toward the ball (compactness)
  ty += (ball.y - p.anchor.y) * 0.22
  tx += (ball.x - p.anchor.x) * 0.12

  // attack push when in possession, drop when defending
  ty += inPoss ? dir * MENTALITY_PUSH[tac.mentality] : -dir * MENTALITY_DROP[tac.mentality]

  switch (p.role) {
    case 'Wing':
      tx = inPoss ? Math.sign(p.anchor.x || 1) * (PITCH.HALF_W - 4) : tx * 0.7
      if (inPoss) ty += dir * 6
      break
    case 'WM':
      tx = inPoss ? Math.sign(p.anchor.x || 1) * (PITCH.HALF_W - 7) : tx * 0.8
      break
    case 'FB':
      if (inPoss && ball.y * dir > 6) ty += dir * 10
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

  tx = clamp(tx, -(PITCH.HALF_W - 1), PITCH.HALF_W - 1)
  ty = clamp(ty, -(PITCH.HALF_L - 1), PITCH.HALF_L - 1)
  return v(tx, ty)
}
