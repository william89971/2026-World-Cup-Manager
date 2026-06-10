// Simplified 2026 tournament calendar used for the hub countdown.
import type { RoundId } from './draw2026'

export interface MatchdaySlot {
  /** Display date, e.g. "Jun 18". */
  date: string
  /** Days of preparation before the match (drives the countdown copy). */
  prepDays: number
}

const GROUP_DATES: Record<number, MatchdaySlot> = {
  1: { date: 'Jun 11', prepDays: 3 },
  2: { date: 'Jun 18', prepDays: 4 },
  3: { date: 'Jun 24', prepDays: 3 },
}

const KO_DATES: Partial<Record<RoundId, MatchdaySlot>> = {
  R32: { date: 'Jun 29', prepDays: 3 },
  R16: { date: 'Jul 4', prepDays: 3 },
  QF: { date: 'Jul 9', prepDays: 4 },
  SF: { date: 'Jul 14', prepDays: 4 },
  TPP: { date: 'Jul 18', prepDays: 3 },
  FINAL: { date: 'Jul 19', prepDays: 4 },
}

export function matchdaySlot(round: RoundId, matchday?: number): MatchdaySlot {
  if (round === 'GROUP') return GROUP_DATES[matchday ?? 1] ?? GROUP_DATES[1]
  return KO_DATES[round] ?? { date: 'TBD', prepDays: 3 }
}
