import { BALL, PITCH, PLAYER } from '../constants'
import type { MatchEvent, MatchSetup, SimPlayer, Vec2, WorldState } from '../types'
import { attackDir, byId, onPitch, other, targetGoalY } from './world'
import { clamp, dist, gauss, len, norm, scale, sub, v } from '../util'

export type EmitFn = (ev: Omit<MatchEvent, 'tick' | 'timeSec'>) => void

const clamp01 = (n: number) => clamp(n, 0, 1)

function nearestOpponentDist(world: WorldState, p: SimPlayer): number {
  let best = Infinity
  for (const o of onPitch(world, other(p.side))) {
    const d = dist(o.pos, p.pos)
    if (d < best) best = d
  }
  return best
}

function opponentKeeper(world: WorldState, side: SimPlayer['side']): SimPlayer | undefined {
  return onPitch(world, other(side)).find((p) => p.role === 'GK')
}

/** Decide and execute the ball-carrier's action. Returns the dribble target
 *  (if the player keeps the ball), else null (ball was released). */
export function decideOnBall(
  world: WorldState,
  _setup: MatchSetup,
  rng: () => number,
  emit: EmitFn,
): Vec2 | null {
  const owner = byId(world, world.ball.ownerId)
  if (!owner || owner.kickCd > 0) return owner ? dribbleTarget(world, owner) : null

  const dir = attackDir(owner.side)
  const goal = v(0, targetGoalY(owner.side))
  const d2goal = dist(owner.pos, goal)
  const central = 1 - clamp01(Math.abs(owner.pos.x) / 30)
  const pressured = nearestOpponentDist(world, owner)
  const pressFactor = clamp01(1 - pressured / 6) // 1 = heavily pressured

  // ── shot quality ─────────────────────────────────────────────
  const distFactor = clamp01(1 - (d2goal - 6) / 26)
  const q = clamp01((owner.attrs.shooting / 99) * distFactor * (0.45 + 0.55 * central) * (1 - 0.35 * pressFactor))
  const shootRange = 13 + owner.attrs.shooting * 0.11
  const wantShoot = d2goal < shootRange && owner.pos.y * dir > 2 && q > 0.1 && rng() < 0.0015 + q * 0.03
  if (wantShoot) {
    return shoot(world, owner, goal, q, rng, emit)
  }

  // ── cross from wide advanced areas ───────────────────────────
  const advanced = owner.pos.y * dir > PITCH.HALF_L - 28
  const wide = Math.abs(owner.pos.x) > 19
  if (advanced && wide && rng() < 0.5) {
    const crossed = cross(world, owner, rng, emit)
    if (crossed) return null
  }

  // ── pass selection ───────────────────────────────────────────
  const pass = bestPass(world, owner, dir)
  const deepDefender = (owner.role === 'CB' || owner.role === 'GK' || owner.role === 'FB') && owner.pos.y * dir < -10
  if (deepDefender && pressFactor > 0.7 && (!pass || pass.score < 4)) {
    clearBall(world, owner, dir, rng, emit)
    return null
  }

  const dribbleScore = (owner.attrs.dribbling / 99) * (1 - pressFactor) * 6
  if (pass && pass.score > dribbleScore && rng() < 0.82) {
    executePass(world, owner, pass.target, pass.lofted, pass.receiverId, rng)
    return null
  }

  // ── dribble forward ──────────────────────────────────────────
  return dribbleTarget(world, owner)
}

