import {
  FINAL_SLOT,
  GROUPS,
  QF_SLOTS,
  R16_SLOTS,
  R32_SLOTS,
  SF_SLOTS,
  TPP_SLOT,
  type RoundId,
} from '../data/draw2026'

export interface FixtureResult {
  homeScore: number
  awayScore: number
  shootout?: { home: number; away: number }
  winnerId: string | null
}

export interface Fixture {
  id: string
  round: RoundId
  group?: string
  matchday?: number
  homeId: string | null
  awayId: string | null
  homeRef?: string
  awayRef?: string
  result?: FixtureResult
  played: boolean
}

export interface TournamentState {
  stage: RoundId
  groupMatchday: number // 1..3
  fixtures: Fixture[]
}

export interface Standing {
  teamId: string
  group: string
  played: number
  win: number
  draw: number
  loss: number
  gf: number
  ga: number
  gd: number
  points: number
}

// round-robin matchdays for a 4-team group (indices into group.teams)
const RR: [number, number][][] = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
]

export function createTournament(): TournamentState {
  const fixtures: Fixture[] = []
  for (const g of GROUPS) {
    RR.forEach((pairs, md) => {
      pairs.forEach(([h, a], i) => {
        fixtures.push({
          id: `G${g.id}-${md + 1}-${i}`,
          round: 'GROUP',
          group: g.id,
          matchday: md + 1,
          homeId: g.teams[h],
          awayId: g.teams[a],
          played: false,
        })
      })
    })
  }
  const ko = (round: RoundId, slots: { match: number; home: string; away: string }[]) =>
    slots.forEach((s) =>
      fixtures.push({
        id: `M${s.match}`,
        round,
        homeId: null,
        awayId: null,
        homeRef: s.home,
        awayRef: s.away,
        played: false,
      }),
    )
  ko('R32', R32_SLOTS)
  ko('R16', R16_SLOTS)
  ko('QF', QF_SLOTS)
  ko('SF', SF_SLOTS)
  ko('TPP', [TPP_SLOT])
  ko('FINAL', [FINAL_SLOT])

  return { stage: 'GROUP', groupMatchday: 1, fixtures }
}

export function groupStandings(state: TournamentState, group: string): Standing[] {
  const teams = GROUPS.find((g) => g.id === group)!.teams
  const table: Record<string, Standing> = {}
  for (const t of teams)
    table[t] = { teamId: t, group, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, points: 0 }

  for (const f of state.fixtures) {
    if (f.group !== group || !f.played || !f.result || !f.homeId || !f.awayId) continue
    const { homeScore, awayScore } = f.result
    const h = table[f.homeId]
    const a = table[f.awayId]
    h.played++; a.played++
    h.gf += homeScore; h.ga += awayScore
    a.gf += awayScore; a.ga += homeScore
    if (homeScore > awayScore) { h.win++; h.points += 3; a.loss++ }
    else if (homeScore < awayScore) { a.win++; a.points += 3; h.loss++ }
    else { h.draw++; a.draw++; h.points++; a.points++ }
  }
  for (const t of Object.values(table)) t.gd = t.gf - t.ga
  return Object.values(table).sort((a, b) => cmpStanding(a, b) || headToHead(state, a.teamId, b.teamId) || a.teamId.localeCompare(b.teamId))
}

/** Points → GD → GF. Head-to-head / alphabetical applied by the caller. */
function cmpStanding(a: Standing, b: Standing): number {
  return b.points - a.points || b.gd - a.gd || b.gf - a.gf
}

/** Negative if `a` beat `b` in their group meeting, positive if `b` won, 0 otherwise. */
function headToHead(state: TournamentState, a: string, b: string): number {
  const f = state.fixtures.find(
    (x) =>
      x.round === 'GROUP' &&
      x.played &&
      x.result &&
      ((x.homeId === a && x.awayId === b) || (x.homeId === b && x.awayId === a)),
  )
  if (!f?.result || f.result.homeScore === f.result.awayScore) return 0
  const winner = f.result.homeScore > f.result.awayScore ? f.homeId : f.awayId
  return winner === a ? -1 : 1
}

export function allGroupStandings(state: TournamentState): Record<string, Standing[]> {
  const out: Record<string, Standing[]> = {}
  for (const g of GROUPS) out[g.id] = groupStandings(state, g.id)
  return out
}

