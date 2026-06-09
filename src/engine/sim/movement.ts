import { PITCH, PLAYER, TICK_DT } from '../constants'
import type { SimPlayer, Vec2, WorldState } from '../types'
import { clamp, len, norm, scale, sub } from '../util'

export function maxSpeed(p: SimPlayer): number {
  const paceFactor = (p.attrs.pace - 50) / 49 // ~ -0.4 .. 1
  const staminaFactor = 0.72 + 0.28 * (p.stamina / 100)
  return (PLAYER.BASE_SPEED + PLAYER.SPEED_PACE_BONUS * paceFactor) * staminaFactor
}

/** Steer every on-pitch player toward their target for one tick. */
export function stepMovement(world: WorldState, targets: Map<string, Vec2>): void {
  for (const p of world.players) {
    if (!p.onPitch || p.red) continue
    const target = targets.get(p.id) ?? p.pos
    const toTarget = sub(target, p.pos)
    const d = len(toTarget)
    const ms = maxSpeed(p)

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

    p.pos.x = clamp(p.pos.x + p.vel.x * TICK_DT, -(PITCH.HALF_W + 2), PITCH.HALF_W + 2)
    p.pos.y = clamp(p.pos.y + p.vel.y * TICK_DT, -(PITCH.HALF_L + 3), PITCH.HALF_L + 3)

    // stamina drain proportional to effort
    const effort = len(p.vel) / Math.max(ms, 0.1)
    p.stamina = clamp(p.stamina - (0.004 + 0.012 * effort * effort), 5, 100)
    if (p.kickCd > 0) p.kickCd--
  }
}
