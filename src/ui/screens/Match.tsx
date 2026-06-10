import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../store/gameStore'
import { getTeam } from '../../data'
import { MatchController, type SpeedLevel } from '../../match/MatchController'
import type { MatchEvent, Side, WorldState } from '../../engine/types'
import { PITCH } from '../../engine/constants'
import { StatRow } from '../components/common'
import { commentaryFor, TACTICAL_LINES } from '../../data/commentary'
import PauseMenu from '../components/PauseMenu'

interface Hud {
  minute: number
  half: number
  home: number
  away: number
  possHome: number
  shotsH: number
  shotsA: number
  otH: number
  otA: number
  foulsH: number
  foulsA: number
  dots: { x: number; y: number; c: string }[]
  ball: { x: number; y: number }
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
    namesRef.current = {
      hf: getTeam(setup.home.teamId).flag,
      af: getTeam(setup.away.teamId).flag,
      hn: setup.home.teamId,
      an: setup.away.teamId,
      hc: setup.home.kit.primary,
      ac: setup.away.kit.primary,
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
      onFinished: () => {
        const result = ctrl.sim.getResult()
        finishUserMatch(result, ctrl.getReplays())
        setScreen('postmatch')
      },
    })
    ctrlRef.current = ctrl
    setWeather(WEATHER_LABEL[ctrl.renderer.weather])
    ctrl.setSpeed(1)
    ctrl.start()

    const onResize = () => ctrl.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
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

      {/* Top scoreboard */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-950/85 px-3 py-1.5 backdrop-blur sm:gap-3 sm:px-4 sm:py-2">
          <span className="text-lg sm:text-xl">{n.hf}</span>
          <span className="font-mono text-xl font-black tabular-nums sm:text-2xl">
            {hud?.home ?? 0}<span className="text-steel-500 mx-1">:</span>{hud?.away ?? 0}
          </span>
          <span className="text-lg sm:text-xl">{n.af}</span>
          <span className="ml-1 rounded bg-navy-800 px-2 py-0.5 font-mono text-xs text-accent-400 sm:ml-2">{minuteLabel}</span>
        </div>
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

      {/* Bottom controls */}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-navy-700 bg-navy-950/85 px-2 py-1.5 backdrop-blur sm:gap-2 sm:px-3 sm:py-2">
        <button className="btn-ghost px-2 py-1.5 sm:px-3" onClick={togglePause}>
          {paused ? '▶' : '⏸'}<span className="hidden sm:inline">{paused ? ' Resume' : ' Manage'}</span>
        </button>
        <div className="flex overflow-hidden rounded-lg border border-navy-600">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => changeSpeed(s)} className={`px-2 py-1.5 text-xs font-bold sm:px-2.5 ${speed === s ? 'bg-accent-500 text-navy-950' : 'text-steel-300 hover:bg-navy-800'}`}>
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
        <button className="btn-ghost px-2 py-1.5 capitalize sm:px-3" onClick={cycleCam}>
          📷<span className="hidden sm:inline"> {camMode}</span>
        </button>
      </div>

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

function snapshot(w: WorldState, hc: string, ac: string): Hud {
  const totalPoss = w.stats.possessionTicks.home + w.stats.possessionTicks.away || 1
  return {
    minute: Math.floor(w.timeSec / 60),
    half: w.half,
    home: w.score.home,
    away: w.score.away,
    possHome: Math.round((w.stats.possessionTicks.home / totalPoss) * 100),
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
    for (const d of dots) {
      ctx.fillStyle = d.c
      ctx.beginPath()
      ctx.arc(mx(d.x), my(d.y), 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(mx(ball.x), my(ball.y), 1.8, 0, Math.PI * 2)
    ctx.fill()
  }, [dots, ball])
  return (
    <div className="absolute right-3 top-3 rounded-xl border border-navy-700 bg-navy-950/80 p-1.5 backdrop-blur">
      <canvas ref={ref} width={104} height={150} className="rounded" />
    </div>
  )
}