export function groupStageComplete(state: TournamentState): boolean {
  return state.fixtures.filter((f) => f.round === 'GROUP').every((f) => f.played)
}

/** The 8 best third-placed teams, ranked. */
export function bestThirds(state: TournamentState): Standing[] {
  const thirds = GROUPS.map((g) => groupStandings(state, g.id)[2])
  // cross-group ranking: no head-to-head exists, fall back to alphabetical
  return thirds.sort((a, b) => cmpStanding(a, b) || a.teamId.localeCompare(b.teamId)).slice(0, 8)
}

/** Resolve a knockout slot reference (e.g. 'WA','RB','T3','M73','L101') to a team id. */
export function resolveRef(state: TournamentState, ref: string): string | null {
  // Group-derived slots (winners/runners-up/best-thirds) must NOT resolve from
  // partial standings — they would lock in provisionally and never update.
  // Only resolve them once the entire group stage is complete.
  if (ref[0] === 'W' || ref[0] === 'R' || ref[0] === 'T') {
    if (!groupStageComplete(state)) return null
  }
  if (ref.startsWith('W') && ref.length === 2) return groupStandings(state, ref[1])[0]?.teamId ?? null
  if (ref.startsWith('R') && ref.length === 2) return groupStandings(state, ref[1])[1]?.teamId ?? null
  if (ref.startsWith('T')) {
    const idx = parseInt(ref.slice(1), 10) - 1
    return bestThirds(state)[idx]?.teamId ?? null
  }
  if (ref.startsWith('M')) {
    const f = state.fixtures.find((x) => x.id === ref)
    return f?.result?.winnerId ?? null
  }
  if (ref.startsWith('L')) {
    const f = state.fixtures.find((x) => x.id === `M${ref.slice(1)}`)
    if (!f?.result || !f.homeId || !f.awayId) return null
    return f.result.winnerId === f.homeId ? f.awayId : f.homeId
  }
  return null
}

/** Fill in any knockout fixtures whose references are now resolvable. */
export function resolveBracket(state: TournamentState): void {
  for (const f of state.fixtures) {
    if (f.round === 'GROUP') continue
    if (f.homeId == null && f.homeRef) f.homeId = resolveRef(state, f.homeRef)
    if (f.awayId == null && f.awayRef) f.awayId = resolveRef(state, f.awayRef)
  }
}

export function recordResult(state: TournamentState, fixtureId: string, result: FixtureResult): void {
  const f = state.fixtures.find((x) => x.id === fixtureId)
  if (!f) return
  f.result = result
  f.played = true
  resolveBracket(state)
}

const STAGE_ORDER: RoundId[] = ['GROUP', 'R32', 'R16', 'QF', 'SF', 'TPP', 'FINAL']

export function fixturesForStage(state: TournamentState, stage: RoundId, matchday?: number): Fixture[] {
  return state.fixtures.filter(
    (f) => f.round === stage && (matchday == null || f.matchday === matchday),
  )
}

/** The set of fixtures currently due to be played. */
export function currentFixtures(state: TournamentState): Fixture[] {
  if (state.stage === 'GROUP') return fixturesForStage(state, 'GROUP', state.groupMatchday)
  return fixturesForStage(state, state.stage)
}

/** Advance the stage pointer once all current fixtures are played. Returns true if advanced. */
export function advanceStage(state: TournamentState): boolean {
  if (!currentFixtures(state).every((f) => f.played)) return false
  if (state.stage === 'GROUP') {
    if (state.groupMatchday < 3) {
      state.groupMatchday++
    } else {
      resolveBracket(state)
      state.stage = 'R32'
    }
    return true
  }
  const idx = STAGE_ORDER.indexOf(state.stage)
  if (idx < STAGE_ORDER.length - 1) {
    // SF → TPP and FINAL both become playable; treat TPP then FINAL
    state.stage = STAGE_ORDER[idx + 1]
    resolveBracket(state)
    return true
  }
  return false
}

export function isComplete(state: TournamentState): boolean {
  const final = state.fixtures.find((f) => f.id === `M${FINAL_SLOT.match}`)
  return !!final?.played
}

export function champion(state: TournamentState): string | null {
  return state.fixtures.find((f) => f.id === `M${FINAL_SLOT.match}`)?.result?.winnerId ?? null
}
