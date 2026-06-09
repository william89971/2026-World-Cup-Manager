import type { Player, Position, TacticalRole, Team } from '../data/types'
import { getFormation } from './formations'

// How well a player's natural position fits a formation slot's tactical role.
const FIT: Record<TacticalRole, Partial<Record<Position, number>>> = {
  GK: { GK: 30 },
  CB: { CB: 16, RB: 6, LB: 6 },
  FB: { RB: 16, LB: 16, RWB: 16, LWB: 16, CB: 7, RM: 5, LM: 5 },
  CDM: { CDM: 16, CM: 11, CB: 5 },
  CM: { CM: 16, CDM: 11, CAM: 11 },
  CAM: { CAM: 16, CM: 10, RW: 6, LW: 6, ST: 5 },
  WM: { RM: 16, LM: 16, RW: 13, LW: 13, CM: 5 },
  Wing: { RW: 16, LW: 16, RM: 13, LM: 13, CF: 6, ST: 5 },
  ST: { ST: 16, CF: 16, CAM: 6, RW: 5, LW: 5 },
}

function fitness(p: Player, role: TacticalRole): number {
  return p.overall + (FIT[role][p.position] ?? -8)
}

export interface AutoLineup {
  formationName: string
  starters: string[]
  bench: string[]
}

/** Greedily pick the best XI for a formation, then a sensible 7-man bench. */
export function pickBestXI(team: Team, formationName = '4-3-3'): AutoLineup {
  const slots = getFormation(formationName).slots
  const pool = [...team.squad]
  const used = new Set<string>()
  const starters: string[] = []

  for (const slot of slots) {
    let best: Player | undefined
    let bestScore = -Infinity
    for (const p of pool) {
      if (used.has(p.id)) continue
      const s = fitness(p, slot.role)
      if (s > bestScore) {
        bestScore = s
        best = p
      }
    }
    if (best) {
      used.add(best.id)
      starters.push(best.id)
    }
  }

  // bench: a backup keeper + the next-best outfielders
  const remaining = pool.filter((p) => !used.has(p.id))
  const backupGk = remaining.find((p) => p.position === 'GK')
  const others = remaining
    .filter((p) => p.id !== backupGk?.id)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, backupGk ? 6 : 7)
  const bench = [...(backupGk ? [backupGk.id] : []), ...others.map((p) => p.id)]

  return { formationName, starters, bench }
}

/** Pick a default formation that suits the squad's strengths (simple heuristic). */
export function suggestFormation(team: Team): string {
  const fwd = team.squad.filter((p) => p.group === 'FWD').length
  if (fwd >= 8) return '4-4-2'
  return '4-3-3'
}
