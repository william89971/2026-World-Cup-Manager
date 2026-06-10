import type { Attributes, Mentality, Pressing, TacticalRole } from '../data/types'
import type { Archetype } from '../data/archetypes'

export interface Vec2 {
  x: number
  y: number
}

export type Side = 'home' | 'away'

export interface SimPlayer {
  id: string
  side: Side
  name: string
  number: number
  role: TacticalRole
  /** Personality archetype derived from the dominant attribute. */
  archetype: Archetype
  /** Authored formation anchor in metres, oriented to this side's attack. */
  anchor: Vec2
  pos: Vec2
  vel: Vec2
  attrs: Attributes
  overall: number
  /** 0–100; drains over the match, scaled by pressing + pace. */
  stamina: number
  /** Whether currently on the pitch (false once subbed off). */
  onPitch: boolean
  yellow: number
  red: boolean
  /** Accumulated 1–10 performance rating components. */
  ratingPoints: number
  goals: number
  assists: number
  /** Keeper saves made this match. */
  saves: number
  /** Match-second this player entered the pitch (0 for starters). */
  joinedSec: number
  /** Match-second this player left the pitch (null while still on). */
  offSec: number | null
  /** Cooldown ticks before this player can kick again (after a pass/shot). */
  kickCd: number
}

export interface BallState {
  pos: Vec2
  vel: Vec2
  z: number
  vz: number
  /** Player id currently in possession, or null if loose / in flight. */
  ownerId: string | null
  /** Side of the last player to touch the ball. */
  lastTouch: Side | null
  /** Player id who last played the ball (for assist tracking). */
  lastPasserId: string | null
  /** When the ball is a shot in flight, how it should resolve. */
  shotOutcome?: 'goal' | 'save' | 'off' | null
  shooterId?: string | null
  /** True while a pass/shot is travelling (not yet controlled). */
  inFlight?: boolean
  /** Destination point of the in-flight pass and its intended receiver. */
  passTarget?: Vec2 | null
  targetReceiverId?: string | null
  /** Ticks the ball has sat loose and near-stationary (stuck-ball watchdog). */
  idleTicks?: number
}

export type Phase =
  | 'kickoff'
  | 'open'
  | 'goalkick'
  | 'corner'
  | 'throwin'
  | 'freekick'
  | 'penalty'
  | 'celebrate'
  | 'halftime'
  | 'shootout' // frozen, awaiting interactive penalty shootout resolution
  | 'fulltime'

export interface Restart {
  type: Exclude<Phase, 'open' | 'celebrate' | 'halftime' | 'shootout' | 'fulltime'>
  side: Side // team taking the restart
  pos: Vec2
  /** ticks remaining before play auto-resumes. */
  delay: number
}

/** Counter-attack window opened when possession switches in open play. */
export interface Transition {
  /** The side that just won the ball. */
  side: Side
  untilTick: number
  /** True when 2+ attackers were ahead of the ball at the turnover. */
  counter: boolean
}

export interface MatchStats {
  shots: { home: number; away: number }
  onTarget: { home: number; away: number }
  fouls: { home: number; away: number }
  corners: { home: number; away: number }
  passesAttempted: { home: number; away: number }
  passesCompleted: { home: number; away: number }
  yellows: { home: number; away: number }
  reds: { home: number; away: number }
  possessionTicks: { home: number; away: number }
}

export type MatchEventType =
  | 'kickoff'
  | 'goal'
  | 'shot'
  | 'save'
  | 'miss'
  | 'tackle'
  | 'interception'
  | 'foul'
  | 'yellow'
  | 'red'
  | 'corner'
  | 'throwin'
  | 'goalkick'
  | 'freekick'
  | 'penalty'
  | 'bigchance'
  | 'halftime'
  | 'fulltime'
  | 'sub'

export interface MatchEvent {
  tick: number
  timeSec: number
  type: MatchEventType
  side?: Side
  playerId?: string
  playerName?: string
  secondaryId?: string // e.g. assist / fouled player / sub-on
  secondaryName?: string
  pos?: Vec2
  /** Human-readable headline for banners / commentary. */
  text: string
  score?: { home: number; away: number }
}

export interface SimTeamSetup {
  teamId: string
  name: string
  flag: string
  kit: { primary: string; secondary: string; goalkeeper: string }
  formationName: string
  mentality: Mentality
  pressing: Pressing
  /** Ordered 11 starters (ids) matching formation slots; engine reads attrs from `players`. */
  starters: string[]
  /** Player records keyed by id for everyone in the matchday squad. */
  players: Record<
    string,
    { id: string; name: string; number: number; role: TacticalRole; attrs: Attributes; overall: number }
  >
  /** Effective strength multiplier (difficulty / morale applied upstream). */
  strength: number
  /** Designated set-piece takers (player ids); engine falls back to best-fit. */
  setPieceTakers?: { corners: string; freeKicks: string; penalties: string }
}

export interface MatchSetup {
  home: SimTeamSetup
  away: SimTeamSetup
  /** Knockout match → must resolve a winner (extra time / penalties). */
  knockout?: boolean
  seed?: number
}

export interface WorldState {
  tick: number
  timeSec: number
  half: 1 | 2
  added: number // stoppage seconds for current half
  score: { home: number; away: number }
  players: SimPlayer[]
  ball: BallState
  phase: Phase
  restart: Restart | null
  celebrateUntil: number
  /** Hidden momentum 0–100 per side (starts 50). Match-engine state only —
   *  never persisted outside the simulation. */
  momentum: { home: number; away: number }
  /** Active counter-attack / shape-reform window, if any. */
  transition: Transition | null
  /** Scorer of the most recent goal (drives celebrations). */
  lastScorerId: string | null
  stats: MatchStats
  finished: boolean
  /** Penalty shootout result, if used. */
  shootout?: { home: number; away: number }
}

/** One resolved penalty kick in a shootout. */
export interface PenaltyKickResult {
  takerId: string
  takerName: string
  side: Side
  scored: boolean
  outcome: 'goal' | 'save' | 'off'
  /** -1 left, 0 centre, 1 right (shooter's perspective). */
  shotDir: -1 | 0 | 1
  diveDir: -1 | 0 | 1
}

export interface PlayerMatchRating {
  id: string
  name: string
  rating: number // 1–10
  goals: number
  assists: number
  saves: number
  minutes: number
  yellow: number
  red: boolean
}

export interface MatchResult {
  homeId: string
  awayId: string
  homeScore: number
  awayScore: number
  shootout?: { home: number; away: number }
  events: MatchEvent[]
  stats: MatchStats
  ratings: { home: PlayerMatchRating[]; away: PlayerMatchRating[] }
  /** Winner team id for knockout, or null for a group draw. */
  winnerId: string | null
}
