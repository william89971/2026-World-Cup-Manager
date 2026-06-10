import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import { MatchController, type ShootoutKickView, type SpeedLevel } from '../../match/MatchController'
import type { MatchEvent, Side, SimPlayer, WorldState } from '../../engine/types'
import { PITCH } from '../../engine/constants'
import { StatRow } from '../components/common'
import { commentaryFor, TACTICAL_LINES } from '../../data/commentary'
import { resolveMatchKits } from '../../utils/kitContrast'
import PauseMenu from '../components/PauseMenu'

interface Hud {
  minute: number
  half: number
  home: number
  away: number
  possHome: number
  momHome: number
  shotsH: number
  shotsA: number
  otH: number
  otA: number
  foulsH: number
  foulsA: number
  dots: { x: number; y: number; c: string }[]
  ball: { x: number; y: number }
}

interface ShootoutUi {
  phase: 'pick' | 'running'
  kicks: ShootoutKickView[]
  score: { home: number; away: number }
  done: boolean
}

interface FeedLine {
  id: number
  minute: number
  text: string
  highlight: boolean
}

const SPEEDS: SpeedLevel[] = [1, 2, 5, 99]
const SPEED_LABEL: Record<SpeedLevel, string> = { 1: '1×', 2: '2×', 5: '5×', 99: '⏩' }
const WEATHER_LABEL = { 'clear-night': '🌙 Clear', overcast: '☁️ Overcast', rain: '🌧 Rain' } as const

