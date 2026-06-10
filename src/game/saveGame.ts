// localStorage persistence for the tournament campaign. All access to the
// save slot goes through this module — components never touch localStorage.
import { SAVE_KEY, SAVE_VERSION, type LoadResult, type SaveData, type SavedGame, type SaveSummary } from '../types/save'
import { ROUND_LABEL } from '../data/draw2026'
import { getTeam } from '../data'
import type { TournamentState } from './tournament'

export function writeSave(state: SavedGame): void {
  const data: SaveData = { version: SAVE_VERSION, savedAt: new Date().toISOString(), state }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    // storage full / privacy mode — fail silently, the session continues
  }
}

export function loadSave(): LoadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(SAVE_KEY)
  } catch {
    return { kind: 'none' }
  }
  if (!raw) return { kind: 'none' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'corrupt' }
  }
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || !('state' in parsed)) {
    return { kind: 'corrupt' }
  }
  const data = parsed as SaveData
  if (data.version !== SAVE_VERSION) {
    return { kind: 'version-mismatch', foundVersion: Number(data.version) || 0 }
  }
  return { kind: 'ok', data }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // ignore
  }
}

export function hasSave(): boolean {
  const r = loadSave()
  return r.kind === 'ok' || r.kind === 'version-mismatch' || r.kind === 'corrupt'
}

/** The user's W/D/L across every fixture they've played. */
export function userRecord(tournament: TournamentState, userTeamId: string) {
  let won = 0
  let drawn = 0
  let lost = 0
  for (const f of tournament.fixtures) {
    if (!f.played || !f.result) continue
    if (f.homeId !== userTeamId && f.awayId !== userTeamId) continue
    const r = f.result
    if (r.homeScore === r.awayScore && !r.shootout) drawn++
    else if (r.winnerId === userTeamId) won++
    else if (r.winnerId === null) drawn++
    else lost++
  }
  return { won, drawn, lost }
}

/** Menu-facing summary of the current save, if one loads cleanly. */
export function saveSummary(): SaveSummary | null {
  const r = loadSave()
  if (r.kind !== 'ok') return null
  const s = r.data.state
  const team = getTeam(s.userTeamId)
  return {
    teamId: s.userTeamId,
    flag: team.flag,
    teamName: team.name,
    roundLabel: ROUND_LABEL[s.tournament.stage],
    record: userRecord(s.tournament, s.userTeamId),
    savedAt: r.data.savedAt,
  }
}
