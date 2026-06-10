import { BALL, PACE, PITCH, PLAYER, TICK_DT } from '../constants'
import type { MatchSetup, Side, SimPlayer, Vec2, WorldState } from '../types'
import { attackDir, byId, nearestPlayer, onPitch, other, ownGoalY, shiftMomentum } from './world'
import type { EmitFn } from './decision'
import { clamp, dist, scale, v } from '../util'

/** Open a 3-second transition window for the side that just won the ball.
 *  If 2+ of their players are already ahead of the ball, it's a counter. */
function openTransition(world: WorldState, side: Side): void {
  if (world.phase !== 'open') return
  const dir = attackDir(side)
  const ballY = world.ball.pos.y
  const ahead = onPitch(world, side).filter(
    (p) => p.role !== 'GK' && (p.pos.y - ballY) * dir > 3,
  ).length
  world.transition = { side, untilTick: world.tick + 100, counter: ahead >= 2 }
  // winning the ball back in the opposition half = a successful press
  if (ballY * dir > 0) shiftMomentum(world, side, 3)
}

/** Advance the ball + resolve possession/tackles/goals for one tick. */
export function stepBall(world: WorldState, setup: MatchSetup, rng: () => number, emit: EmitFn): void {
  const ball = world.ball
  const owner = byId(world, ball.ownerId)

  if (owner) {
    // glued to the dribbler's feet, just ahead in their direction of travel
    const dir = attackDir(owner.side)
    const aheadY = Math.sign(owner.vel.y || dir) * PLAYER.KICK_OFFSET * 0.6
    ball.pos.x = owner.pos.x + Math.sign(owner.vel.x || 0) * PLAYER.KICK_OFFSET * 0.4
    ball.pos.y = owner.pos.y + aheadY + dir * 0.3
    ball.z = 0
    ball.vz = 0
    ball.vel = { ...owner.vel }
    ball.inFlight = false
    // no tackling while a set piece is forming
    if (world.phase === 'open' || world.phase === 'kickoff') tryTackle(world, setup, owner, rng, emit)
    return
  }

  // ── loose / in flight: integrate ─────────────────────────────
  ball.pos.x += ball.vel.x * TICK_DT
  ball.pos.y += ball.vel.y * TICK_DT
  if (ball.z > 0 || ball.vz !== 0) {
    ball.vz -= BALL.GRAVITY * TICK_DT
    ball.z += ball.vz * TICK_DT
    if (ball.z <= 0) {
      ball.z = 0
      ball.vz = -ball.vz * BALL.BOUNCE
      if (Math.abs(ball.vz) < 1 * PACE) ball.vz = 0
      ball.vel = scale(ball.vel, 0.7) // grip on bounce
    }
  }
  const airborne = ball.z > 0.1
  const decay = Math.pow(airborne ? BALL.AIR_DRAG : BALL.GROUND_FRICTION, TICK_DT)
  ball.vel = scale(ball.vel, decay)

  if (resolveBounds(world, setup, emit)) return
  tryControl(world, rng, emit)

  // ── stuck-ball watchdog ──────────────────────────────────────
  // A loose, near-stationary ball that nobody collects for ~3s (or a NaN'd
  // position from a physics edge case) is handed to the nearest player.
  if (!Number.isFinite(ball.pos.x) || !Number.isFinite(ball.pos.y)) {
    ball.pos = v(0, 0)
    ball.vel = v(0, 0)
    ball.z = 0
    ball.vz = 0
    ball.inFlight = false
  }
  if (!ball.ownerId && world.phase === 'open' && Math.hypot(ball.vel.x, ball.vel.y) < 0.5 * PACE && ball.z < 0.3) {
    ball.idleTicks = (ball.idleTicks ?? 0) + 1
    if (ball.idleTicks > 100) {
      const taker = nearestPlayer(world, ball.pos)
      if (taker) {
        ball.ownerId = taker.id
        ball.lastTouch = taker.side
        ball.inFlight = false
        ball.shotOutcome = null
        ball.idleTicks = 0
      }
    }
  } else {
    ball.idleTicks = 0
  }
}

