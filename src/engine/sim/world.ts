import { getFormation } from '../formations'
import { PITCH } from '../constants'
import type { MatchSetup, Side, SimPlayer, Vec2, WorldState } from '../types'
import { v } from '../util'

/** Convert a normalised formation slot to metres, oriented to the side's attack.
 *  Home attacks +Y (goal at −Y); away is rotated 180°. */
export function orientAnchor(nx: number, ny: number, side: Side): Vec2 {
  const x = nx * PITCH.HALF_W * 0.95
  const y = ny * PITCH.HALF_L * 0.95
  return side === 'home' ? v(x, y) : v(-x, -y)
}

/** Y coordinate of a side's OWN goal line. */
export const ownGoalY = (side: Side): number => (side === 'home' ? -PITCH.HALF_L : PITCH.HALF_L)
/** Y coordinate of the goal a side ATTACKS. */
export const targetGoalY = (side: Side): number => (side === 'home' ? PITCH.HALF_L : -PITCH.HALF_L)
export const attackDir = (side: Side): number => (side === 'home' ? 1 : -1)
export const other = (side: Side): Side => (side === 'home' ? 'away' : 'home')

export function createWorld(setup: MatchSetup, kickoffSide: Side = 'home'): WorldState {
  const players: SimPlayer[] = []

  for (const side of ['home', 'away'] as Side[]) {
    const team = side === 'home' ? setup.home : setup.away
    const formation = getFormation(team.formationName)
    team.starters.slice(0, 11).forEach((id, i) => {
      const rec = team.players[id]
      const slot = formation.slots[i] ?? formation.slots[formation.slots.length - 1]
      const anchor = orientAnchor(slot.x, slot.y, side)
      players.push({
        id,
        side,
        name: rec?.name ?? id,
        number: rec?.number ?? i + 1,
        role: slot.role,
        anchor,
        pos: { ...anchor },
        vel: v(0, 0),
        attrs: rec?.attrs ?? { pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physicality: 70 },
        overall: rec?.overall ?? 70,
        stamina: 100,
        onPitch: true,
        yellow: 0,
        red: false,
        ratingPoints: 0,
        goals: 0,
        assists: 0,
        saves: 0,
        joinedSec: 0,
        offSec: null,
        kickCd: 0,
      })
    })
  }

  // Ball to a central player of the kickoff side.
  const kickoffTeam = players.filter((p) => p.side === kickoffSide)
  const taker =
    kickoffTeam.find((p) => p.role === 'ST' || p.role === 'CAM') ?? kickoffTeam[10] ?? kickoffTeam[0]
  taker.pos = v(0, 0)

  return {
    tick: 0,
    timeSec: 0,
    half: 1,
    added: 0,
    score: { home: 0, away: 0 },
    players,
    ball: {
      pos: v(0, 0),
      vel: v(0, 0),
      z: 0,
      vz: 0,
      ownerId: taker.id,
      lastTouch: kickoffSide,
      lastPasserId: null,
    },
    phase: 'kickoff',
    restart: null,
    celebrateUntil: 0,
    stats: {
      shots: { home: 0, away: 0 },
      onTarget: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      passesAttempted: { home: 0, away: 0 },
      passesCompleted: { home: 0, away: 0 },
      yellows: { home: 0, away: 0 },
      reds: { home: 0, away: 0 },
      possessionTicks: { home: 0, away: 0 },
    },
    finished: false,
  }
}

export const onPitch = (world: WorldState, side?: Side): SimPlayer[] =>
  world.players.filter((p) => p.onPitch && !p.red && (side ? p.side === side : true))

export function byId(world: WorldState, id: string | null | undefined): SimPlayer | undefined {
  if (!id) return undefined
  return world.players.find((p) => p.id === id)
}

export function nearestPlayer(world: WorldState, point: Vec2, side?: Side): SimPlayer | undefined {
  let best: SimPlayer | undefined
  let bestD = Infinity
  for (const p of onPitch(world, side)) {
    const d = (p.pos.x - point.x) ** 2 + (p.pos.y - point.y) ** 2
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

export function possessionSide(world: WorldState): Side | null {
  const owner = byId(world, world.ball.ownerId)
  return owner ? owner.side : null
}
