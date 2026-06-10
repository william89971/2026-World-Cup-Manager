// Inputs for the Canvas-rendered share cards (1200×630 OG image size).

export interface CardTeam {
  name: string
  flag: string
  /** Primary kit hex colour, used as the accent. */
  color: string
}

export interface CardScorer {
  name: string
  minute: number
  /** Which side scored ('home' | 'away'). */
  side: 'home' | 'away'
}

export interface MatchCardInput {
  home: CardTeam
  away: CardTeam
  homeScore: number
  awayScore: number
  shootout?: { home: number; away: number }
  scorers: CardScorer[]
  /** e.g. "Group Stage · Matchday 2" or "Quarter-final" */
  occasion: string
  /** The user's nation name (manager identity line). */
  managerNation: string
  managerFlag: string
  /** 1–5 performance rating. */
  stars: number
}

export interface CardPathStep {
  roundLabel: string
  oppName: string
  oppFlag: string
  /** e.g. "3-1" or "1-1 (4-2p)" */
  score: string
  won: boolean
  drawn: boolean
}

export interface TournamentCardInput {
  nation: CardTeam
  champion: boolean
  /** Headline, e.g. "WORLD CHAMPIONS" or "Run ends in the Quarter-finals". */
  headline: string
  path: CardPathStep[]
  record: { played: number; won: number; drawn: number; lost: number; gf: number; ga: number }
  topScorer: { name: string; goals: number } | null
}
