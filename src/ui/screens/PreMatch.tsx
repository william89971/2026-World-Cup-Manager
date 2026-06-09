import { useEffect } from 'react'
import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import TacticsEditor from '../components/TacticsEditor'
import { availablePlayers } from '../../game/career'
import { suggestFormation } from '../../engine/lineup'
import { ROUND_LABEL } from '../../data/draw2026'
import type { Team } from '../../data/types'
import { useTactics } from '../useTactics'

function scout(team: Team) {
  const groups = ['DEF', 'MID', 'FWD'] as const
  const avg = (g: string) => {
    const ps = team.squad.filter((p) => p.group === g)
    return ps.reduce((s, p) => s + p.overall, 0) / (ps.length || 1)
  }
  const ranked = groups.map((g) => ({ g, v: avg(g) })).sort((a, b) => b.v - a.v)
  const key = [...team.squad].sort((a, b) => Number(b.star ?? 0) - Number(a.star ?? 0) || b.overall - a.overall).slice(0, 3)
  return {
    formation: suggestFormation(team),
    keyPlayers: key,
    strength: ranked[0].g,
    weakness: ranked[ranked.length - 1].g,
  }
}

const GROUP_NAME: Record<string, string> = { DEF: 'defence', MID: 'midfield', FWD: 'attack' }

export default function PreMatch() {
  const { userTeamId, career } = useGame()
  const setScreen = useGame((s) => s.setScreen)
  const setTactics = useGame((s) => s.setTactics)
  const tactics = useTactics()
  const fixture = useGame((s) => s.userFixture)()
  useEffect(() => {
    if (!fixture) setScreen('hub')
  }, [fixture, setScreen])
  if (!fixture) return null
  const team = getTeam(userTeamId)
  const oppId = fixture.homeId === userTeamId ? fixture.awayId! : fixture.homeId!
  const opp = getTeam(oppId)
  const report = scout(opp)
  const available = new Set(availablePlayers(career, userTeamId))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-navy-700 px-6 py-3">
        <button className="btn-ghost" onClick={() => setScreen('hub')}>← Hub</button>
        <div className="text-center">
          <div className="font-black">{team.flag} {team.name} <span className="text-steel-500">vs</span> {opp.name} {opp.flag}</div>
          <div className="text-steel-400 text-[11px]">
            {fixture.round === 'GROUP' ? `Group ${fixture.group} · Matchday ${fixture.matchday}` : ROUND_LABEL[fixture.round]}
          </div>
        </div>
        <button className="btn-primary px-6" onClick={() => setScreen('match')}>Kick Off →</button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-bold uppercase text-steel-400">Team Selection</h3>
          <TacticsEditor team={team} value={tactics} available={available} onChange={setTactics} />
        </div>

        <div className="panel h-fit p-4">
          <h3 className="text-sm font-bold uppercase text-steel-400">Scouting: {opp.name}</h3>
          <div className="mt-3 space-y-3 text-sm">
            <Row label="Overall" value={`${opp.overall}`} />
            <Row label="Likely shape" value={report.formation} />
            <Row label="Style" value={opp.style} />
            <Row label="Greatest threat" value={GROUP_NAME[report.strength]} tone="danger" />
            <Row label="Weakness" value={GROUP_NAME[report.weakness]} tone="ok" />
          </div>
          <div className="mt-4">
            <div className="text-steel-400 mb-1 text-[11px] font-bold uppercase">Key Players</div>
            <div className="space-y-1">
              {report.keyPlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name} {p.star && <span className="text-warn-500">★</span>}</span>
                  <span className="text-steel-400">{p.position} · {p.overall}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'ok' }) {
  const c = tone === 'danger' ? 'text-danger-500' : tone === 'ok' ? 'text-accent-400' : 'text-white'
  return (
    <div className="flex items-center justify-between">
      <span className="text-steel-400 text-xs uppercase">{label}</span>
      <span className={`font-semibold capitalize ${c}`}>{value}</span>
    </div>
  )
}