export default function Match() {
  const containerRef = useRef<HTMLDivElement>(null)
  const ctrlRef = useRef<MatchController | null>(null)
  const lastHudRef = useRef(0)
  const feedSeq = useRef(0)
  const userTeamId = useGame((s) => s.userTeamId)
  const buildSetup = useGame((s) => s.buildUserMatchSetup)
  const finishUserMatch = useGame((s) => s.finishUserMatch)
  const setScreen = useGame((s) => s.setScreen)

  const [hud, setHud] = useState<Hud | null>(null)
  const [banner, setBanner] = useState<{ text: string; big: boolean } | null>(null)
  const [feed, setFeed] = useState<FeedLine[]>([])
  const [paused, setPaused] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [shootout, setShootout] = useState<ShootoutUi | null>(null)
  const [intro, setIntro] = useState(true)
  const [goalFlash, setGoalFlash] = useState<string | null>(null)
  const [cardFlash, setCardFlash] = useState<{ side: Side; red: boolean } | null>(null)
  const [htStats, setHtStats] = useState(false)
  const [ftHold, setFtHold] = useState(false)
  const occasionRef = useRef<{ roundLabel: string; stadium: string; city: string } | null>(null)
  const goalTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const htTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [weather, setWeather] = useState<string>('')
  const [speed, setSpeed] = useState<SpeedLevel>(1)
  const [camMode, setCamMode] = useState<'follow' | 'broadcast' | 'free'>('follow')
  const [, force] = useState(0)
  const sideRef = useRef<Side>('home')
  const namesRef = useRef({ hf: '', af: '', hn: '', an: '', hc: '#fff', ac: '#fff' })
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushFeed = (minute: number, text: string, highlight = false) => {
    setFeed((f) => [{ id: feedSeq.current++, minute, text, highlight }, ...f].slice(0, 40))
  }

  useEffect(() => {
    const setup = buildSetup()
    if (!setup || !containerRef.current) {
      setScreen('hub')
      return
    }
    sideRef.current = setup.home.teamId === userTeamId ? 'home' : 'away'
    // use the contrast-resolved on-pitch colours so HUD/minimap match the 3D kits
    const kits = resolveMatchKits(setup.home.kit, setup.away.kit)
    namesRef.current = {
      hf: getTeam(setup.home.teamId).flag,
      af: getTeam(setup.away.teamId).flag,
      hn: setup.home.teamId,
      an: setup.away.teamId,
      hc: kits.home.shirt,
      ac: kits.away.shirt,
    }
    const homeName = getTeam(setup.home.teamId).name
    const awayName = getTeam(setup.away.teamId).name

    const ctrl = new MatchController(containerRef.current, setup, {
      onFrame: (w) => {
        const now = performance.now()
        if (now - lastHudRef.current < 110) return
        lastHudRef.current = now
        setHud(snapshot(w, namesRef.current.hc, namesRef.current.ac))
      },
      onEvent: (ev) => {
        showBanner(ev)
        // broadcast scoreboard reactions
        if (ev.type === 'goal' && ev.playerName) {
          setGoalFlash(`⚽ ${ev.playerName} ${Math.max(1, Math.ceil(ev.timeSec / 60))}'`)
          if (goalTimer.current) clearTimeout(goalTimer.current)
          goalTimer.current = setTimeout(() => setGoalFlash(null), 4500)
        }
        if ((ev.type === 'yellow' || ev.type === 'red') && ev.side) {
          setCardFlash({ side: ev.side, red: ev.type === 'red' })
          if (cardTimer.current) clearTimeout(cardTimer.current)
          cardTimer.current = setTimeout(() => setCardFlash(null), 3000)
        }
        if (ev.type === 'halftime') {
          setHtStats(true)
          if (htTimer.current) clearTimeout(htTimer.current)
          htTimer.current = setTimeout(() => setHtStats(false), 4000)
        }
        const teamName = ev.side === 'away' ? awayName : homeName
        const oppName = ev.side === 'away' ? homeName : awayName
        const line = commentaryFor(ev, {
          teamName,
          oppName,
          score: ev.score ?? { home: 0, away: 0 },
          minute: Math.floor(ev.timeSec / 60),
        })
        if (line) {
          pushFeed(Math.floor(ev.timeSec / 60), line, ev.type === 'goal' || ev.type === 'red' || ev.type === 'penalty')
        }
      },
      onReplay: (active) => setReplaying(active),
      onShootoutNeeded: () =>
        setShootout({ phase: 'pick', kicks: [], score: { home: 0, away: 0 }, done: false }),
      onShootoutKick: (kick) =>
        setShootout((s) => (s ? { ...s, kicks: [...s.kicks, kick], score: kick.score } : s)),
      onShootoutDone: (score) => setShootout((s) => (s ? { ...s, score, done: true } : s)),
      onFinished: () => {
        // hold a full-time result graphic before leaving the stadium
        setFtHold(true)
        ftTimer.current = setTimeout(() => {
          const result = ctrl.sim.getResult()
          finishUserMatch(result, ctrl.getReplays())
          setScreen('postmatch')
        }, 3000)
      },
    })
    ctrlRef.current = ctrl
    occasionRef.current = setup.occasion ?? null
    setWeather(WEATHER_LABEL[ctrl.renderer.weather])
    ctrl.setSpeed(1)
    ctrl.start()
    const introTimer = setTimeout(() => setIntro(false), 3400)

    const onResize = () => ctrl.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(introTimer)
      for (const t of [goalTimer, cardTimer, htTimer, ftTimer]) if (t.current) clearTimeout(t.current)
      ctrl.dispose()
      ctrlRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showBanner = (ev: MatchEvent) => {
    const big = ev.type === 'goal' || ev.type === 'red' || ev.type === 'penalty'
    if (!['goal', 'red', 'yellow', 'penalty', 'save', 'bigchance'].includes(ev.type)) return
    setBanner({ text: ev.text, big })
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), big ? 3000 : 1800)
  }

  const changeSpeed = (s: SpeedLevel) => {
    setSpeed(s)
    ctrlRef.current?.setSpeed(s)
  }
  const cycleCam = () => {
    const order: typeof camMode[] = ['follow', 'broadcast', 'free']
    const next = order[(order.indexOf(camMode) + 1) % order.length]
    setCamMode(next)
    ctrlRef.current?.renderer.setCameraMode(next)
  }
  const togglePause = () => {
    const p = ctrlRef.current?.togglePause() ?? false
    setPaused(p)
  }
  const onTactic = () => {
    const minute = hud?.minute ?? 0
    pushFeed(minute, TACTICAL_LINES[Math.floor(Math.random() * TACTICAL_LINES.length)])
  }

  const n = namesRef.current
  const minuteLabel = hud ? `${Math.min(hud.half >= 3 ? 120 : 90, hud.minute)}'` : "0'"

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Broadcast lower-third scoreboard */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
        {goalFlash && (
          <div className="feed-enter mb-1.5 text-center">
            <span className="rounded-full bg-accent-500 px-4 py-1 text-xs font-black uppercase tracking-wide text-navy-950 shadow-lg">
              {goalFlash}
            </span>
          </div>
        )}
        <div className={`flex items-stretch overflow-hidden rounded-lg border border-navy-600/70 bg-navy-950/92 shadow-2xl backdrop-blur ${goalFlash ? 'animate-pulse' : ''}`}>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 sm:gap-2 sm:px-3">
            <span className="text-base sm:text-lg">{n.hf}</span>
            <span className="text-xs font-black tracking-wider sm:text-sm">{n.hn}</span>
            {cardFlash?.side === 'home' && (
              <span className={`h-3.5 w-2.5 animate-pulse rounded-[2px] ${cardFlash.red ? 'bg-danger-500' : 'bg-warn-500'}`} />
            )}
          </div>
          <div className="flex items-center bg-white/95 px-2.5 font-mono text-base font-black tabular-nums text-navy-950 sm:px-3 sm:text-lg">
            {hud?.home ?? 0}<span className="mx-1 opacity-50">–</span>{hud?.away ?? 0}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 sm:gap-2 sm:px-3">
            {cardFlash?.side === 'away' && (
              <span className={`h-3.5 w-2.5 animate-pulse rounded-[2px] ${cardFlash.red ? 'bg-danger-500' : 'bg-warn-500'}`} />
            )}
            <span className="text-xs font-black tracking-wider sm:text-sm">{n.an}</span>
            <span className="text-base sm:text-lg">{n.af}</span>
          </div>
          <div className="flex items-center border-l border-navy-700 bg-navy-900/80 px-2 font-mono text-xs font-bold text-accent-400 sm:px-2.5">
            {minuteLabel}
          </div>
        </div>
        {/* momentum strip */}
        {hud && (
          <div className="mt-1 flex h-[3px] overflow-hidden rounded-full bg-navy-800/80" title="Momentum">
            <div className="h-full transition-all duration-700" style={{ width: `${hud.momHome}%`, background: n.hc }} />
            <div className="h-full flex-1 transition-all duration-700" style={{ background: n.ac, opacity: 0.85 }} />
          </div>
        )}
      </div>

      {/* Weather chip */}
      <div className="pointer-events-none absolute left-3 bottom-16 hidden rounded-lg border border-navy-700 bg-navy-950/70 px-2 py-1 text-[11px] text-steel-300 backdrop-blur sm:block">
        {weather}
      </div>

      {/* Stat panel (hidden on very small screens) */}
      {hud && (
        <div className="absolute left-3 top-3 hidden w-44 space-y-1.5 rounded-xl border border-navy-700 bg-navy-950/80 p-3 backdrop-blur sm:block">
          <StatRow label="Possession" home={hud.possHome} away={100 - hud.possHome} homeColor={n.hc} />
          <StatRow label="Shots" home={hud.shotsH} away={hud.shotsA} homeColor={n.hc} />
          <StatRow label="On target" home={hud.otH} away={hud.otA} homeColor={n.hc} />
          <StatRow label="Fouls" home={hud.foulsH} away={hud.foulsA} homeColor={n.hc} />
        </div>
      )}

      {/* Mini-map */}
      {hud && <MiniMap dots={hud.dots} ball={hud.ball} />}

      {/* Live commentary feed */}
      <div className="pointer-events-none absolute right-3 top-44 bottom-20 hidden w-60 flex-col overflow-hidden md:flex">
        <div className="rounded-t-lg border border-navy-700 bg-navy-950/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-steel-400 backdrop-blur">
          Live Commentary
        </div>
        <div className="flex-1 space-y-1.5 overflow-hidden rounded-b-lg border-x border-b border-navy-700 bg-navy-950/70 p-2 backdrop-blur">
          {feed.map((l) => (
            <div key={l.id} className={`feed-enter flex gap-2 text-[11px] leading-snug ${l.highlight ? 'text-accent-400 font-semibold' : 'text-steel-300'}`}>
              <span className="text-steel-500 w-6 shrink-0 text-right font-mono">{l.minute}'</span>
              <span>{l.text}</span>
            </div>
          ))}
          {feed.length === 0 && <div className="text-steel-600 px-1 text-[11px]">Waiting for kick-off…</div>}
        </div>
      </div>

      {/* Replay indicator */}
      {replaying && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2">
          <div className="animate-pulse rounded bg-danger-500/90 px-4 py-1 text-xs font-black uppercase tracking-[0.3em] text-white">
            ● Replay
          </div>
        </div>
      )}

      {/* Event banner */}
      {banner && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-10 -translate-x-1/2">
          <div className={`rounded-lg px-6 py-2 text-center font-black shadow-lg ${banner.big ? 'bg-accent-500 text-navy-950 text-2xl animate-pulse' : 'bg-navy-900/90 text-white text-sm'}`}>
            {banner.text}
          </div>
        </div>
      )}

      {/* Controls (bottom-right, clear of the broadcast scoreboard) */}
      <div className="absolute bottom-16 right-3 z-10 flex items-center gap-1.5 rounded-xl border border-navy-700 bg-navy-950/85 px-2 py-1.5 backdrop-blur sm:bottom-3 sm:gap-2 sm:px-3 sm:py-2">
        <button className="btn-ghost px-2 py-1.5 sm:px-3" onClick={togglePause}>
          {paused ? '▶' : '⏸'}<span className="hidden md:inline">{paused ? ' Resume' : ' Manage'}</span>
        </button>
        <div className="flex overflow-hidden rounded-lg border border-navy-600">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => changeSpeed(s)} className={`px-2 py-1.5 text-xs font-bold sm:px-2.5 ${speed === s ? 'bg-accent-500 text-navy-950' : 'text-steel-300 hover:bg-navy-800'}`}>
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
        <button className="btn-ghost px-2 py-1.5 capitalize sm:px-3" onClick={cycleCam}>
          📷<span className="hidden md:inline"> {camMode}</span>
        </button>
      </div>

      {/* Match intro: stadium + occasion */}
      {intro && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-navy-950/85 backdrop-blur-sm" style={{ animation: 'screen-in 0.5s ease-out both' }}>
          <div className="text-accent-400 text-xs font-black uppercase tracking-[0.5em] sm:text-sm">
            {occasionRef.current?.roundLabel ?? 'World Cup 2026'}
          </div>
          <div className="mt-4 flex items-center gap-6 text-3xl font-black sm:gap-10 sm:text-5xl">
            <span>{n.hf}</span>
            <span className="text-steel-400 text-xl sm:text-2xl">vs</span>
            <span>{n.af}</span>
          </div>
          <div className="mt-2 text-lg font-bold sm:text-xl">{n.hn} — {n.an}</div>
          {occasionRef.current && (
            <div className="text-steel-400 mt-5 text-sm">
              🏟 {occasionRef.current.stadium} · {occasionRef.current.city}
            </div>
          )}
          <div className="text-steel-500 mt-1 text-xs">{weather}</div>
        </div>
      )}

      {/* Half-time stats overlay */}
      {htStats && hud && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="screen-enter w-72 rounded-xl border border-navy-700 bg-navy-950/92 p-4 shadow-2xl backdrop-blur">
            <div className="text-center text-xs font-black uppercase tracking-[0.3em] text-accent-400">Half-time</div>
            <div className="mt-2 text-center font-mono text-3xl font-black">
              {hud.home} – {hud.away}
            </div>
            <div className="mt-3 space-y-1.5">
              <StatRow label="Possession" home={hud.possHome} away={100 - hud.possHome} homeColor={n.hc} />
              <StatRow label="Shots" home={hud.shotsH} away={hud.shotsA} homeColor={n.hc} />
              <StatRow label="On target" home={hud.otH} away={hud.otA} homeColor={n.hc} />
            </div>
          </div>
        </div>
      )}

      {/* Full-time hold */}
      {ftHold && hud && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-navy-950/80 backdrop-blur-sm">
          <div className="screen-enter text-center">
            <div className="text-accent-400 text-sm font-black uppercase tracking-[0.4em]">Full-time</div>
            <div className="mt-3 flex items-center justify-center gap-4 text-4xl font-black sm:text-5xl">
              <span>{n.hf}</span>
              <span className="rounded-xl bg-navy-900 px-5 py-2 font-mono tabular-nums">
                {hud.home} – {hud.away}
              </span>
              <span>{n.af}</span>
            </div>
            {shootout?.done && (
              <div className="text-steel-300 mt-2 text-sm">({shootout.score.home}–{shootout.score.away} on penalties)</div>
            )}
          </div>
        </div>
      )}

      {/* Penalty shootout */}
      {shootout?.phase === 'pick' && ctrlRef.current && (
        <ShootoutPicker
          candidates={ctrlRef.current.sim.shootoutCandidates(sideRef.current)}
          onConfirm={(order) => {
            ctrlRef.current?.beginShootout(sideRef.current, order)
            setShootout((s) => (s ? { ...s, phase: 'running' } : s))
          }}
        />
      )}
      {shootout?.phase === 'running' && (
        <ShootoutBoard
          kicks={shootout.kicks}
          score={shootout.score}
          done={shootout.done}
          homeFlag={n.hf}
          awayFlag={n.af}
        />
      )}

      {/* Pause / management overlay */}
      {paused && ctrlRef.current && (
        <PauseMenu
          sim={ctrlRef.current.sim}
          side={sideRef.current}
          onAction={() => force((x) => x + 1)}
          onTactic={onTactic}
          onResume={togglePause}
        />
      )}
    </div>
  )
}

