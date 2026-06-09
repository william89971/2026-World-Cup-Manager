import type { Attributes, Player, Position, PositionGroup } from './types'
import type { RawPlayer } from './squads/_type'

// ─────────────────────────────────────────────────────────────────────────
// Deterministically expand a research-sourced RawPlayer into a full Player.
// Per-attribute values are derived from position archetype + overall + a small
// seeded jitter, so a striker reads pacey/clinical and a CB reads strong/poor
// on the ball — without researchers hand-filling 6 numbers per player.
// ─────────────────────────────────────────────────────────────────────────

/** Cheap deterministic string hash → 32-bit int. */
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic jitter in [-spread, +spread] keyed by (seed, axis). */
function jitter(seed: number, axis: number, spread: number): number {
  const v = ((seed ^ Math.imul(axis + 1, 2654435761)) >>> 0) / 0xffffffff
  return Math.round((v * 2 - 1) * spread)
}

const GROUP_OF: Record<Position, PositionGroup> = {
  GK: 'GK',
  RB: 'DEF', RWB: 'DEF', CB: 'DEF', LB: 'DEF', LWB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', RM: 'MID', LM: 'MID',
  RW: 'FWD', LW: 'FWD', ST: 'FWD', CF: 'FWD',
}

// Offsets relative to `overall`, order: [pace, shooting, passing, dribbling, defending, physicality]
type Offsets = [number, number, number, number, number, number]

const ARCHETYPE: Record<Position, Offsets> = {
  GK: [-20, -28, -4, -16, 5, 1], // `defending` axis doubles as goalkeeping
  CB: [-7, -24, -4, -13, 11, 9],
  RB: [6, -11, 1, 1, 4, -1], LB: [6, -11, 1, 1, 4, -1],
  RWB: [8, -8, 2, 3, 1, -2], LWB: [8, -8, 2, 3, 1, -2],
  CDM: [-3, -7, 3, -3, 9, 7],
  CM: [-1, -1, 6, 2, 1, 1],
  CAM: [0, 3, 7, 7, -10, -4],
  RM: [6, -2, 3, 5, -6, -3], LM: [6, -2, 3, 5, -6, -3],
  RW: [9, 1, 0, 7, -14, -5], LW: [9, 1, 0, 7, -14, -5],
  ST: [4, 7, -3, 2, -18, 3],
  CF: [2, 6, 2, 5, -14, 0],
}

function clamp(n: number, lo = 30, hi = 99): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export function buildAttributes(p: RawPlayer): Attributes {
  const seed = hash(`${p.name}#${p.number}#${p.position}`)
  const off = ARCHETYPE[p.position]
  const axes = off.map((o, i) => {
    const lo = p.position === 'GK' && (i === 0 || i === 1) ? 18 : 36
    return clamp(p.overall + o + jitter(seed, i, 3), lo)
  })
  return {
    pace: axes[0],
    shooting: axes[1],
    passing: axes[2],
    dribbling: axes[3],
    defending: axes[4],
    physicality: axes[5],
  }
}

export function buildPlayer(teamId: string, p: RawPlayer): Player {
  return {
    id: `${teamId}_${p.number}`,
    name: p.name,
    number: p.number,
    position: p.position,
    group: GROUP_OF[p.position],
    age: p.age,
    overall: p.overall,
    attributes: buildAttributes(p),
    star: p.star,
  }
}

/** Team overall = mean of the 16 highest player overalls (squad depth aware). */
export function teamOverall(players: Player[]): number {
  const top = [...players].sort((a, b) => b.overall - a.overall).slice(0, 16)
  return Math.round(top.reduce((s, p) => s + p.overall, 0) / top.length)
}
