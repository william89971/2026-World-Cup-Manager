import { create } from 'zustand'
import type { Difficulty, Tactics, Team } from '../data/types'
import { TEAMS, getTeam } from '../data'
import type { MatchResult, MatchSetup } from '../engine/types'
import { instantSim } from '../engine/instantSim'
import { toSimTeam, toSimTeamFromTactics } from '../engine/buildMatch'
import { pickBestXI, suggestFormation } from '../engine/lineup'
import { makeRng } from '../engine/util'
import {
  createTournament,
  currentFixtures,
  advanceStage,
  recordResult,
  isComplete,
  champion,
  type Fixture,
  type TournamentState,
} from '../game/tournament'
import { ROUND_LABEL } from '../data/draw2026'
import { aiStrength } from '../game/difficulty'
import {
  applyMatchResult,
  initCareer,
  availablePlayers,
  formModifier,
  type CareerState,
  type NewsItem,
} from '../game/career'
import type { GoalReplay } from '../match/replay'
import { writeSave, loadSave, clearSave } from '../game/saveGame'
import type { SavedGame } from '../types/save'

export type Screen = 'menu' | 'hub' | 'squad' | 'tactics' | 'prematch' | 'match' | 'postmatch' | 'groups' | 'bracket' | 'stats'

let rng = makeRng(20260611)

function defaultTactics(team: Team, available: string[]): Tactics {
  const avail = new Set(available)
  const filtered: Team = { ...team, squad: team.squad.filter((p) => avail.has(p.id)) }
  const xi = pickBestXI(filtered, suggestFormation(filtered))
  const takers = [...xi.starters].sort(
    (a, b) => getPlayer(team, b).attributes.shooting - getPlayer(team, a).attributes.shooting,
  )
  return {
    formationName: xi.formationName,
    starters: xi.starters,
    bench: xi.bench,
    mentality: 'balanced',
    pressing: 'medium',
    setPieces: { corners: takers[0], freeKicks: takers[0], penalties: takers[0] },
  }
}

function getPlayer(team: Team, id: string) {
  return team.squad.find((p) => p.id === id)!
}

/** Return `tactics` unchanged if valid for the current squad, else a freshly
 *  built default. Pure — never mutates state, safe to call during render. */
export function resolveValidTactics(tactics: Tactics | null, userTeamId: string, career: CareerState): Tactics {
  const avail = new Set(availablePlayers(career, userTeamId))
  const valid =
    tactics && tactics.starters.length === 11 && tactics.starters.every((id) => avail.has(id))
  return valid ? tactics! : defaultTactics(getTeam(userTeamId), [...avail])
}

function autoLineupAvailable(team: Team, career: CareerState) {
  const avail = new Set(availablePlayers(career, team.id))
  const filtered: Team = { ...team, squad: team.squad.filter((p) => avail.has(p.id)) }
  return pickBestXI(filtered, suggestFormation(filtered))
}

/** Per-player form multipliers for a team (engine applies on top of attrs). */
function formMods(career: CareerState, teamId: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of getTeam(teamId).squad) out[p.id] = formModifier(career[p.id])
  return out
}

interface GameState {
  screen: Screen
  started: boolean
  userTeamId: string
  difficulty: Difficulty
  tournament: TournamentState
  career: CareerState
  tactics: Tactics | null
  reputation: number // media reputation 0..100
  news: NewsItem[]
  lastResult: MatchResult | null
  lastResultFixtureId: string | null
  /** Goal replays captured during the user's last played match. */
  lastReplays: GoalReplay[]
  eliminated: boolean

  newGame: (teamId: string, difficulty: Difficulty) => void
  /** Resume the saved campaign. Returns false if no valid save exists. */
  continueGame: () => boolean
  /** Write the current campaign to the save slot. */
  saveNow: () => void
  /** Save and return to the main menu. */
  saveAndExit: () => void
  setScreen: (s: Screen) => void
  setTactics: (t: Tactics) => void
  ensureTactics: () => Tactics
  userFixture: () => Fixture | null
  buildUserMatchSetup: () => MatchSetup | null
  finishUserMatch: (result: MatchResult, replays?: GoalReplay[]) => void
  simRestOfTournament: () => void
  applyPress: (moraleDelta: number, reputationDelta: number) => void
}