/** Manager picks the 5 penalty takers, in order. */
function ShootoutPicker({
  candidates,
  onConfirm,
}: {
  candidates: SimPlayer[]
  onConfirm: (order: string[]) => void
}) {
  const [order, setOrder] = useState<string[]>([])
  const toggle = (id: string) => {
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : o.length < 5 ? [...o, id] : o))
  }
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-navy-950/80 p-4 backdrop-blur-sm">
      <div className="panel max-h-[88vh] w-full max-w-md overflow-y-auto p-5">
        <h2 className="text-lg font-black">Penalty Shootout</h2>
        <p className="text-steel-400 mt-1 text-xs">
          Pick your 5 takers in shooting order. Tap to add, tap again to remove.
        </p>
        <div className="mt-3 space-y-1">
          {candidates.map((p) => {
            const idx = order.indexOf(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                  idx >= 0 ? 'bg-accent-500/20 ring-1 ring-accent-500' : 'hover:bg-navy-800'
                }`}
              >
                <span className={`w-6 text-center font-black ${idx >= 0 ? 'text-accent-400' : 'text-steel-600'}`}>
                  {idx >= 0 ? idx + 1 : '·'}
                </span>
                <span className="text-steel-500 w-6">{p.number}</span>
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-steel-400 text-xs">SHO {p.attrs.shooting}</span>
                <span className="text-steel-500 text-[10px]">ST {Math.round(p.stamina)}%</span>
              </button>
            )
          })}
        </div>
        <button className="btn-primary mt-4 w-full" disabled={order.length !== 5} onClick={() => onConfirm(order)}>
          {order.length === 5 ? 'Begin Shootout →' : `Pick ${5 - order.length} more`}
        </button>
      </div>
    </div>
  )
}

/** Live shootout scoreboard: names, ✓/✗ per kick, running score. */
function ShootoutBoard({
  kicks,
  score,
  done,
  homeFlag,
  awayFlag,
}: {
  kicks: ShootoutKickView[]
  score: { home: number; away: number }
  done: boolean
  homeFlag: string
  awayFlag: string
}) {
  const row = (side: Side) => kicks.filter((k) => k.side === side)
  const slots = Math.max(5, Math.ceil(kicks.length / 2))
  const last = kicks[kicks.length - 1]
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-10 w-[min(94vw,460px)] -translate-x-1/2">
      <div className="rounded-xl border border-navy-700 bg-navy-950/90 p-3 backdrop-blur">
        <div className="text-center text-xs font-bold uppercase tracking-widest text-accent-400">
          {done ? 'Shootout decided' : 'Penalty shootout'}
        </div>
        <div className="mt-2 space-y-1.5">
          {(['home', 'away'] as Side[]).map((side) => (
            <div key={side} className="flex items-center gap-2">
              <span className="w-7 text-lg">{side === 'home' ? homeFlag : awayFlag}</span>
              <span className="w-6 text-center font-mono text-lg font-black">{score[side]}</span>
              <div className="flex flex-1 gap-1.5">
                {Array.from({ length: slots }, (_, i) => {
                  const k = row(side)[i]
                  return (
                    <span
                      key={i}
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black ${
                        !k ? 'bg-navy-800 text-steel-600' : k.scored ? 'bg-accent-500 text-navy-950' : 'bg-danger-500 text-white'
                      }`}
                    >
                      {!k ? '·' : k.scored ? '✓' : '✗'}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {last && (
          <div className="text-steel-300 mt-2 text-center text-xs">
            {last.takerName} — {last.scored ? 'SCORES!' : last.outcome === 'save' ? 'saved!' : 'misses!'}
          </div>
        )}
      </div>
    </div>
  )
}

