import type { Vec2 } from './types'

export const v = (x: number, y: number): Vec2 => ({ x, y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}
export function norm(a: Vec2): Vec2 {
  const l = Math.hypot(a.x, a.y)
  return l < 1e-6 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}
export function clampVecToSpeed(a: Vec2, max: number): Vec2 {
  const l = Math.hypot(a.x, a.y)
  return l <= max ? a : { x: (a.x / l) * max, y: (a.y / l) * max }
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Mulberry32 — small deterministic PRNG so matches are reproducible by seed. */
export function makeRng(seed: number) {
  let s = seed >>> 0
  return function next(): number {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller-ish gaussian from a uniform rng. */
export function gauss(rng: () => number, mean = 0, sd = 1): number {
  const u = Math.max(1e-9, rng())
  const w = rng()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w)
}
