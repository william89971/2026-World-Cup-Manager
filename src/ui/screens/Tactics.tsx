import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import NavBar from '../components/NavBar'
import TacticsEditor from '../components/TacticsEditor'
import { availablePlayers } from '../../game/career'
import { useTactics } from '../useTactics'

export default function Tactics() {
  const { userTeamId, career } = useGame()
  const tactics = useTactics()
  const setTactics = useGame((s) => s.setTactics)
  const team = getTeam(userTeamId)
  const available = new Set(availablePlayers(career, userTeamId))

  return (
    <div className="flex h-full flex-col">
      <NavBar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-lg font-black">Tactics Board</h2>
          <TacticsEditor team={team} value={tactics} available={available} onChange={setTactics} />
        </div>
      </div>
    </div>
  )
}
