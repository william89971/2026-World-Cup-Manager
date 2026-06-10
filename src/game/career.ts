import { TEAMS } from '../data'
import { TEAM_META } from '../data/teamMeta'
import type { MatchResult } from '../engine/types'
import { clamp } from '../engine/util'

export interface PlayerCareer {
  id: string
  teamId: string
  morale: number // 0..100
  fitness: number // 0..100 (recovers between matches)
  injuredMatches: number // upcoming matches missed through injury
  suspendedMatches: number // upcoming matches missed through suspension
  yellowAccrued: number // toward a 2-yellow ban
  goals: number
  assists: number
  saves: number // GK saves across the tournament
  yellows: number // total yellow cards across the tournament
  apps: number
  minutes: number
  lastRating: number | null
  avgRating: number
  ratedMatches: number
  /** Last 3 appearances: rating + who it came against (most recent last). */
  recentRatings: { rating: number; oppId: string }[]
  /** Human-readable driver of the latest morale change (player card). */
  moraleNote: string | null
}

export type Form = 'up' | 'flat' | 'down' | null

/** Average of the last 3 match ratings, or null with no appearances. */
export function formRating(c: PlayerCareer | undefined): number | null {
  if (!c || c.recentRatings.length === 0) return null
  return c.recentRatings.reduce((s, r) => s + r.rating, 0) / c.recentRatings.length
}

/** Form arrow bucket: ↑ ≥7.2, → 6.2–7.2, ↓ below. */
export function formOf(c: PlayerCareer | undefined): Form {
  const f = formRating(c)
  if (f === null) return null
  return f >= 7.2 ? 'up' : f >= 6.2 ? 'flat' : 'down'
}

/** Attribute multiplier the engine applies on top of base attributes (±5%). */
export function formModifier(c: PlayerCareer | undefined): number {
  const f = formRating(c)
  if (f === null) return 1
  return clamp(1 + (f - 6.6) * 0.018, 0.95, 1.05)
}

export type CareerState = Record<string, PlayerCareer>

export interface NewsItem {
  id: string
  kind: 'injury' | 'suspension' | 'result' | 'morale' | 'milestone'
  text: string
}

/** Build initial career records for every player of every team. */
export function initCareer(): CareerState {
  const out: CareerState = {}
  for (const team of Object.values(TEAMS)) {
    const homeBoost = TEAM_META[team.id].homeMoraleModifier
    for (const p of team.squad) {
      out[p.id] = {
        id: p.id,
        teamId: team.id,
        morale: clamp(68 + homeBoost + (p.overall - 75) * 0.2, 40, 92),
        fitness: 100,
        injuredMatches: 0,
        suspendedMatches: 0,
        yellowAccrued: 0,
        goals: 0,
        assists: 0,
        saves: 0,
        yellows: 0,
        apps: 0,
        minutes: 0,
        lastRating: null,
        avgRating: 0,
        ratedMatches: 0,
        recentRatings: [],
        moraleNote: null,
      }
    }
  }
  return out
}

export function isAvailable(career: CareerState, playerId: string): boolean {
  const c = career[playerId]
  return !c || (c.injuredMatches <= 0 && c.suspendedMatches <= 0)
}

export function availablePlayers(career: CareerState, teamId: string): string[] {
  return TEAMS[teamId].squad.filter((p) => isAvailable(career, p.id)).map((p) => p.id)
}

let newsSeq = 0
const news = (kind: NewsItem['kind'], text: string): NewsItem => ({ id: `n${newsSeq++}`, kind, text })

/**
 * Apply a finished match to the career state: ratings, goals/morale, injuries,
 * suspensions. `squadIds` (when provided, e.g. the player's selected squad)
 * lets unused subs take a small morale dip. Returns generated news items.
 */
