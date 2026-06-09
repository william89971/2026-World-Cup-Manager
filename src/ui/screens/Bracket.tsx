import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import NavBar from '../components/NavBar'
import { ROUND_LABEL, type RoundId } from '../../data/draw2026'
import type { Fixture } from '../../game/tournament'

const COLUMNS: RoundId[] = ['R32', 'R16', 'QF', 'SF', 'FINAL']

export default function Bracket() {
  const { tournament, userTeamId } = useGame()
  const tpp = tournament.fixtures.find((f) => f.round === 'TPP')

  return (
    <div className="flex h-full flex-col">
      <NavBar />
      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-4">
          {COLUMNS.map((round) => {
            const fixtures = tournament.fixtures.filter((f) => f.round === round)
            return (
              <div key={round} className="flex min-w-[210px] flex-col justify-around gap-2">
                <div className="text-steel-400 sticky top-0 text-[11px] font-bold uppercase">{ROUND_LABEL[round]}</div>
                {fixtures.map((f) => (
                  <FixtureCard key={f.id} f={f} userTeamId={userTeamId} />
                ))}
              </div>
            )
          })}
        </div>
        {tpp && (
          <div className="mt-6 max-w-[230px]">
            <div className="text-steel-400 text-[11px] font-bold uppercase">{ROUND_LABEL.TPP}</div>
            <FixtureCard f={tpp} userTeamId={userTeamId} />
          </div>
        )}
      </div>
    </div>
  )
}

function Side({ id, ref_, score, winner, user }: { id: string | null; ref_?: string; score?: number; winner: boolean; user: boolean }) {
  const t = id ? getTeam(id) : null
  return (
    <div className={`flex items-center justify-between px-2 py-1 ${winner ? 'font-bold text-white' : 'text-steel-300'} ${user ? 'text-accent-400' : ''}`}>
      <span className="flex items-center gap-1.5 truncate">
        <span className="text-sm">{t?.flag ?? '·'}</span>
        <span className="truncate text-xs">{t?.name ?? ref_ ?? 'TBD'}</span>
      </span>
      {score != null && <span className="text-xs font-bold tabular-nums">{score}</span>}
    </div>
  )
}

function FixtureCard({ f, userTeamId }: { f: Fixture; userTeamId: string }) {
  const r = f.result
  const homeWin = r ? r.winnerId === f.homeId : false
  const awayWin = r ? r.winnerId === f.awayId : false
  return (
    <div className="panel divide-y divide-navy-800 overflow-hidden">
      <Side id={f.homeId} ref_={f.homeRef} score={r?.homeScore} winner={homeWin} user={f.homeId === userTeamId} />
      <Side id={f.awayId} ref_={f.awayRef} score={r?.awayScore} winner={awayWin} user={f.awayId === userTeamId} />
      {r?.shootout && (
        <div className="text-steel-500 px-2 py-0.5 text-center text-[10px]">pens {r.shootout.home}-{r.shootout.away}</div>
      )}
    </div>
  )
}
