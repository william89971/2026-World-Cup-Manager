import type { Mentality, Player, Position, Pressing, TacticalRole, Tactics, Team } from '../data/types'
import type { MatchSetup, SimTeamSetup } from './types'
import { pickBestXI, suggestFormation, type AutoLineup } from './lineup'
import { clamp } from './util'

const POS_ROLE: Record<Position, TacticalRole> = {
  GK: 'GK', CB: 'CB',
  RB: 'FB', LB: 'FB', RWB: 'FB', LWB: 'FB',
  CDM: 'CDM', CM: 'CM', CAM: 'CAM',
  RM: 'WM', LM: 'WM', RW: 'Wing', LW: 'Wing',
  ST: 'ST', CF: 'ST',
}

export interface SimTeamOptions {
  /** Effective strength multiplier applied to attributes (difficulty/morale). */
  strength?: number
  mentality?: Mentality
  pressing?: Pressing
  setPieceTakers?: { corners: string; freeKicks: string; penalties: string }
  /** Per-player attribute multiplier from current form (id → ~0.95..1.05). */
  formModifiers?: Record<string, number>
}

function scaledAttrs(p: Player, strength: number) {
  if (strength === 1) return { ...p.attributes }
  const s = (n: number) => clamp(Math.round(n * strength), 1, 99)
  return {
    pace: s(p.attributes.pace),
    shooting: s(p.attributes.shooting),
    passing: s(p.attributes.passing),
    dribbling: s(p.attributes.dribbling),
    defending: s(p.attributes.defending),
    physicality: s(p.attributes.physicality),
  }
}

/** Build the engine-facing team setup from a data Team + lineup. */
export function toSimTeam(
  team: Team,
  lineup: { formationName: string; starters: string[] },
  opts: SimTeamOptions = {},
): SimTeamSetup {
  const strength = opts.strength ?? 1
  const players: SimTeamSetup['players'] = {}
  for (const p of team.squad) {
    const form = opts.formModifiers?.[p.id] ?? 1
    const eff = strength * form
    players[p.id] = {
      id: p.id,
      name: p.name,
      number: p.number,
      role: POS_ROLE[p.position],
      attrs: scaledAttrs(p, eff),
      overall: clamp(Math.round(p.overall * eff), 1, 99),
    }
  }
  return {
    teamId: team.id,
    name: team.name,
    flag: team.flag,
    kit: team.kit,
    formationName: lineup.formationName,
    mentality: opts.mentality ?? 'balanced',
    pressing: opts.pressing ?? 'medium',
    starters: lineup.starters.slice(0, 11),
    players,
    strength,
    setPieceTakers: opts.setPieceTakers,
  }
}

/** Build a SimTeamSetup from an explicit manager Tactics object. */
export function toSimTeamFromTactics(team: Team, tactics: Tactics, opts: SimTeamOptions = {}): SimTeamSetup {
  return toSimTeam(team, { formationName: tactics.formationName, starters: tactics.starters }, {
    ...opts,
    mentality: tactics.mentality,
    pressing: tactics.pressing,
    setPieceTakers: { ...tactics.setPieces },
  })
}

/** Auto-pick a sensible lineup for an AI team. */
export function autoLineup(team: Team): AutoLineup {
  return pickBestXI(team, suggestFormation(team))
}

export interface BuildSetupOptions {
  knockout?: boolean
  seed?: number
  homeStrength?: number
  awayStrength?: number
  homeMentality?: Mentality
  awayMentality?: Mentality
  homeFormModifiers?: Record<string, number>
  awayFormModifiers?: Record<string, number>
}

/** Both sides auto-picked — used for AI-vs-AI instant simulation. */
export function buildAutoSetup(home: Team, away: Team, opts: BuildSetupOptions = {}): MatchSetup {
  return {
    home: toSimTeam(home, autoLineup(home), { strength: opts.homeStrength, mentality: opts.homeMentality, formModifiers: opts.homeFormModifiers }),
    away: toSimTeam(away, autoLineup(away), { strength: opts.awayStrength, mentality: opts.awayMentality, formModifiers: opts.awayFormModifiers }),
    knockout: opts.knockout,
    seed: opts.seed,
  }
}
