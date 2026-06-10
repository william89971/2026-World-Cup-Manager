import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import NavBar from '../components/NavBar'
import ShareCardPanel from '../components/ShareCardPanel'
import { MoraleBar } from '../components/common'
import { groupStandings, isComplete, champion } from '../../game/tournament'
import { renderTournamentCard } from '../../utils/shareCard'
import { buildTournamentCardInput } from '../../utils/shareCardData'
import { ROUND_LABEL } from '../../data/draw2026'
import { availablePlayers } from '../../game/career'

export default function Hub() {
  const { userTeamId, tournament, career, news, eliminated } = useGame()
  const setScreen = useGame((s) => s.setScreen)
  const simRest = useGame((s) => s.simRestOfTournament)
  const saveAndExit = useGame((s) => s.saveAndExit)
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
  // campaign over (won it, or eliminated with no fixture left) → share card
  const userChampion = done && champ === userTeamId
  const campaignOver = userChampion || (eliminated && !fixture)

  const opp =
    fixture && (fixture.homeId === userTeamId ? fixture.awayId : fixture.homeId)
  const oppTeam = opp ? getTeam(opp) : null

  return (
    <div className="flex h-full flex-col">
      <NavBar />
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-3">
        {/* Next fixture */}
        <div className="panel p-5 lg:col-span-2">
          <div className="text-steel-400 text-[11px] font-bold uppercase">Next Fixture</div>
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
        <div className="panel flex max-h-[420px] flex-col p-5">
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