function shoot(
  world: WorldState,
  shooter: SimPlayer,
  goal: Vec2,
  q: number,
  rng: () => number,
  emit: EmitFn,
): null {
  const gk = opponentKeeper(world, shooter.side)
  const gkRating = gk?.overall ?? 70
  const onTargetProb = clamp01(0.35 + q * 0.35)
  const onTarget = rng() < onTargetProb
  const pGoal = clamp01(q * 0.6 * (shooter.attrs.shooting / (shooter.attrs.shooting + gkRating * 0.95)))
  const isGoal = onTarget && rng() < pGoal
  const outcome: 'goal' | 'save' | 'off' = isGoal ? 'goal' : onTarget ? 'save' : 'off'

  // aim point on the goal line
  const postSide = rng() < 0.5 ? -1 : 1
  let aimX: number
  let aimZ: number
  if (outcome === 'goal') {
    aimX = postSide * (PITCH.GOAL_HALF_W - 0.6) * (0.5 + rng() * 0.5)
    aimZ = 0.4 + rng() * 1.6
  } else if (outcome === 'save') {
    aimX = postSide * (PITCH.GOAL_HALF_W - 1.2) * rng()
    aimZ = 0.3 + rng() * 1.2
  } else {
    aimX = postSide * (PITCH.GOAL_HALF_W + 1 + rng() * 4)
    aimZ = rng() < 0.5 ? 0.2 : PITCH.GOAL_HEIGHT + 0.5 + rng() * 2
  }

  const aim = v(aimX, goal.y)
  const dirVec = norm(sub(aim, shooter.pos))
  const speed = BALL.MAX_SHOT_SPEED * (0.72 + rng() * 0.28)
  const flightTime = Math.max(0.4, dist(shooter.pos, aim) / speed)

  world.ball.ownerId = null
  world.ball.inFlight = true
  world.ball.shooterId = shooter.id
  world.ball.shotOutcome = outcome
  world.ball.lastTouch = shooter.side
  world.ball.lastPasserId = null
  world.ball.passTarget = null
  world.ball.targetReceiverId = null
  world.ball.vel = scale(dirVec, speed)
  world.ball.vz = (aimZ - world.ball.z) / flightTime + 0.5 * BALL.GRAVITY * flightTime
  shooter.kickCd = 6

  world.stats.shots[shooter.side]++
  if (outcome !== 'off') world.stats.onTarget[shooter.side]++
  shooter.ratingPoints += q > 0.35 ? 0.05 : 0.02

  emit({
    type: q > 0.5 ? 'bigchance' : 'shot',
    side: shooter.side,
    playerId: shooter.id,
    playerName: shooter.name,
    pos: { ...shooter.pos },
    text: `${shooter.name} shoots`,
  })
  return null
}

interface PassOption {
  target: Vec2
  score: number
  lofted: boolean
  receiverId: string
}

function bestPass(world: WorldState, owner: SimPlayer, dir: number): PassOption | null {
  let best: PassOption | null = null
  for (const mate of onPitch(world, owner.side)) {
    if (mate.id === owner.id) continue
    const passDist = dist(owner.pos, mate.pos)
    if (passDist > 38) continue
    const forwardGain = (mate.pos.y - owner.pos.y) * dir
    let openness = Infinity
    for (const o of onPitch(world, other(owner.side))) {
      const dd = dist(o.pos, mate.pos)
      if (dd < openness) openness = dd
    }
    openness = Math.min(openness, 15)
    const score =
      forwardGain * 0.5 +
      openness * 0.95 -
      passDist * 0.28 +
      (mate.role === 'GK' ? -8 : 0)
    if (!best || score > best.score) {
      // lead the pass slightly into the runner / toward goal
      const lead = scale(mate.vel, 0.45)
      const target = { x: mate.pos.x + lead.x, y: mate.pos.y + lead.y + dir * 1.5 }
      best = { target, score, lofted: passDist > 30, receiverId: mate.id }
    }
  }
  return best
}

