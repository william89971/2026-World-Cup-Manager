import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import NavBar from '../components/NavBar'
import { FormArrow, MoraleBar, PosBadge, Pill, ratingColor } from '../components/common'
import { formOf, topScorers } from '../../game/career'

const GROUP_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const

export default function Squad() {
  const { userTeamId, career } = useGame()
  const setInspect = useGame((s) => s.setInspectPlayer)
  const team = getTeam(userTeamId)
  const squad = [...team.squad].sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || b.overall - a.overall)
  const scorers = topScorers(career, 8).filter((c) => getTeam(c.teamId))

  return (
    <div className="flex h-full flex-col">
      <NavBar />
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-4">
        <div className="panel overflow-x-auto lg:col-span-3">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-navy-800 text-steel-400 text-[11px]">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Pos</th>
                <th className="px-2 py-2 text-left">Player</th>
                <th className="px-2 py-2 text-center">Age</th>
                <th className="px-2 py-2 text-center">OVR</th>
                <th className="px-2 py-2 text-center">PAC</th>
                <th className="px-2 py-2 text-center">SHO</th>
                <th className="px-2 py-2 text-center">PAS</th>
                <th className="px-2 py-2 text-center">DRI</th>
                <th className="px-2 py-2 text-center">DEF</th>
                <th className="px-2 py-2 text-center">PHY</th>
                <th className="px-2 py-2 text-left">Morale</th>
                <th className="px-2 py-2 text-center">Form</th>
                <th className="px-2 py-2 text-center">Last</th>
                <th className="px-2 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const c = career[p.id]
                const a = p.attributes
                const status =
                  (c?.injuredMatches ?? 0) > 0 ? <Pill tone="danger">INJ</Pill> : (c?.suspendedMatches ?? 0) > 0 ? <Pill tone="warn">SUS</Pill> : c?.yellowAccrued ? <Pill tone="warn">YC</Pill> : null
                return (
                  <tr key={p.id} className="cursor-pointer border-t border-navy-800 hover:bg-navy-800/50" onClick={() => setInspect(p.id)}>
                    <td className="px-3 py-1.5 text-steel-400">{p.number}</td>
                    <td className="px-2 py-1.5"><PosBadge group={p.group} /></td>
                    <td className="px-2 py-1.5 font-medium">
                      {p.name} {p.star && <span className="text-warn-500">★</span>}
                    </td>
                    <td className="px-2 py-1.5 text-center text-steel-400">{p.age}</td>
                    <td className="px-2 py-1.5 text-center font-bold">{p.overall}</td>
                    <td className="px-2 py-1.5 text-center text-steel-300">{a.pace}</td>
                    <td className="px-2 py-1.5 text-center text-steel-300">{a.shooting}</td>
                    <td className="px-2 py-1.5 text-center text-steel-300">{a.passing}</td>
                    <td className="px-2 py-1.5 text-center text-steel-300">{a.dribbling}</td>
                    <td className="px-2 py-1.5 text-center text-steel-300">{a.defending}</td>
                    <td className="px-2 py-1.5 text-center text-steel-300">{a.physicality}</td>
                    <td className="px-2 py-1.5"><div className="w-16"><MoraleBar value={c?.morale ?? 70} /></div></td>
                    <td className="px-2 py-1.5 text-center"><FormArrow form={formOf(c)} /></td>
                    <td className={`px-2 py-1.5 text-center font-semibold ${c?.lastRating ? ratingColor(c.lastRating) : 'text-steel-600'}`}>
                      {c?.lastRating ? c.lastRating.toFixed(1) : '–'}
                    </td>
                    <td className="px-2 py-1.5">{status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="panel h-fit p-5">
          <div className="text-steel-400 text-[11px] font-bold uppercase">Golden Boot Race</div>
          <div className="mt-3 space-y-2">
            {scorers.length === 0 && <div className="text-steel-500 text-xs">No goals scored yet.</div>}
            {scorers.map((c, i) => {
              const p = getTeam(c.teamId).squad.find((x) => x.id === c.id)
              return (
                <div key={c.id} className="flex cursor-pointer items-center gap-2 rounded text-sm hover:bg-navy-800" onClick={() => setInspect(c.id)}>
                  <span className="text-steel-500 w-4">{i + 1}</span>
                  <span>{getTeam(c.teamId).flag}</span>
                  <span className="flex-1 truncate">{p?.name}</span>
                  <span className="font-bold text-accent-400">{c.goals}</span>
                  {c.assists > 0 && <span className="text-steel-500 text-xs">({c.assists}a)</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
