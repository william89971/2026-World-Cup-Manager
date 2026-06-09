import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import NavBar from '../components/NavBar'
import { GROUPS } from '../../data/draw2026'
import { groupStandings, bestThirds } from '../../game/tournament'

export default function Groups() {
  const { tournament, userTeamId } = useGame()
  const thirds = new Set(bestThirds(tournament).map((t) => t.teamId))

  return (
    <div className="flex h-full flex-col">
      <NavBar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {GROUPS.map((g) => {
            const table = groupStandings(tournament, g.id)
            return (
              <div key={g.id} className="panel p-3">
                <div className="text-steel-400 mb-1 text-[11px] font-bold uppercase">Group {g.id}</div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-steel-500 text-[10px]">
                      <th className="text-left font-medium">Team</th>
                      <th className="w-5 text-center font-medium">P</th>
                      <th className="w-7 text-center font-medium">GD</th>
                      <th className="w-6 text-center font-medium">Pt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((s, i) => (
                      <tr
                        key={s.teamId}
                        className={`border-t border-navy-800 ${s.teamId === userTeamId ? 'text-accent-400 font-bold' : ''}`}
                      >
                        <td className="py-1">
                          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${i < 2 ? 'bg-accent-500' : thirds.has(s.teamId) ? 'bg-warn-500' : 'bg-transparent'}`} />
                          {getTeam(s.teamId).flag} <span className="truncate">{getTeam(s.teamId).name}</span>
                        </td>
                        <td className="text-center">{s.played}</td>
                        <td className="text-center">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                        <td className="text-center font-bold">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
        <div className="text-steel-500 mt-3 flex gap-4 text-[11px]">
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent-500" />Qualified (top 2)</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-warn-500" />Best third-placed</span>
        </div>
      </div>
    </div>
  )
}
