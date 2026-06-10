import { PITCH, PLAYER, TICK_DT } from '../constants'
import type { SimPlayer, Vec2, WorldState } from '../types'
import { clamp, len, norm, scale, sub } from '../util'

/** Heavy-legs penalty: after the hour mark, players under 40% stamina lose
 *  ~12% of their effectiveness (applies to speed and key decision attributes). */
export function fatigueFactor(p: SimPlayer, timeSec: number): number {
  if (timeSec <= 3600 || p.stamina >= 40) return 1
  // scales 0.88 at 39% stamina down to 0.85 when fully drained
  return 0.85 + 0.03 * (p.stamina / 40)
}

export function maxSpeed(p: SimPlayer, timeSec = 0): number {
  const paceFactor = (p.attrs.pace - 50) / 49 // ~ -0.4 .. 1
  const staminaFactor = 0.72 + 0.28 * (p.stamina / 100)
  return (PLAYER.BASE_SPEED + PLAYER.SPEED_PACE_BONUS * paceFactor) * staminaFactor * fatigueFactor(p, timeSec)
}

/** Steer every on-pitch player toward their target for one tick. */
export function stepMovement(world: WorldState, targets: Map<string, Vec2>): void {
  for (const p of world.players) {
    if (!p.onPitch || p.red) continue
    const target = targets.get(p.id) ?? p.pos
    const toTarget = sub(target, p.pos)
    const d = len(toTarget)
    const ms = maxSpeed(p, world.timeSec)

    // slow into the target to avoid jitter
    const speed = d < 1 ? ms * d : ms
    const desiredVel = d < 1e-3 ? { x: 0, y: 0 } : scale(norm(toTarget), speed)

    // accelerate toward desired velocity
    const dv = sub(desiredVel, p.vel)
    const maxDv = PLAYER.ACCEL * TICK_DT
    const dvLen = len(dv)
    if (dvLen > maxDv) {
      p.vel.x += (dv.x / dvLen) * maxDv
      p.vel.y += (dv.y / dvLen) * maxDv
    } else {
      p.vel.x = desiredVel.x
      p.vel.y = desiredVel.y
    }

    p.pos.x = clamp(p.pos.x + p.vel.x * TICK_DT, -(PITCH.HALF_W + 1), PITCH.HALF_W + 1)
    p.pos.y = clamp(p.pos.y + p.vel.y * TICK_DT, -(PITCH.HALF_L + 1), PITCH.HALF_L + 1)
    // keep players out of the goal nets (net occupies the strip behind the goal mouth)
    if (Math.abs(p.pos.y) > PITCH.HALF_L - 0.2 && Math.abs(p.pos.x) < PITCH.GOAL_HALF_W + 1.4) {
      p.pos.y = Math.sign(p.pos.y) * (PITCH.HALF_L - 0.2)
      if (p.vel.y * Math.sign(p.pos.y) > 0) p.vel.y = 0
    }

    // stamina drain proportional to effort
    const effort = len(p.vel) / Math.max(ms, 0.1)
    p.stamina = clamp(p.stamina - (0.004 + 0.012 * effort * effort), 5, 100)
    if (p.kickCd > 0) p.kickCd--
  }
}