/** Goal-line + sideline detection. Returns true if a stoppage was triggered. */
function resolveBounds(world: WorldState, setup: MatchSetup, emit: EmitFn): boolean {
  const ball = world.ball

  // sidelines → throw-in
  if (Math.abs(ball.pos.x) > PITCH.HALF_W) {
    const toSide = other(ball.lastTouch ?? 'home')
    throwIn(world, toSide, v(Math.sign(ball.pos.x) * (PITCH.HALF_W - 0.4), clamp(ball.pos.y, -PITCH.HALF_L + 5, PITCH.HALF_L - 5)), emit)
    return true
  }

  // goal lines
  for (const side of ['home', 'away'] as Side[]) {
    const goalY = ownGoalY(side) // this side defends here
    const crossed = side === 'home' ? ball.pos.y <= goalY : ball.pos.y >= goalY
    if (!crossed) continue

    const attacker = other(side) // team attacking this goal
    const insidePosts = Math.abs(ball.pos.x) < PITCH.GOAL_HALF_W && ball.z < PITCH.GOAL_HEIGHT

    if (ball.inFlight && ball.shotOutcome === 'goal' && insidePosts) {
      scoreGoal(world, attacker, emit)
      return true
    }
    if (ball.inFlight && ball.shotOutcome === 'save') {
      keeperSave(world, side, emit)
      return true
    }
    // any other crossing → restart
    if (ball.lastTouch === attacker) {
      goalKick(world, side, emit)
    } else {
      corner(world, setup, attacker, Math.sign(ball.pos.x) || 1, emit)
    }
    return true
  }
  return false
}

function scoreGoal(world: WorldState, side: Side, emit: EmitFn): void {
  world.score[side]++
  shiftMomentum(world, side, 12)
  const scorer = byId(world, world.ball.shooterId)
  const assister = byId(world, world.ball.lastPasserId)
  world.lastScorerId = scorer?.id ?? null
  if (scorer) {
    scorer.goals++
    scorer.ratingPoints += 1.7
  }
  if (assister && assister.id !== scorer?.id) {
    assister.assists++
    assister.ratingPoints += 0.85
  }
  emit({
    type: 'goal',
    side,
    playerId: scorer?.id,
    playerName: scorer?.name,
    secondaryId: assister?.id,
    secondaryName: assister?.name,
    pos: { x: 0, y: ownGoalY(other(side)) },
    text: `GOAL! ${scorer?.name ?? side} scores!`,
    score: { ...world.score },
  })
  // concede penalty to keeper ratings
  const gk = onPitch(world, side === 'home' ? 'away' : 'home').find((p) => p.role === 'GK')
  if (gk) gk.ratingPoints -= 0.35

  resetBall(world)
  world.phase = 'celebrate'
  // ~1.5 real seconds of frozen disbelief, then the celebration run
  world.celebrateUntil = world.tick + 220
  world.ball.shotOutcome = null
  world.ball.inFlight = false
  world.ball.ownerId = null
  // kickoff goes to the conceding side
  world.restart = { type: 'kickoff', side, pos: v(0, 0), delay: 30 }
}

function keeperSave(world: WorldState, defendingSide: Side, emit: EmitFn): void {
  const gk = onPitch(world, defendingSide).find((p) => p.role === 'GK')
  shiftMomentum(world, defendingSide, 5) // big chance survived
  if (gk) {
    gk.saves++
    gk.ratingPoints += 0.16
    emit({ type: 'save', side: defendingSide, playerId: gk.id, playerName: gk.name, pos: { ...gk.pos }, text: `${gk.name} saves!` })
  } else {
    emit({ type: 'save', side: defendingSide, text: 'Saved!' })
  }
  goalKick(world, defendingSide, emit)
}

const RECEIVE_R = PLAYER.CONTROL_RADIUS * 2.2 // intended receiver's trap radius
const INTERCEPT_R = PLAYER.CONTROL_RADIUS * 0.9 // tight lane interception
const LOOSE_R = PLAYER.CONTROL_RADIUS * 1.15 // collecting a slow loose ball
const FAST = 6 * PACE // m/s above which a pass is "in flight"