/** Snapshot the persistable slice of the store. */
function toSavedGame(s: Pick<GameState, 'userTeamId' | 'difficulty' | 'tournament' | 'career' | 'tactics' | 'reputation' | 'news' | 'eliminated'>): SavedGame {
  return {
    userTeamId: s.userTeamId,
    difficulty: s.difficulty,
    tournament: s.tournament,
    career: s.career,
    tactics: s.tactics,
    reputation: s.reputation,
    news: s.news,
    eliminated: s.eliminated,
  }
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  started: false,
  userTeamId: 'ARG',
  difficulty: 'Professional',
  tournament: createTournament(),
  career: {},
  tactics: null,
  reputation: 55,
  news: [],
  lastResult: null,
  lastResultFixtureId: null,
  lastReplays: [],
  eliminated: false,

  newGame: (teamId, difficulty) => {
    rng = makeRng(20260611 ^ teamId.charCodeAt(0) * 131 ^ teamId.charCodeAt(2))
    const career = initCareer()
    const tournament = createTournament()
    const team = getTeam(teamId)
    const tactics = defaultTactics(team, availablePlayers(career, teamId))
    set({
      started: true,
      screen: 'hub',
      userTeamId: teamId,
      difficulty,
      tournament,
      career,
      tactics,
      reputation: 55,
      news: [{ id: 'start', kind: 'milestone', text: `${team.flag} ${team.name} begin their 2026 World Cup campaign.` }],
      lastResult: null,
      lastResultFixtureId: null,
      lastReplays: [],
      eliminated: false,
    })
    writeSave(toSavedGame(get()))
  },

  continueGame: () => {
    const r = loadSave()
    if (r.kind !== 'ok') return false
    const s = r.data.state
    // re-seed the session RNG the same way newGame does for this team
    rng = makeRng(20260611 ^ s.userTeamId.charCodeAt(0) * 131 ^ s.userTeamId.charCodeAt(2))
    set({
      started: true,
      screen: 'hub',
      userTeamId: s.userTeamId,
      difficulty: s.difficulty,
      tournament: s.tournament,
      career: s.career,
      tactics: s.tactics,
      reputation: s.reputation,
      news: s.news,
      eliminated: s.eliminated,
      lastResult: null,
      lastResultFixtureId: null,
      lastReplays: [],
    })
    return true
  },

  saveNow: () => {
    writeSave(toSavedGame(get()))
  },

  saveAndExit: () => {
    writeSave(toSavedGame(get()))
    set({ screen: 'menu', started: false })
  },

  setScreen: (s) => set({ screen: s }),
  setTactics: (t) => set({ tactics: t }),

  ensureTactics: () => {
    const { tactics, userTeamId, career } = get()
    const resolved = resolveValidTactics(tactics, userTeamId, career)
    if (resolved !== tactics) set({ tactics: resolved })
    return resolved
  },

  userFixture: () => {
    const { tournament, userTeamId } = get()
    return (
      currentFixtures(tournament).find(
        (f) => !f.played && (f.homeId === userTeamId || f.awayId === userTeamId),
      ) ?? null
    )
  },

  buildUserMatchSetup: () => {
    const { userTeamId, difficulty, career, tournament } = get()
    const fixture = get().userFixture()
    if (!fixture || !fixture.homeId || !fixture.awayId) return null
    const tactics = get().ensureTactics()
    const knockout = tournament.stage !== 'GROUP'
    const homeTeam = getTeam(fixture.homeId)
    const awayTeam = getTeam(fixture.awayId)
    const userIsHome = fixture.homeId === userTeamId
    const aiS = aiStrength(difficulty)

    const home =
      fixture.homeId === userTeamId
        ? toSimTeamFromTactics(homeTeam, tactics, { strength: 1, formModifiers: formMods(career, homeTeam.id) })
        : toSimTeam(homeTeam, autoLineupAvailable(homeTeam, career), { strength: aiS, formModifiers: formMods(career, homeTeam.id) })
    const away =
      fixture.awayId === userTeamId
        ? toSimTeamFromTactics(awayTeam, tactics, { strength: 1, formModifiers: formMods(career, awayTeam.id) })
        : toSimTeam(awayTeam, autoLineupAvailable(awayTeam, career), { strength: aiS, formModifiers: formMods(career, awayTeam.id) })

    void userIsHome
    return { home, away, knockout, seed: (rng() * 1e9) | 0 }
  },

  finishUserMatch: (result, replays = []) => {
    const state = get()
    const tournament: TournamentState = structuredCloneState(state.tournament)
    const career = state.career
    const fixture = state.userFixture()
    if (!fixture) return

    const news: NewsItem[] = []
    // record the user's match
    recordResult(tournament, fixture.id, toFixtureResult(result, fixture))
    news.push(...applyMatchResult(career, result, rng, { knockout: tournament.stage !== 'GROUP' }))
    news.unshift(resultNews(result, fixture))

    // simulate the rest of the current stage (AI vs AI), instantly
    for (const f of currentFixtures(tournament)) {
      if (f.played || !f.homeId || !f.awayId) continue
      const r = instantSim(getTeam(f.homeId), getTeam(f.awayId), {
        knockout: tournament.stage !== 'GROUP',
        seed: (rng() * 1e9) | 0,
        homeFormModifiers: formMods(career, f.homeId),
        awayFormModifiers: formMods(career, f.awayId),
      })
      recordResult(tournament, f.id, toFixtureResult(r, f))
      applyMatchResult(career, r, rng, { knockout: tournament.stage !== 'GROUP' })
      news.push(resultNews(r, f))
    }

    // advance through any stages where the user has no fixture left
    while (advanceStage(tournament)) {
      const stillIn =
        currentFixtures(tournament).some((f) => f.homeId === state.userTeamId || f.awayId === state.userTeamId)
      if (stillIn || tournament.stage === 'GROUP') break
      if (isComplete(tournament)) break
      // sim a stage the user isn't part of (e.g. third-place playoff)
      for (const f of currentFixtures(tournament)) {
        if (f.played || !f.homeId || !f.awayId) continue
        const r = instantSim(getTeam(f.homeId), getTeam(f.awayId), {
          knockout: true,
          seed: (rng() * 1e9) | 0,
          homeFormModifiers: formMods(career, f.homeId),
          awayFormModifiers: formMods(career, f.awayId),
        })
        recordResult(tournament, f.id, toFixtureResult(r, f))
        applyMatchResult(career, r, rng, { knockout: true })
        news.push(resultNews(r, f))
      }
    }

    const eliminated =
      tournament.stage !== 'GROUP' &&
      !currentFixtures(tournament).some((f) => f.homeId === state.userTeamId || f.awayId === state.userTeamId) &&
      !isComplete(tournament) &&
      !inFutureBracket(tournament, state.userTeamId)

    set({
      tournament,
      career: { ...career },
      news: [...news, ...state.news].slice(0, 60),
      lastResult: result,
      lastResultFixtureId: fixture.id,
      lastReplays: replays,
      eliminated: eliminated || state.eliminated,
    })
    writeSave(toSavedGame(get())) // auto-save after every completed match
  },

  simRestOfTournament: () => {
    const state = get()
    const tournament: TournamentState = structuredCloneState(state.tournament)
    const career = state.career
    const news: NewsItem[] = []
    let guard = 0
    while (!isComplete(tournament) && guard++ < 200) {
      for (const f of currentFixtures(tournament)) {
        if (f.played || !f.homeId || !f.awayId) continue
        const r = instantSim(getTeam(f.homeId), getTeam(f.awayId), {
          knockout: tournament.stage !== 'GROUP',
          seed: (rng() * 1e9) | 0,
          homeFormModifiers: formMods(career, f.homeId),
          awayFormModifiers: formMods(career, f.awayId),
        })
        recordResult(tournament, f.id, toFixtureResult(r, f))
        applyMatchResult(career, r, rng, { knockout: tournament.stage !== 'GROUP' })
        news.push(resultNews(r, f))
      }
      if (!advanceStage(tournament)) break
    }
    const champ = champion(tournament)
    if (champ) news.unshift({ id: 'champ', kind: 'milestone', text: `🏆 ${getTeam(champ).flag} ${getTeam(champ).name} are 2026 World Cup champions!` })
    set({ tournament, career: { ...career }, news: [...news, ...state.news].slice(0, 80) })
    writeSave(toSavedGame(get()))
  },

  applyPress: (moraleDelta, reputationDelta) => {
    const state = get()
    const career = { ...state.career }
    for (const p of getTeam(state.userTeamId).squad) {
      if (career[p.id]) career[p.id] = { ...career[p.id], morale: clampN(career[p.id].morale + moraleDelta, 0, 100) }
    }
    set({ career, reputation: clampN(state.reputation + reputationDelta, 0, 100) })
    writeSave(toSavedGame(get())) // auto-save after every press conference
  },
}))

