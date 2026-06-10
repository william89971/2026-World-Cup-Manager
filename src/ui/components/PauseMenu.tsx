import { useEffect, useState } from 'react'
import type { MatchSimulation } from '../../engine/sim/MatchSimulation'
import type { Side } from '../../engine/types'
import type { Mentality, Pressing } from '../../data/types'
import { FORMATION_NAMES } from '../../engine/formations'

export default function PauseMenu({
  sim,
  side,
  onAction,
  onTactic,
  onResume,
}: {
  sim: MatchSimulation
  side: Side
  onAction: () => void
  /** Called when a tactical instruction changes (formation/mentality/press/shout). */
  onTactic?: () => void
  onResume: () => void
}) {
  const [outId, setOutId] = useState<string | null>(null)
  const [, refresh] = useState(0)
  // keep fatigue bars live even if the sim advances while the panel is open
  useEffect(() => {
    const t = setInterval(() => refresh((x) => x + 1), 700)
    return () => clearInterval(t)
  }, [])
  const team = side === 'home' ? sim.setup.home : sim.setup.away
  const world = sim.world
  const onPitch = world.players.filter((p) => p.side === side && p.onPitch && !p.red)
  const onPitchIds = new Set(world.players.map((p) => p.id))
  const reserves = Object.values(team.players).filter((rec) => !onPitchIds.has(rec.id))
  const subsLeft = sim.subsRemaining(side)

  const doSub = (inId: string) => {
    if (outId && sim.makeSub(side, outId, inId)) {
      setOutId(null)
      onAction()
    }
  }
  const act = (fn: () => void) => {
    fn()
    onAction()
    onTactic?.()
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-navy-950/70 backdrop-blur-sm">
      <div className="panel max-h-[88vh] w-[760px] max-w-[94vw] overflow-y-auto p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">Touchline Instructions</h2>
          <button className="btn-primary" onClick={onResume}>▶ Resume Match</button>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Substitutions */}
          <div>
            <div className="text-steel-400 mb-1 flex items-center justify-between text-[11px] font-bold uppercase">
              <span>Substitutions</span>
              <span className="text-accent-400">{subsLeft} left</span>
            </div>
            <div className="mb-2 rounded-lg bg-navy-800 p-2">
              <div className="text-steel-500 mb-1 text-[10px] uppercase">On pitch — tap to take off</div>
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
                {onPitch.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setOutId(outId === p.id ? null : p.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs ${outId === p.id ? 'bg-danger-500/30 ring-1 ring-danger-500' : 'hover:bg-navy-700'}`}
                  >
                    <span className="text-steel-500 w-5">{p.number}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <Fatigue value={p.stamina} />
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-navy-800 p-2">
              <div className="text-steel-500 mb-1 text-[10px] uppercase">{outId ? 'Bring on' : 'Select a player to take off first'}</div>
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
                {reserves.map((r) => (
                  <button
                    key={r.id}
                    disabled={!outId || subsLeft <= 0}
                    onClick={() => doSub(r.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-navy-700 disabled:opacity-40"
                  >
                    <span className="text-steel-500 w-5">{r.number}</span>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="text-steel-400">{r.overall}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tactics + shouts */}
          <div className="space-y-4">
            <Group label="Formation">
              <div className="flex flex-wrap gap-1">
                {FORMATION_NAMES.map((f) => (
                  <button
                    key={f}
                    onClick={() => act(() => sim.setFormation(side, f))}
                    className={`rounded px-2 py-1 text-[11px] font-semibold ${team.formationName === f ? 'bg-accent-500 text-navy-950' : 'border border-navy-600 text-steel-300 hover:bg-navy-800'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Group>
            <Group label="Mentality">
              <Seg<Mentality> options={['defensive', 'balanced', 'attacking']} value={team.mentality} onPick={(m) => act(() => sim.setMentality(side, m))} />
            </Group>
            <Group label="Pressing">
              <Seg<Pressing> options={['low', 'medium', 'high']} value={team.pressing} onPick={(p) => act(() => sim.setPressing(side, p))} />
            </Group>
            <Group label="Shout">
              <div className="flex gap-2">
                <button className="btn-ghost flex-1 text-xs" onClick={() => act(() => sim.shout(side, 'push'))}>Push higher</button>
                <button className="btn-ghost flex-1 text-xs" onClick={() => act(() => sim.shout(side, 'direct'))}>Be direct</button>
                <button className="btn-ghost flex-1 text-xs" onClick={() => act(() => sim.shout(side, 'hold'))}>Hold the ball</button>
              </div>
            </Group>
          </div>
        </div>
      </div>
    </div>
  )
}

function Fatigue({ value }: { value: number }) {
  const color = value > 65 ? 'bg-accent-500' : value > 40 ? 'bg-warn-500' : 'bg-danger-500'
  return (
    <span className="flex items-center gap-1">
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-navy-600">
        <span className={`block h-full ${color}`} style={{ width: `${value}%` }} />
      </span>
      <span className="text-steel-500 w-6 text-[10px]">{Math.round(value)}</span>
    </span>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-steel-400 mb-1 text-[11px] font-bold uppercase">{label}</div>
      {children}
    </div>
  )
}

function Seg<T extends string>({ options, value, onPick }: { options: T[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onPick(o)}
          className={`flex-1 rounded px-1 py-1.5 text-[11px] font-semibold capitalize ${value === o ? 'bg-accent-500 text-navy-950' : 'border border-navy-600 text-steel-300 hover:bg-navy-800'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
