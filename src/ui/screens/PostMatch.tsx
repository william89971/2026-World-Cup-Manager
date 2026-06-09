import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import { StatRow, ratingColor } from '../components/common'
import { generatePressConference, type PressOption, type PressQuestion } from '../../game/press'
import type { Side } from '../../engine/types'

export default function PostMatch() {
  const { userTeamId, lastResult } = useGame()
  const setScreen = useGame((s) => s.setScreen)
  const applyPress = useGame((s) => s.applyPress)
  const nextFixture = useGame((s) => s.userFixture)()
  const [answers, setAnswers] = useState<Record<string, PressOption>>({})
  const [submitted, setSubmitted] = useState(false)

  // redirect if there's no result (must not setState during render)
  useEffect(() => {
    if (!lastResult) setScreen('hub')
  }, [lastResult, setScreen])

  // null-safe derivations so every hook below runs unconditionally
  const r = lastResult
  const userSide: Side = r && r.homeId === userTeamId ? 'home' : 'away'
  const userScore = r ? (userSide === 'home' ? r.homeScore : r.awayScore) : 0
  const oppScore = r ? (userSide === 'home' ? r.awayScore : r.homeScore) : 0
  const won = !!r && userScore > oppScore
  const drew = !!r && userScore === oppScore
  const ratings = r ? [...r.ratings[userSide]].sort((a, b) => b.rating - a.rating) : []
  const played = ratings.filter((x) => x.minutes > 0)

  const questions = useMemo(
    () =>
      r
        ? generatePressConference({
            won,
            drew,
            lost: !won && !drew,
            scoreline: `${userScore}-${oppScore}`,
            starName: played[0]?.name,
            poorName: played[played.length - 1]?.minutes >= 45 ? played[played.length - 1]?.name : undefined,
            opponentName: nextFixture ? getTeam(nextOpp(nextFixture, userTeamId)).name : undefined,
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  if (!r) return null
  const home = getTeam(r.homeId)
  const away = getTeam(r.awayId)

  const allAnswered = questions.every((q) => answers[q.id])

  const submit = () => {
    let morale = 0
    let rep = 0
    for (const q of questions) {
      const o = answers[q.id]
      if (o) {
        morale += o.morale
        rep += o.reputation
      }
    }
    applyPress(morale, rep)
    setSubmitted(true)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Result hero */}
      <div className={`px-6 py-6 text-center ${won ? 'bg-accent-600/20' : drew ? 'bg-navy-800' : 'bg-danger-500/15'}`}>
        <div className="text-steel-400 text-xs font-bold uppercase">Full Time</div>
        <div className="mt-2 flex items-center justify-center gap-5 text-3xl font-black">
          <span>{home.flag} {home.name}</span>
          <span className="rounded-lg bg-navy-950 px-4 py-1">{r.homeScore} : {r.awayScore}</span>
          <span>{away.name} {away.flag}</span>
        </div>
        {r.shootout && <div className="text-steel-400 mt-1 text-sm">After penalties: {r.shootout.home}–{r.shootout.away}</div>}
        <div className="mt-2 text-lg font-bold">
          {won ? '✅ Victory' : drew ? '🤝 Draw' : '❌ Defeat'}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        {/* Stats */}
        <div className="panel space-y-2 p-4">
          <h3 className="text-steel-400 text-[11px] font-bold uppercase">Match Stats</h3>
          <StatRow label="Possession" home={poss(r, 'home')} away={poss(r, 'away')} />
          <StatRow label="Shots" home={r.stats.shots.home} away={r.stats.shots.away} />
          <StatRow label="On target" home={r.stats.onTarget.home} away={r.stats.onTarget.away} />
          <StatRow label="Corners" home={r.stats.corners.home} away={r.stats.corners.away} />
          <StatRow label="Fouls" home={r.stats.fouls.home} away={r.stats.fouls.away} />
          <StatRow label="Yellow cards" home={r.stats.yellows.home} away={r.stats.yellows.away} />
          <StatRow label="Pass accuracy" home={passAcc(r, 'home')} away={passAcc(r, 'away')} />
        </div>

        {/* Ratings */}
        <div className="panel p-4">
          <h3 className="text-steel-400 mb-2 text-[11px] font-bold uppercase">{getTeam(userTeamId).name} Ratings</h3>
          <div className="space-y-0.5">
            {ratings.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className={`w-8 text-center font-black ${ratingColor(p.rating)}`}>{p.rating.toFixed(1)}</span>
                <span className="flex-1 truncate">{p.name}</span>
                {p.goals > 0 && <span className="text-accent-400 text-xs">⚽{p.goals}</span>}
                {p.assists > 0 && <span className="text-steel-400 text-xs">🅰{p.assists}</span>}
                {p.red ? <span className="text-danger-500 text-xs">🟥</span> : p.yellow > 0 ? <span className="text-warn-500 text-xs">🟨</span> : null}
                {p.minutes === 0 && <span className="text-steel-600 text-[10px]">unused</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Press conference */}
        <div className="panel flex flex-col p-4">
          <h3 className="text-steel-400 mb-2 text-[11px] font-bold uppercase">Press Conference</h3>
          {!submitted ? (
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {questions.map((q) => (
                <PressBlock key={q.id} q={q} selected={answers[q.id]} onSelect={(o) => setAnswers((a) => ({ ...a, [q.id]: o }))} />
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="text-3xl">🎙️</div>
              <p className="text-steel-300 mt-2 text-sm">The media has its headlines. Morale and reputation updated.</p>
            </div>
          )}
          <div className="mt-3">
            {!submitted ? (
              <button className="btn-primary w-full" disabled={!allAnswered} onClick={submit}>
                Face the Media
              </button>
            ) : (
              <button className="btn-primary w-full" onClick={() => setScreen('hub')}>
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PressBlock({ q, selected, onSelect }: { q: PressQuestion; selected?: PressOption; onSelect: (o: PressOption) => void }) {
  return (
    <div className="rounded-lg bg-navy-800 p-3">
      <p className="mb-2 text-sm font-medium">“{q.text}”</p>
      <div className="space-y-1">
        {q.options.map((o) => (
          <button
            key={o.tone}
            onClick={() => onSelect(o)}
            className={`block w-full rounded px-2 py-1.5 text-left text-xs ${selected === o ? 'bg-accent-500 text-navy-950 font-semibold' : 'border border-navy-600 text-steel-300 hover:bg-navy-700'}`}
          >
            <span className="mr-1 uppercase opacity-70">[{o.tone}]</span> {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function poss(r: { stats: { possessionTicks: { home: number; away: number } } }, side: 'home' | 'away') {
  const t = r.stats.possessionTicks.home + r.stats.possessionTicks.away || 1
  return Math.round((r.stats.possessionTicks[side] / t) * 100)
}
function passAcc(r: { stats: { passesCompleted: Record<string, number>; passesAttempted: Record<string, number> } }, side: 'home' | 'away') {
  const att = r.stats.passesAttempted[side] || 1
  return Math.round((r.stats.passesCompleted[side] / att) * 100)
}
function nextOpp(fixture: { homeId: string | null; awayId: string | null }, userId: string) {
  return (fixture.homeId === userId ? fixture.awayId : fixture.homeId) ?? userId
}