function executePass(
  world: WorldState,
  owner: SimPlayer,
  target: Vec2,
  lofted: boolean,
  receiverId: string | null,
  rng: () => number,
): void {
  const toTarget = sub(target, owner.pos)
  const d = len(toTarget)
  // angular error grows when passing is poor and distance is long
  const errSd = (1 - owner.attrs.passing / 99) * 0.12 + d * 0.001
  const ang = Math.atan2(toTarget.y, toTarget.x) + gauss(rng, 0, errSd)
  const speed = clamp(d / 1.05, 7, BALL.MAX_PASS_SPEED)
  world.ball.ownerId = null
  world.ball.inFlight = true
  world.ball.shotOutcome = null
  world.ball.shooterId = null
  world.ball.lastPasserId = owner.id
  world.ball.lastTouch = owner.side
  world.ball.passTarget = { ...target }
  world.ball.targetReceiverId = receiverId
  world.ball.vel = v(Math.cos(ang) * speed, Math.sin(ang) * speed)
  world.ball.vz = lofted ? 3.2 : 0
  owner.kickCd = 3
  world.stats.passesAttempted[owner.side]++
  owner.ratingPoints += 0.003
}

function cross(world: WorldState, owner: SimPlayer, rng: () => number, emit: EmitFn): boolean {
  const dir = attackDir(owner.side)
  // pick the best attacker in/near the box
  const box = onPitch(world, owner.side).filter(
    (p) => p.id !== owner.id && p.pos.y * dir > PITCH.HALF_L - 20 && Math.abs(p.pos.x) < 18,
  )
  if (box.length === 0) return false
  const target = box.sort((a, b) => b.overall - a.overall)[0]
  const aim = { x: target.pos.x + gauss(rng, 0, 3), y: target.pos.y }
  const toAim = sub(aim, owner.pos)
  const d = len(toAim)
  const speed = clamp(d / 0.8, 10, BALL.MAX_PASS_SPEED)
  world.ball.ownerId = null
  world.ball.inFlight = true
  world.ball.shotOutcome = null
  world.ball.shooterId = null
  world.ball.lastPasserId = owner.id
  world.ball.lastTouch = owner.side
  world.ball.passTarget = { ...aim }
  world.ball.targetReceiverId = target.id
  world.ball.vel = scale(norm(toAim), speed)
  world.ball.vz = 4.5
  owner.kickCd = 3
  world.stats.passesAttempted[owner.side]++
  emit({ type: 'shot', side: owner.side, playerId: owner.id, playerName: owner.name, text: `${owner.name} crosses`, pos: { ...owner.pos } })
  return true
}

function clearBall(world: WorldState, owner: SimPlayer, dir: number, rng: () => number, emit: EmitFn): void {
  const aim = v((rng() - 0.5) * PITCH.W, owner.pos.y + dir * 40)
  const toAim = sub(aim, owner.pos)
  world.ball.ownerId = null
  world.ball.inFlight = true
  world.ball.shotOutcome = null
  world.ball.shooterId = null
  world.ball.lastPasserId = null
  world.ball.lastTouch = owner.side
  world.ball.passTarget = null
  world.ball.targetReceiverId = null
  world.ball.vel = scale(norm(toAim), BALL.MAX_PASS_SPEED)
  world.ball.vz = 5
  owner.kickCd = 4
  emit({ type: 'interception', side: owner.side, playerId: owner.id, playerName: owner.name, text: `${owner.name} clears`, pos: { ...owner.pos } })
}

function dribbleTarget(world: WorldState, owner: SimPlayer): Vec2 {
  const dir = attackDir(owner.side)
  const goal = v(0, targetGoalY(owner.side))
  let drive = norm(sub(goal, owner.pos))
  // steer away from the nearest opponent if close
  let nearest: SimPlayer | undefined
  let nd = Infinity
  for (const o of onPitch(world, other(owner.side))) {
    const dd = dist(o.pos, owner.pos)
    if (dd < nd) {
      nd = dd
      nearest = o
    }
  }
  if (nearest && nd < 4) {
    const away = norm(sub(owner.pos, nearest.pos))
    drive = norm({ x: drive.x + away.x * 0.9, y: drive.y + away.y * 0.6 })
  }
  return {
    x: clamp(owner.pos.x + drive.x * 6, -(PITCH.HALF_W - 1), PITCH.HALF_W - 1),
    y: clamp(owner.pos.y + drive.y * 6 + dir * 1, -(PITCH.HALF_L - 1), PITCH.HALF_L - 1),
  }
}

export { PLAYER }
