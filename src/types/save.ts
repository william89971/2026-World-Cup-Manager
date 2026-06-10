// Versioned localStorage save schema. Bump SAVE_VERSION whenever the shape of
// SavedGame (or anything nested in it) changes — loaders treat any other
// version as a mismatch and offer a graceful clear instead of crashing.
import type { Difficulty, Tactics } from '../data/types'
import type { TournamentState } from '../game/tournament'
import type { CareerState, NewsItem } from '../game/career'

export const SAVE_VERSION = 2 // v2: PlayerCareer gained minutes/moraleNote, recentRatings carry opposition

export const SAVE_KEY = 'wcm2026.save'

/** Everything needed to resume a campaign exactly where it left off. */
export interface SavedGame {
  userTeamId: string
  difficulty: Difficulty
  /** Full tournament state: fixtures (= match history), tables, bracket. */
  tournament: TournamentState
  /** Morale, fitness, injuries, suspensions, form ratings, leaderboard stats. */
  career: CareerState
  tactics: Tactics | null
  reputation: number
  news: NewsItem[]
  eliminated: boolean
  trainingFocus: 'finishing' | 'setpieces' | 'pressing' | 'rest' | null
}

export interface SaveData {
  version: number
  savedAt: string // ISO timestamp
  state: SavedGame
}

/** Summary shown on the main menu's Continue button. */
export interface SaveSummary {
  teamId: string
  flag: string
  teamName: string
  roundLabel: string
  record: { won: number; drawn: number; lost: number }
  savedAt: string
}

export type LoadResult =
  | { kind: 'none' }
  | { kind: 'ok'; data: SaveData }
  | { kind: 'version-mismatch'; foundVersion: number }
  | { kind: 'corrupt' }