function eligible(world: WorldState, point: Vec2, side?: Side): { p: SimPlayer; d: number } | undefined {
  let best: SimPlayer | undefined
  let bestD = Infinity
  for (const p of onPitch(world, side)) {
    if (p.kickCd > 0) continue
    const d = dist(p.pos, point)
    if (d < bestD) { bestD = d; best = p }
  }
  return best ? { p: best, d: bestD } : undefined
}

function tryControl(world: WorldState, rng: () => number, emit: EmitFn): void {
  const ball = world.ball
  if (ball.z > 2) return
  const passSide: Side | null = byId(world, ball.lastPasserId)?.side ?? ball.lastTouch
  const speed = Math.hypot(ball.vel.x, ball.vel.y)
  const fast = !!ball.inFlight && speed > FAST

  let controller: SimPlayer | undefined
  let intercepted = false

  if (fast) {
    // a defender in the lane can make a tight interception first — sampled
    // probabilistically per tick because the dilated ball crosses his window
    // over several ticks instead of skipping past in one
    const def = passSide ? eligible(world, ball.pos, other(passSide)) : undefined
    const receiver = byId(world, ball.targetReceiverId)
    const reachedTarget = ball.passTarget ? dist(ball.pos, ball.passTarget) <= 2.5 : false
    if (def && def.d <= INTERCEPT_R && rng() < 0.2) {
      controller = def.p
      intercepted = true
    } else if (receiver && receiver.kickCd === 0 && receiver.side === passSide) {
      // …otherwise the intended receiver traps it, or collects it at the target
      const dr = dist(receiver.pos, ball.pos)
      if (dr <= RECEIVE_R || (reachedTarget && dist(receiver.pos, ball.passTarget!) <= 4.5)) {
        controller = receiver
      }
    }
  } else {
    // slow / loose ball: nearest eligible player collects, receiver-biased
    const mate = passSide ? eligible(world, ball.pos, passSide) : undefined
    const opp = passSide ? eligible(world, ball.pos, other(passSide)) : eligible(world, ball.pos)
    if (mate && mate.d <= LOOSE_R && (!opp || mate.d <= opp.d + 0.4)) {
      controller = mate.p
    } else if (opp && opp.d <= LOOSE_R) {
      controller = opp.p
      intercepted = opp.p.side !== passSide
    }
  }
  if (!controller) return

  const wasInFlight = ball.inFlight
  const fromPasser = byId(world, ball.lastPasserId)
  ball.ownerId = controller.id
  ball.inFlight = false
  ball.shotOutcome = null
  ball.shooterId = null
  ball.passTarget = null
  ball.targetReceiverId = null
  ball.vel = v(0, 0)
  ball.vz = 0
  ball.z = 0
  // a controlling touch: the receiver takes a beat before he can release the
  // ball again — this is what gives play its rhythm
  controller.kickCd = Math.max(controller.kickCd, PLAYER.CONTROL_TICKS)

  if (wasInFlight && fromPasser) {
    if (!intercepted && controller.side === fromPasser.side) {
      world.stats.passesCompleted[fromPasser.side]++
    } else if (intercepted) {
      ball.lastPasserId = null
      controller.ratingPoints += 0.015
      openTransition(world, controller.side)
      emit({ type: 'interception', side: controller.side, playerId: controller.id, playerName: controller.name, pos: { ...controller.pos }, text: `${controller.name} intercepts` })
    }
  }
  ball.lastTouch = controller.side
}

function tryTackle(world: WorldState, setup: MatchSetup, owner: SimPlayer, rng: () => number, emit: EmitFn): void {
  for (const opp of onPitch(world, other(owner.side))) {
    if (dist(opp.pos, owner.pos) > PLAYER.REACH) continue
    const ratio = opp.attrs.defending / (opp.attrs.defending + owner.attrs.dribbling)
    // per-tick engage rate is PACE-dilated: duels last the same share of play
    if (rng() < 0.026 * (0.6 + ratio)) {
      // tackle engaged — dribblers ride challenges and draw more fouls
      const cleanProb = owner.archetype === 'dribbler' ? 0.84 : 0.9
      if (rng() < cleanProb) {
        // clean win
        world.ball.ownerId = opp.id
        world.ball.lastTouch = opp.side
        world.ball.lastPasserId = null
        opp.kickCd = Math.max(opp.kickCd, PLAYER.CONTROL_TICKS)
        opp.ratingPoints += 0.04
        owner.ratingPoints -= 0.03
        openTransition(world, opp.side)
        emit({ type: 'tackle', side: opp.side, playerId: opp.id, playerName: opp.name, pos: { ...opp.pos }, text: `${opp.name} wins the ball` })
      } else {
        foul(world, setup, opp, owner, rng, emit)
      }
      return
    }
  }
}