function snapshot(w: WorldState, hc: string, ac: string): Hud {
  const totalPoss = w.stats.possessionTicks.home + w.stats.possessionTicks.away || 1
  const momTotal = w.momentum.home + w.momentum.away || 1
  return {
    minute: Math.floor(w.timeSec / 60),
    half: w.half,
    home: w.score.home,
    away: w.score.away,
    possHome: Math.round((w.stats.possessionTicks.home / totalPoss) * 100),
    momHome: Math.round((w.momentum.home / momTotal) * 100),
    shotsH: w.stats.shots.home,
    shotsA: w.stats.shots.away,
    otH: w.stats.onTarget.home,
    otA: w.stats.onTarget.away,
    foulsH: w.stats.fouls.home,
    foulsA: w.stats.fouls.away,
    dots: w.players.filter((p) => p.onPitch && !p.red).map((p) => ({ x: p.pos.x, y: p.pos.y, c: p.side === 'home' ? hc : ac })),
    ball: { x: w.ball.pos.x, y: w.ball.pos.y },
  }
}

function MiniMap({ dots, ball }: { dots: { x: number; y: number; c: string }[]; ball: { x: number; y: number } }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = cv.width
    const H = cv.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0c2d18'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.strokeRect(2, 2, W - 4, H - 4)
    ctx.beginPath()
    ctx.moveTo(2, H / 2)
    ctx.lineTo(W - 2, H / 2)
    ctx.stroke()
    const mx = (x: number) => ((x + PITCH.HALF_W) / PITCH.W) * (W - 4) + 2
    const my = (y: number) => ((y + PITCH.HALF_L) / PITCH.L) * (H - 4) + 2
    // players: large team-coloured dots with a dark outline for separation
    for (const d of dots) {
      ctx.fillStyle = d.c
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(mx(d.x), my(d.y), 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    // ball: the brightest, biggest mark on the map
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(mx(ball.x), my(ball.y), 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }, [dots, ball])
  return (
    <div className="absolute right-3 top-3 rounded-xl border border-navy-700 bg-navy-950/80 p-1.5 backdrop-blur">
      <canvas ref={ref} width={128} height={186} className="rounded" />
    </div>
  )
}
