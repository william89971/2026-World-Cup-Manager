// ─────────────────────────────────────────────────────────────────────────
// Core domain types — the foundation everything else depends on.
// Pure data definitions; no engine/render/UI imports.
// ─────────────────────────────────────────────────────────────────────────

/** Six FIFA-style attribute axes, each 1–99. */
export interface Attributes {
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physicality: number
}

/** Broad position groups used for formation slotting and AI roles. */
export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD'

/** Specific positions (used for scouting + tactics display). */
export type Position =
  | 'GK'
  | 'RB'
  | 'RWB'
  | 'CB'
  | 'LB'
  | 'LWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'RM'
  | 'LM'
  | 'RW'
  | 'LW'
  | 'ST'
  | 'CF'

export interface Player {
  id: string
  name: string
  /** Squad shirt number. */
  number: number
  position: Position
  group: PositionGroup
  age: number
  /** Derived overall rating 1–99. */
  overall: number
  attributes: Attributes
  /** True for a handful of marquee players (used for scouting key-players). */
  star?: boolean
}

export type PlayingStyle =
  | 'Possession'
  | 'Counter-Attack'
  | 'High-Press'
  | 'Direct'
  | 'Balanced'
  | 'Defensive'

export interface Team {
  /** FIFA 3-letter code, used as the stable id (e.g. 'ARG'). */
  id: string
  name: string
  /** Two-letter group id 'A'..'L'. */
  group: string
  /** FIFA/world ranking-ish seed used for draw + AI strength scaling. */
  seed: number
  overall: number
  style: PlayingStyle
  /** Home-nation morale modifier; hosts (USA/MEX/CAN) get a small boost. */
  homeMoraleModifier: number
  /** Primary + secondary kit colours (hex) for the 3D render layer. */
  kit: { primary: string; secondary: string; goalkeeper: string }
  /** Flag emoji for UI. */
  flag: string
  squad: Player[]
}

export interface Group {
  id: string // 'A'..'L'
  teamIds: string[] // 4 team ids
}

/** A 4-3-3 etc. described as a name + the set of 10 outfield slots. */
export interface FormationSlot {
  role: TacticalRole
  /** Normalised pitch coords for a team attacking +y. x:[-1,1] (left→right), y:[-1,1] (own goal→opp goal). */
  x: number
  y: number
}

export type TacticalRole =
  | 'GK'
  | 'CB'
  | 'FB' // full-back / wing-back
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'WM' // wide midfielder
  | 'Wing' // winger
  | 'ST'

export interface Formation {
  name: string // '4-3-3'
  slots: FormationSlot[] // GK first, then 10 outfield
}

export type Mentality = 'defensive' | 'balanced' | 'attacking'
export type Pressing = 'low' | 'medium' | 'high'
export type Difficulty = 'Amateur' | 'Professional' | 'World Class' | 'Legendary'

export interface SetPieceTakers {
  corners: string // player id
  freeKicks: string
  penalties: string
}

/** A manager's full tactical setup for a match. */
export interface Tactics {
  formationName: string
  /** Ordered list of 11 starter player ids matching the formation slots. */
  starters: string[]
  /** Up to 7 bench player ids (spec says 6 subs; allow a couple extra). */
  bench: string[]
  mentality: Mentality
  pressing: Pressing
  setPieces: SetPieceTakers
}