function foul(world: WorldState, setup: MatchSetup, fouler: SimPlayer, victim: SimPlayer, rng: () => number, emit: EmitFn): void {
  world.stats.fouls[fouler.side]++
  fouler.ratingPoints -= 0.08
  emit({ type: 'foul', side: fouler.side, playerId: fouler.id, playerName: fouler.name, secondaryId: victim.id, secondaryName: victim.name, pos: { ...victim.pos }, text: `Foul by ${fouler.name}` })

  // card logic
  const dangerous = rng() < 0.11
  if (dangerous) {
    fouler.yellow++
    world.stats.yellows[fouler.side]++
    shiftMomentum(world, victim.side, 2) // a booking won
    if (fouler.yellow >= 2) {
      fouler.red = true
      fouler.onPitch = false
      fouler.offSec = world.timeSec
      world.stats.reds[fouler.side]++
      shiftMomentum(world, fouler.side, -10)
      emit({ type: 'red', side: fouler.side, playerId: fouler.id, playerName: fouler.name, pos: { ...fouler.pos }, text: `${fouler.name} is sent off (2nd yellow)!` })
    } else {
      emit({ type: 'yellow', side: fouler.side, playerId: fouler.id, playerName: fouler.name, pos: { ...fouler.pos }, text: `${fouler.name} booked` })
    }
  } else if (rng() < 0.005) {
    fouler.red = true
    fouler.onPitch = false
    fouler.offSec = world.timeSec
    world.stats.reds[fouler.side]++
    shiftMomentum(world, fouler.side, -10)
    emit({ type: 'red', side: fouler.side, playerId: fouler.id, playerName: fouler.name, pos: { ...fouler.pos }, text: `${fouler.name} is sent off!` })
  }

  // penalty if inside the box, else free kick
  const goalY = ownGoalY(victim.side === 'home' ? 'away' : 'home') // goal the victim attacks
  const inBox = Math.abs(victim.pos.y - goalY) < PITCH.PEN_BOX_DEPTH && Math.abs(victim.pos.x) < PITCH.PEN_BOX_HALF_W
  // most contact inside the box is waved on / given as an indirect free kick;
  // only a clear foul becomes a spot-kick, keeping penalties rare.
  if (inBox && rng() < 0.3) {
    penalty(world, setup, victim.side, rng, emit)
  } else {
    freeKick(world, setup, victim.side, { ...victim.pos }, emit)
  }
}

/** The designated taker for a set piece, if they're on the pitch. */
function designatedTaker(
  world: WorldState,
  setup: MatchSetup,
  side: Side,
  kind: 'corners' | 'freeKicks' | 'penalties',
): SimPlayer | undefined {
  const team = side === 'home' ? setup.home : setup.away
  const id = team.setPieceTakers?.[kind]
  if (!id) return undefined
  return onPitch(world, side).find((p) => p.id === id)
}

// ── restart helpers ──────────────────────────────────────────────
function resetBall(world: WorldState): void {
  world.ball.vel = v(0, 0)
  world.ball.vz = 0
  world.ball.z = 0
}

function giveTo(world: WorldState, side: Side, pos: Vec2, prefer?: (p: SimPlayer) => boolean): void {
  resetBall(world)
  const mates = onPitch(world, side)
  const taker = (prefer && mates.find(prefer)) ?? nearestPlayer(world, pos, side) ?? mates[0]
  world.ball.pos = { ...pos }
  world.ball.ownerId = taker?.id ?? null
  world.ball.inFlight = false
  world.ball.shotOutcome = null
  world.ball.lastTouch = side
  world.ball.lastPasserId = null
  world.ball.passTarget = null
  world.ball.targetReceiverId = null
  if (taker) taker.pos = { ...pos }
}

