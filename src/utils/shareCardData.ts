// Assembles share-card inputs from game state. No React, no canvas here —
// rendering lives in shareCard.ts, state shapes come from the store/engine.
import type { MatchResult } from '../engine/types'
import type { MatchCardInput, TournamentCardInput, CardPathStep } from '../types/share'
import type { TournamentState } from '../game/tournament'
import type { CareerState } from '../game/career'
import { getTeam } from '../data'
import { ROUND_LABEL, type RoundId } from '../data/draw2026'

const ROUND_ORDER: RoundId[] = ['GROUP', 'R32', 'R16', 'QF', 'SF', 'TPP', 'FINAL']

/** 1–5 performance stars from result + opposition strength. */
export function performanceStars(result: MatchResult, userTeamId: string): number {
  const userIsHome = result.homeId === userTeamId
  const us = userIsHome ? result.homeScore : result.awayScore
  const them = userIsHome ? result.awayScore : result.homeScore
  const oppId = userIsHome ? result.awayId : result.homeId
  const userOvr = getTeam(userTeamId).overall
  const oppOvr = getTeam(oppId).overall
  const wonShootout = result.shootout && result.winnerId === userTeamId

  let stars = us > them || wonShootout ? 3 : us === them ? 2 : 1
  const margin = us - them
  if (margin >= 3) stars++
  if (us > them && oppOvr >= userOvr + 2) stars++ // upset or beating a peer
  if (us < them && oppOvr <= userOvr - 4) stars-- // losing to a minnow
  if (margin <= -3) stars = 1
  return Math.max(1, Math.min(5, stars))
}

export function buildMatchCardInput(
  result: MatchResult,
  userTeamId: string,
  occasion: string,
): MatchCardInput {
  const home = getTeam(result.homeId)
  const away = getTeam(result.awayId)
  const user = getTeam(userTeamId)
  const scorers = result.events
    .filter((e) => e.type === 'goal' && e.playerName)
    .map((e) => ({
      name: e.playerName!,
      minute: Math.max(1, Math.ceil(e.timeSec / 60)),
      side: (e.side ?? 'home') as 'home' | 'away',
    }))
  return {
    home: { name: home.name, flag: home.flag, color: home.kit.primary },
    away: { name: away.name, flag: away.flag, color: away.kit.primary },
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    shootout: result.shootout,
    scorers,
    occasion,
    managerNation: user.name,
    managerFlag: user.flag,
    stars: performanceStars(result, userTeamId),
  }
}

/** The user's full path through the tournament, in playing order. */
export function buildTournamentCardInput(
  tournament: TournamentState,
  career: CareerState,
  userTeamId: string,
  champion: boolean,
): TournamentCardInput {
  const user = getTeam(userTeamId)
  const userFixtures = tournament.fixtures
    .filter((f) => f.played && f.result && (f.homeId === userTeamId || f.awayId === userTeamId))
    .sort(
      (a, b) =>
        ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round) ||
        (a.matchday ?? 0) - (b.matchday ?? 0),
    )

  const path: CardPathStep[] = []
  const record = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 }
  let lastRound: RoundId = 'GROUP'
  for (const f of userFixtures) {
    const r = f.result!
    const userIsHome = f.homeId === userTeamId
    const oppId = userIsHome ? f.awayId! : f.homeId!
    const opp = getTeam(oppId)
    const us = userIsHome ? r.homeScore : r.awayScore
    const them = userIsHome ? r.awayScore : r.homeScore
    const pens = r.shootout ? ` (${userIsHome ? r.shootout.home : r.shootout.away}-${userIsHome ? r.shootout.away : r.shootout.home}p)` : ''
    const won = r.winnerId === userTeamId || (!r.winnerId && us > them) || us > them
    const drawn = us === them && !r.shootout
    path.push({
      roundLabel: f.round === 'GROUP' ? `Group · MD${f.matchday}` : ROUND_LABEL[f.round],
      oppName: opp.name,
      oppFlag: opp.flag,
      score: `${us}-${them}${pens}`,
      won,
      drawn,
    })
    record.played++
    record.gf += us
    record.ga += them
    if (drawn) record.drawn++
    else if (won) record.won++
    else record.lost++
    lastRound = f.round
  }

  const headline = champion
    ? 'World Champions'
    : lastRound === 'GROUP'
      ? 'Out at the Group Stage'
      : `Run ends — ${ROUND_LABEL[lastRound]}`

  // top scorer from the user's squad
  let topScorer: TournamentCardInput['topScorer'] = null
  for (const p of user.squad) {
    const c = career[p.id]
    if (c && c.goals > 0 && (!topScorer || c.goals > topScorer.goals)) {
      topScorer = { name: p.name, goals: c.goals }
    }
  }

  return {
    nation: { name: user.name, flag: user.flag, color: user.kit.primary },
    champion,
    headline,
    path,
    record,
    topScorer,
  }
}