export { clearSave }

// ── helpers ──────────────────────────────────────────────────────
function clampN(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function toFixtureResult(r: MatchResult, fixture: Fixture) {
  // r.home/away already correspond to fixture.home/away (setup built that way)
  return {
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    shootout: r.shootout,
    winnerId: r.winnerId ?? (r.homeScore === r.awayScore ? null : r.homeScore > r.awayScore ? fixture.homeId : fixture.awayId),
  }
}

function resultNews(r: MatchResult, f: Fixture): NewsItem {
  const h = getTeam(r.homeId)
  const a = getTeam(r.awayId)
  const so = r.shootout ? ` (${r.shootout.home}-${r.shootout.away} pens)` : ''
  const label = f.round === 'GROUP' ? `Group ${f.group}` : ROUND_LABEL[f.round]
  return { id: `r${f.id}`, kind: 'result', text: `${label}: ${h.flag} ${h.name} ${r.homeScore}-${r.awayScore} ${a.name} ${a.flag}${so}` }
}

/** Is the user's team still alive deeper in the bracket (won current and waiting)? */
function inFutureBracket(t: TournamentState, teamId: string): boolean {
  return t.fixtures.some(
    (f) => !f.played && f.round !== 'GROUP' && (f.homeId === teamId || f.awayId === teamId),
  )
}

// Zustand state must stay immutable across sets; deep-clone the tournament.
function structuredCloneState(t: TournamentState): TournamentState {
  return {
    stage: t.stage,
    groupMatchday: t.groupMatchday,
    fixtures: t.fixtures.map((f) => ({ ...f, result: f.result ? { ...f.result } : undefined })),
  }
}

export { TEAMS }
