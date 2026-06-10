import { useGame, type TrainingFocus } from '../../store/gameStore'
import { getTeam, TEAMS } from '../../data'
import NavBar from '../components/NavBar'
import ShareCardPanel from '../components/ShareCardPanel'
import { MoraleBar } from '../components/common'
import { groupStandings, isComplete, champion, type Fixture, type TournamentState } from '../../game/tournament'
import { renderTournamentCard } from '../../utils/shareCard'
import { buildTournamentCardInput } from '../../utils/shareCardData'
import { ROUND_LABEL } from '../../data/draw2026'
import { matchdaySlot } from '../../data/schedule'
import { availablePlayers } from '../../game/career'

const TRAINING: { id: TrainingFocus; label: string; icon: string; note: string }[] = [
  { id: 'finishing', label: 'Finishing', icon: '🎯', note: '+3% shooting in the next match' },
  { id: 'setpieces', label: 'Set Pieces', icon: '🚩', note: '+3% aerial presence at set pieces' },
  { id: 'pressing', label: 'Pressing', icon: '⚡', note: '+3% defending, sharper press' },
  { id: 'rest', label: 'Rest', icon: '🛌', note: 'Squad recovers — morale & fitness up' },
]

export default function Hub() {
  const { userTeamId, tournament, career, news, eliminated, trainingFocus } = useGame()
  const setScreen = useGame((s) => s.setScreen)
  const simRest = useGame((s) => s.simRestOfTournament)
  const saveAndExit = useGame((s) => s.saveAndExit)
  const setTraining = useGame((s) => s.setTrainingFocus)
  const fixture = useGame((s) => s.userFixture)()
  const team = getTeam(userTeamId)

  const squad = team.squad
  const avail = new Set(availablePlayers(career, userTeamId))
  const injured = squad.filter((p) => (career[p.id]?.injuredMatches ?? 0) > 0)
  const suspended = squad.filter((p) => (career[p.id]?.suspendedMatches ?? 0) > 0)
  const moraleAvg = Math.round(squad.reduce((s, p) => s + (career[p.id]?.morale ?? 70), 0) / squad.length)

  const standings = groupStandings(tournament, team.group)
  const done = isComplete(tournament)
  const champ = champion(tournament)
  const userChampion = done && champ === userTeamId
  const campaignOver = userChampion || (eliminated && !fixture)

  const opp = fixture && (fixture.homeId === userTeamId ? fixture.awayId : fixture.homeId)
  const oppTeam = opp ? getTeam(opp) : null
  const slot = fixture ? matchdaySlot(fixture.round, fixture.matchday) : null
  const knockout = fixture && fixture.round !== 'GROUP'

  const ticker = buildTicker(tournament, news.map((n) => n.text))

  return (
    <div className="flex h-full flex-col">
      <NavBar />

      {/* Tournament stage banner — make the occasion feel big */}
      {knockout && fixture && (
        <div className="border-b border-navy-700 bg-gradient-to-r from-navy-900 via-accent-600/20 to-navy-900 py-2 text-center">
          <span className="text-xl font-black uppercase tracking-[0.35em] text-accent-400">
            {ROUND_LABEL[fixture.round]}
          </span>
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 pb-12 lg:grid-cols-3">
        {/* Next fixture */}
        <div className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-steel-400 text-[11px] font-bold uppercase">Next Fixture</div>
            {fixture && slot && (
              <div className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${slot.prepDays <= 2 ? 'bg-warn-500/20 text-warn-500' : 'bg-navy-800 text-steel-300'}`}>
                {slot.date} · kicks off in {slot.prepDays} day{slot.prepDays === 1 ? '' : 's'}
              </div>
            )}
          </div>
          {done ? (
            <div className="py-8 text-center">
              <div className="text-2xl font-black">🏆 Tournament Complete</div>
              {champ && (
                <div className="mt-2 text-lg">
                  Champions: {getTeam(champ).flag} <span className="font-bold">{getTeam(champ).name}</span>
                </div>
              )}
            </div>
          ) : fixture && oppTeam ? (
            <>
              <div className="my-4 flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="text-5xl">{team.flag}</div>
                  <div className="mt-1 font-bold">{team.name}</div>
                </div>
                <div className="text-steel-400 text-2xl font-black">VS</div>
                <div className="text-center">
                  <div className="text-5xl">{oppTeam.flag}</div>
                  <div className="mt-1 font-bold">{oppTeam.name}</div>
                </div>
              </div>
              <div className="text-steel-400 text-center text-xs">
                {fixture.round === 'GROUP' ? `Group ${fixture.group} · Matchday ${fixture.matchday}` : ROUND_LABEL[fixture.round]}
              </div>
              <div className="mt-5 flex justify-center">
                <button className="btn-primary px-10 py-3 text-base" onClick={() => setScreen('prematch')}>
                  Team Talk & Kick Off →
                </button>
              </div>

              {/* Training focus */}
              <div className="mt-5 border-t border-navy-700 pt-4">
                <div className="text-steel-400 mb-2 text-[11px] font-bold uppercase">Training Focus</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TRAINING.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTraining(trainingFocus === t.id ? null : t.id)}
                      className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold transition-colors ${
                        trainingFocus === t.id
                          ? 'border-accent-500 bg-accent-500/15 text-accent-400'
                          : 'border-navy-600 text-steel-300 hover:bg-navy-800'
                      }`}
                    >
                      <div className="text-lg">{t.icon}</div>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="text-steel-500 mt-1.5 text-center text-[11px]">
                  {trainingFocus
                    ? TRAINING.find((t) => t.id === trainingFocus)?.note
                    : 'Pick one focus before the match for a small boost.'}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="text-lg font-bold">{eliminated ? 'Your campaign is over.' : 'Awaiting next round…'}</div>
              <p className="text-steel-400 mt-1 text-sm">
                {eliminated ? 'But the tournament continues.' : 'The bracket is resolving.'}
              </p>
              <button className="btn-ghost mt-4" onClick={simRest}>
                Simulate to the Final →
              </button>
            </div>
          )}
        </div>

        {/* Squad status */}
        <div className="panel p-5">
          <div className="text-steel-400 text-[11px] font-bold uppercase">Squad Status</div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-steel-300">Squad morale</span>
            <span className="font-bold">{moraleAvg}</span>
          </div>
          <MoraleBar value={moraleAvg} className="mt-1" />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Available" value={avail.size} />
            <Stat label="Injured" value={injured.length} tone="danger" />
            <Stat label="Suspended" value={suspended.length} tone="warn" />
          </div>
          {(injured.length > 0 || suspended.length > 0) && (
            <div className="mt-3 space-y-1 text-xs">
              {injured.slice(0, 3).map((p) => (
                <div key={p.id} className="text-danger-500">⚕ {p.name} — injured</div>
              ))}
              {suspended.slice(0, 3).map((p) => (
                <div key={p.id} className="text-warn-500">⊘ {p.name} — suspended</div>
              ))}
            </div>
          )}
          <button className="btn-ghost mt-4 w-full" onClick={() => setScreen('squad')}>
            View Full Squad
          </button>
          <button className="btn-ghost mt-2 w-full text-xs" onClick={saveAndExit}>
            💾 Save & Exit
          </button>
        </div>

        {/* Group table */}
        <div className="panel p-5 lg:col-span-2">
          <div className="text-steel-400 text-[11px] font-bold uppercase">Group {team.group}</div>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-steel-400 text-[11px]">
                <th className="py-1 text-left font-medium">Team</th>
                <th className="px-1 text-center font-medium">P</th>
                <th className="px-1 text-center font-medium">GD</th>
                <th className="px-1 text-center font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.teamId} className={`border-t border-navy-800 ${s.teamId === userTeamId ? 'text-accent-400 font-bold' : ''}`}>
                  <td className="py-1.5">
                    <span className="text-steel-500 mr-2">{i + 1}</span>
                    {getTeam(s.teamId).flag} {getTeam(s.teamId).name}
                    {i < 2 && <span className="text-accent-500 ml-1 text-[10px]">●</span>}
                  </td>
                  <td className="px-1 text-center">{s.played}</td>
                  <td className="px-1 text-center">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                  <td className="px-1 text-center font-bold">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Opponent spotlight */}
        {oppTeam && fixture && (
          <div className="panel p-5">
            <div className="text-steel-400 text-[11px] font-bold uppercase">Opponent Spotlight</div>
            <OpponentSpotlight oppId={oppTeam.id} tournament={tournament} />
          </div>
        )}

        {/* Campaign share card (elimination or trophy) */}
        {campaignOver && (
          <div className="panel p-5 lg:col-span-2">
            <ShareCardPanel
              render={() => renderTournamentCard(buildTournamentCardInput(tournament, career, userTeamId, userChampion))}
              filename={userChampion ? 'world-champions.png' : 'tournament-run.png'}
              title={userChampion ? '🏆 Share your triumph' : 'Share your campaign'}
            />
          </div>
        )}

        {/* News feed */}
        <div className={`panel flex max-h-[420px] flex-col p-5 ${oppTeam ? 'lg:col-span-3' : ''}`}>
          <div className="text-steel-400 text-[11px] font-bold uppercase">News Feed</div>
          <div className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1">
            {news.map((n) => (
              <div key={n.id} className="border-l-2 border-navy-600 pl-2 text-xs leading-snug text-steel-300">
                {n.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* News ticker */}
      {ticker.length > 0 && (
        <div className="border-t border-navy-700 bg-navy-950/95 py-1.5 backdrop-blur">
          <div className="overflow-hidden">
            <div className="ticker-track">
              {[0, 1].map((dup) => (
                <span key={dup} className="text-steel-300 text-xs">
                  {ticker.map((t, i) => (
                    <span key={i}>
                      <span className="text-accent-500 mx-3">●</span>
                      {t}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Latest headlines + computed streak stories for the scrolling ticker. */
function buildTicker(tournament: TournamentState, newsTexts: string[]): string[] {
  const items = newsTexts.slice(0, 8)
  // winning streaks: 3+ straight wins in played fixtures
  const results = new Map<string, boolean[]>()
  for (const f of tournament.fixtures) {
    if (!f.played || !f.result || !f.homeId || !f.awayId) continue
    for (const tid of [f.homeId, f.awayId]) {
      const list = results.get(tid) ?? []
      list.push(f.result.winnerId === tid)
      results.set(tid, list)
    }
  }
  for (const [tid, list] of results) {
    let streak = 0
    for (let i = list.length - 1; i >= 0 && list[i]; i--) streak++
    if (streak >= 3) {
      const t = TEAMS[tid]
      items.push(`${t.flag} ${t.name} are on a ${streak}-match winning streak`)
    }
  }
  return items
}

/** Next opponent's last result, recent form and key player. */
function OpponentSpotlight({ oppId, tournament }: { oppId: string; tournament: TournamentState }) {
  const opp = getTeam(oppId)
  const played: Fixture[] = tournament.fixtures.filter(
    (f) => f.played && f.result && (f.homeId === oppId || f.awayId === oppId),
  )
  const last = played[played.length - 1]
  const form = played.slice(-3).map((f) => {
    const r = f.result!
    if (r.winnerId === oppId) return 'W'
    if (r.winnerId === null && r.homeScore === r.awayScore) return 'D'
    return 'L'
  })
  const key = [...opp.squad].sort((a, b) => Number(b.star ?? 0) - Number(a.star ?? 0) || b.overall - a.overall)[0]
  return (
    <div className="mt-3 space-y-3 text-sm">
      {last && last.homeId && last.awayId ? (
        <div>
          <div className="text-steel-500 text-[10px] uppercase">Last result</div>
          <div>
            {getTeam(last.homeId).flag} {last.result!.homeScore}-{last.result!.awayScore} {getTeam(last.awayId).flag}
          </div>
        </div>
      ) : (
        <div className="text-steel-500 text-xs">No matches played yet.</div>
      )}
      {form.length > 0 && (
        <div>
          <div className="text-steel-500 text-[10px] uppercase">Form</div>
          <div className="mt-0.5 flex gap-1">
            {form.map((f, i) => (
              <span
                key={i}
                className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-black ${
                  f === 'W' ? 'bg-accent-500 text-navy-950' : f === 'D' ? 'bg-navy-600 text-white' : 'bg-danger-500 text-white'
                }`}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-steel-500 text-[10px] uppercase">One to watch</div>
        <div className="font-semibold">
          {key.name} <span className="text-steel-400 text-xs">{key.position} · {key.overall}</span>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'warn' }) {
  const color = tone === 'danger' ? 'text-danger-500' : tone === 'warn' ? 'text-warn-500' : 'text-white'
  return (
    <div className="rounded-lg bg-navy-800 py-2">
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-steel-400 text-[10px] uppercase">{label}</div>
    </div>
  )
}
