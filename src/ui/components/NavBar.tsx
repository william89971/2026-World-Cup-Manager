import { useGame, type Screen } from '../../store/gameStore'
import { getTeam } from '../../data'
import { ROUND_LABEL } from '../../data/draw2026'

const TABS: { id: Screen; label: string }[] = [
  { id: 'hub', label: 'Hub' },
  { id: 'squad', label: 'Squad' },
  { id: 'tactics', label: 'Tactics' },
  { id: 'groups', label: 'Groups' },
  { id: 'bracket', label: 'Bracket' },
  { id: 'stats', label: 'Stats' },
]

export default function NavBar() {
  const screen = useGame((s) => s.screen)
  const setScreen = useGame((s) => s.setScreen)
  const userTeamId = useGame((s) => s.userTeamId)
  const reputation = useGame((s) => s.reputation)
  const stage = useGame((s) => s.tournament.stage)
  const team = getTeam(userTeamId)

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-1 border-b border-navy-700 bg-navy-900/80 px-3 py-2 backdrop-blur sm:px-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-2xl">{team.flag}</span>
        <div>
          <div className="text-sm font-bold leading-none">{team.name}</div>
          <div className="text-steel-400 text-[11px]">{ROUND_LABEL[stage]}</div>
        </div>
      </div>
      <div className="order-3 flex w-full justify-center gap-0.5 sm:order-none sm:w-auto sm:gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setScreen(t.id)}
            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
              screen === t.id ? 'bg-accent-500 text-navy-950' : 'text-steel-300 hover:bg-navy-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-steel-400 hidden sm:inline">Reputation</span>
        <span className="text-steel-400 sm:hidden">Rep</span>
        <span className="font-bold text-accent-400">{Math.round(reputation)}</span>
      </div>
    </div>
  )
}