function throwIn(world: WorldState, side: Side, pos: Vec2, emit: EmitFn): void {
  giveTo(world, side, pos)
  world.phase = 'open'
  emit({ type: 'throwin', side, pos, text: 'Throw-in' })
}

function goalKick(world: WorldState, side: Side, emit: EmitFn): void {
  const pos = v(0, ownGoalY(side) + attackDir(side) * 5.5)
  giveTo(world, side, pos, (p) => p.role === 'GK')
  world.phase = 'open'
  emit({ type: 'goalkick', side, pos, text: 'Goal kick' })
}

function corner(world: WorldState, setup: MatchSetup, side: Side, xSign: number, emit: EmitFn): void {
  const goalY = ownGoalY(other(side))
  const pos = v(xSign * (PITCH.HALF_W - 0.5), goalY)
  world.stats.corners[side]++
  const designated = designatedTaker(world, setup, side, 'corners')
  giveTo(world, side, pos, designated ? (p) => p.id === designated.id : (p) => p.role === 'Wing' || p.role === 'WM')
  // hold play briefly so the box routine (near post / far post / edge runs) forms
  world.phase = 'corner'
  world.restart = { type: 'corner', side, pos: { ...pos }, delay: 100 }
  emit({ type: 'corner', side, pos, text: 'Corner' })
}

function freeKick(world: WorldState, setup: MatchSetup, side: Side, pos: Vec2, emit: EmitFn): void {
  const attackingThird = pos.y * attackDir(side) > PITCH.HALF_L - 25
  const designated = attackingThird ? designatedTaker(world, setup, side, 'freeKicks') : undefined
  giveTo(world, side, pos, designated ? (p) => p.id === designated.id : undefined)
  if (attackingThird) {
    // dangerous free kick: let runners flood the box before delivery
    world.phase = 'freekick'
    world.restart = { type: 'freekick', side, pos: { ...pos }, delay: 80 }
  } else {
    world.phase = 'open'
  }
  emit({ type: 'freekick', side, pos, text: 'Free kick' })
}

function penalty(world: WorldState, setup: MatchSetup, side: Side, rng: () => number, emit: EmitFn): void {
  emit({ type: 'penalty', side, text: 'PENALTY!' })
  // a penalty is always a shot on target — count it so stats stay consistent
  // (a scored penalty must never show as "0 on target"). Accounting only.
  world.stats.shots[side]++
  world.stats.onTarget[side]++
  // resolve immediately to keep play flowing
  const takers = onPitch(world, side)
    .filter((p) => p.role !== 'GK')
    .sort((a, b) => b.attrs.shooting - a.attrs.shooting)
  const taker = designatedTaker(world, setup, side, 'penalties') ?? takers[0]
  const gk = onPitch(world, other(side)).find((p) => p.role === 'GK')
  const pScore = clamp(0.78 + (taker ? (taker.attrs.shooting - 80) / 200 : 0) - (gk ? (gk.overall - 80) / 300 : 0), 0.55, 0.92)
  if (rng() < pScore) {
    world.score[side]++
    shiftMomentum(world, side, 12)
    if (taker) {
      taker.goals++
      taker.ratingPoints += 1.2
      world.lastScorerId = taker.id
    }
    emit({ type: 'goal', side, playerId: taker?.id, playerName: taker?.name, pos: { x: 0, y: ownGoalY(other(side)) }, text: `GOAL! ${taker?.name ?? ''} scores the penalty`, score: { ...world.score } })
    world.phase = 'celebrate'
    world.celebrateUntil = world.tick + 220
    world.restart = { type: 'kickoff', side: other(side), pos: v(0, 0), delay: 30 }
    resetBall(world)
    world.ball.ownerId = null
  } else {
    shiftMomentum(world, side, -8) // missed penalty deflates
    if (gk) {
      gk.saves++
      gk.ratingPoints += 0.6
      emit({ type: 'save', side: other(side), playerId: gk.id, playerName: gk.name, text: `${gk.name} saves the penalty!` })
    }
    goalKick(world, other(side), emit)
  }
}
