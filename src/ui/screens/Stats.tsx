import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import NavBar from '../components/NavBar'
import type { PlayerCareer } from '../../game/career'

type Metric = 'goals' | 'assists' | 'saves' | 'yellows'

const BOARDS: { metric: Metric; title: string; icon: string; sub: string }[] = [
  { metric: 'goals', title: 'Golden Boot', icon: '⚽', sub: 'Top scorers' },
  { metric: 'assists', title: 'Playmaker', icon: '🅰️', sub: 'Most assists' },
  { metric: 'saves', title: 'Golden Glove', icon: '🧤', sub: 'Most saves (GK)' },
  { metric: 'yellows', title: 'Discipline', icon: '🟨', sub: 'Most yellow cards' },
]

export default function Stats() {
  const { userTeamId, career } = useGame()
  const setInspect = useGame((s) => s.setInspectPlayer)
  const all = Object.values(career)

  const top = (metric: Metric) =>
    all
      .filter((c) => c[metric] > 0)
      .sort((a, b) => b[metric] - a[metric] || b.avgRating - a.avgRating)
      .slice(0, 10)

  return (
    <div className="flex h-full flex-col">
      <NavBar />
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-4">
        {BOARDS.map((b) => (
          <Leaderboard key={b.metric} {...b} rows={top(b.metric)} userTeamId={userTeamId} onInspect={setInspect} />
        ))}
      </div>
    </div>
  )
}

function Leaderboard({
  metric,
  title,
  icon,
  sub,
  rows,
  userTeamId,
  onInspect,
}: {
  metric: Metric
  title: string
  icon: string
  sub: string
  rows: PlayerCareer[]
  userTeamId: string
  onInspect: (id: string) => void
}) {
  return (
    <div className="panel h-fit p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-sm font-black leading-none">{title}</div>
          <div className="text-steel-500 text-[10px] uppercase">{sub}</div>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        {rows.length === 0 && <div className="text-steel-600 text-xs">Nothing recorded yet.</div>}
        {rows.map((c, i) => {
          const team = getTeam(c.teamId)
          const player = team.squad.find((p) => p.id === c.id)
          const mine = c.teamId === userTeamId
          return (
            <div
              key={c.id}
              onClick={() => onInspect(c.id)}
              className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-navy-800 ${mine ? 'bg-accent-500/15 text-accent-400 font-semibold' : ''}`}
            >
              <span className={`w-5 text-center text-xs ${i < 3 ? 'text-warn-500 font-black' : 'text-steel-500'}`}>{i + 1}</span>
              <span>{team.flag}</span>
              <span className="flex-1 truncate">{player?.name ?? c.id}</span>
              <span className="font-bold tabular-nums">{c[metric]}</span>
              {metric === 'goals' && c.assists > 0 && <span className="text-steel-500 text-[10px]">({c.assists}a)</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
