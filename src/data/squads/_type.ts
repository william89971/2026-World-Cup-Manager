import type { Position } from '../types'

/**
 * Research-sourced raw player record. Attributes (pace/shooting/...) are
 * generated deterministically from `position` + `overall` by buildSquad(),
 * so researchers only need to supply these factual/scouted fields.
 */
export interface RawPlayer {
  name: string
  /** Squad shirt number (1–26). */
  number: number
  position: Position
  age: number
  /** FIFA-style overall rating 1–99 (see rubric in squads README). */
  overall: number
  /** Marquee player — surfaced in scouting "key players". */
  star?: boolean
}

export type RawSquad = RawPlayer[]