export function applyMatchResult(
  career: CareerState,
  result: MatchResult,
  rng: () => number,
  _opts: { knockout?: boolean } = {},
): NewsItem[] {
  const items: NewsItem[] = []
  const { homeId, awayId, homeScore, awayScore } = result
  const homeWin = homeScore > awayScore
  const draw = homeScore === awayScore

  // who was unavailable BEFORE this match (so unused-sub penalties skip them)
  const unavailableBefore = new Set<string>()
  for (const teamId of [homeId, awayId])
    for (const p of TEAMS[teamId].squad) {
      const c = career[p.id]
      if (c && (c.injuredMatches > 0 || c.suspendedMatches > 0)) unavailableBefore.add(p.id)
    }

  const sideOutcome = (teamId: string, won: boolean, drew: boolean) => {
    for (const p of TEAMS[teamId].squad) {
      const c = career[p.id]
      if (!c) continue
      c.morale = clamp(c.morale + (won ? 5 : drew ? 1 : -4), 0, 100)
      // serve one match of any pending ban/injury (they missed this game)
      if (c.suspendedMatches > 0) c.suspendedMatches--
      else if (c.injuredMatches > 0) c.injuredMatches--
    }
  }
  sideOutcome(homeId, homeWin, draw)
  sideOutcome(awayId, !homeWin && !draw, draw)

  const applyRatings = (teamId: string, ratings: MatchResult['ratings']['home'], oppId: string) => {
    const appeared = new Set<string>()
    for (const r of ratings) {
      const c = career[r.id]
      if (!c) continue
      appeared.add(r.id)
      c.apps++
      c.minutes += r.minutes
      c.lastRating = r.rating
      c.ratedMatches++
      c.avgRating = (c.avgRating * (c.ratedMatches - 1) + r.rating) / c.ratedMatches
      c.recentRatings = [...c.recentRatings, { rating: r.rating, oppId }].slice(-3)
      c.fitness = clamp(c.fitness - r.minutes * 0.4, 30, 100)
      c.goals += r.goals
      c.assists += r.assists
      c.saves += r.saves
      c.yellows += r.yellow
      c.morale = clamp(c.morale + r.goals * 6 + r.assists * 3 + (r.rating > 7.5 ? 3 : r.rating < 5.5 ? -3 : 0), 0, 100)
      c.moraleNote =
        r.goals >= 2
          ? 'Scored multiple goals last match'
          : r.goals === 1
            ? 'Scored last match'
            : r.rating > 7.5
              ? 'Starred in the last match'
              : r.rating < 5.5
                ? 'Poor showing last match'
                : 'Got minutes last match'

      // yellow / red → suspension
      if (r.red) {
        c.suspendedMatches = Math.max(c.suspendedMatches, 1)
        c.yellowAccrued = 0
        items.push(news('suspension', `${r.name} (${TEAMS[teamId].name}) is suspended after a red card.`))
      } else if (r.yellow > 0) {
        c.yellowAccrued += r.yellow
        if (c.yellowAccrued >= 2) {
          c.suspendedMatches = Math.max(c.suspendedMatches, 1)
          c.yellowAccrued = 0
          items.push(news('suspension', `${r.name} (${TEAMS[teamId].name}) misses the next match — two yellow cards.`))
        }
      }

      // injury chance, weighted by (inverse) physicality
      const phys = TEAMS[teamId].squad.find((p) => p.id === r.id)?.attributes.physicality ?? 75
      if (rng() < 0.035 * (1.4 - phys / 130)) {
        c.injuredMatches = rng() < 0.4 ? 2 : 1
        c.morale = clamp(c.morale - 8, 0, 100)
        c.moraleNote = 'Picked up an injury'
        items.push(news('injury', `${r.name} (${TEAMS[teamId].name}) picked up an injury and is out for ${c.injuredMatches} match${c.injuredMatches > 1 ? 'es' : ''}.`))
      }
    }

    // players who didn't get on: recover fitness; available unused subs take a
    // small morale dip (injured/suspended players are exempt — they weren't snubbed)
    for (const p of TEAMS[teamId].squad) {
      const c = career[p.id]
      if (!c || appeared.has(p.id)) continue
      c.fitness = clamp(c.fitness + 12, 0, 100)
      if (!unavailableBefore.has(p.id)) {
        c.morale = clamp(c.morale - 1, 0, 100)
        c.moraleNote = 'Unused sub'
      } else {
        c.moraleNote = c.injuredMatches > 0 ? 'Recovering from injury' : c.suspendedMatches > 0 ? 'Serving a suspension' : c.moraleNote
      }
    }
  }
  applyRatings(homeId, result.ratings.home, awayId)
  applyRatings(awayId, result.ratings.away, homeId)

  return items
}

export function topScorers(career: CareerState, limit = 10) {
  return Object.values(career)
    .filter((c) => c.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, limit)
}
