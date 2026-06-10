import { useState } from 'react'
import type { DragEvent } from 'react'
import type { Mentality, Pressing, Tactics, Team } from '../../data/types'
import { FORMATION_NAMES, getFormation } from '../../engine/formations'
import { PosBadge, FormArrow } from './common'
import { useGame } from '../../store/gameStore'
import { formOf } from '../../game/career'

interface Props {
  team: Team
  value: Tactics
  available: Set<string>
  onChange: (t: Tactics) => void
}

export default function TacticsEditor({ team, value, available, onChange }: Props) {
  const [selSlot, setSelSlot] = useState<number | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const career = useGame((s) => s.career)
  const byId = (id: string) => team.squad.find((p) => p.id === id)!
  const slots = getFormation(value.formationName).slots

  const setFormation = (name: string) => onChange({ ...value, formationName: name })
  const reserves = team.squad.filter((p) => !value.starters.includes(p.id))

  const swapIntoSlot = (slotIdx: number, playerId: string) => {
    const starters = [...value.starters]
    const existing = starters.indexOf(playerId)
    if (existing >= 0) {
      // swapping two starters
      ;[starters[slotIdx], starters[existing]] = [starters[existing], starters[slotIdx]]
    } else {
      starters[slotIdx] = playerId
    }
    // re-point any set-piece taker who just left the XI at the best shooter
    const inXI = new Set(starters)
    const fallback = [...starters].sort((a, b) => byId(b).attributes.shooting - byId(a).attributes.shooting)[0]
    const setPieces = { ...value.setPieces }
    for (const k of ['corners', 'freeKicks', 'penalties'] as const) {
      if (!inXI.has(setPieces[k])) setPieces[k] = fallback
    }
    onChange({ ...value, starters, setPieces })
    setSelSlot(null)
  }

  // ── drag & drop (works alongside tap-to-swap) ──────────────────
  const onDragStart = (e: DragEvent, playerId: string) => {
    e.dataTransfer.setData('text/plain', playerId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onSlotDragOver = (e: DragEvent, i: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverSlot !== i) setDragOverSlot(i)
  }
  const onSlotDrop = (e: DragEvent, i: number) => {
    e.preventDefault()
    setDragOverSlot(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id || !team.squad.some((p) => p.id === id)) return
    if (!value.starters.includes(id) && !available.has(id)) return // injured/suspended reserve
    swapIntoSlot(i, id)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Pitch + formation */}
      <div>
        <div className="mb-2 flex flex-wrap gap-1">
          {FORMATION_NAMES.map((f) => (
            <button
              key={f}
              onClick={() => setFormation(f)}
              className={`rounded px-2.5 py-1 text-xs font-semibold ${value.formationName === f ? 'bg-accent-500 text-navy-950' : 'border border-navy-600 text-steel-300 hover:bg-navy-800'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative mx-auto aspect-[2/3] w-full max-w-[300px] overflow-hidden rounded-lg border border-navy-600 bg-gradient-to-b from-pitch-900 to-pitch-950">
          <div className="absolute left-0 right-0 top-1/2 border-t border-white/15" />
          <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
          {slots.map((slot, i) => {
            const pid = value.starters[i]
            const p = pid ? byId(pid) : undefined
            const left = ((slot.x + 1) / 2) * 100
            const top = (1 - (slot.y + 1) / 2) * 100
            const sel = selSlot === i
            const over = dragOverSlot === i
            return (
              <button
                key={i}
                draggable
                onDragStart={(e) => pid && onDragStart(e, pid)}
                onDragOver={(e) => onSlotDragOver(e, i)}
                onDragLeave={() => dragOverSlot === i && setDragOverSlot(null)}
                onDrop={(e) => onSlotDrop(e, i)}
                onClick={() => (selSlot === null ? setSelSlot(i) : swapIntoSlot(i, value.starters[selSlot]))}
                style={{ left: `${left}%`, top: `${top}%` }}
                className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center rounded-full text-[9px] font-bold leading-none transition-transform active:cursor-grabbing ${
                  sel
                    ? 'scale-125 bg-accent-500 text-navy-950 ring-2 ring-white'
                    : over
                      ? 'scale-125 bg-navy-600 text-white ring-2 ring-accent-400'
                      : 'bg-navy-700 text-white hover:bg-navy-600'
                }`}
                title={p?.name}
              >
                <span className="text-[11px]">{p?.number}</span>
                <span className="max-w-[34px] truncate">{p?.name.split(' ').slice(-1)[0]}</span>
              </button>
            )
          })}
        </div>
        <p className="text-steel-500 mt-2 text-center text-[11px]">
          {selSlot === null ? 'Drag players between positions, or tap a position then a reserve.' : 'Now tap a reserve or another position.'}
        </p>
      </div>

      {/* Controls + reserves */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Choice<Mentality> label="Mentality" value={value.mentality} options={['defensive', 'balanced', 'attacking']} onChange={(m) => onChange({ ...value, mentality: m })} />
          <Choice<Pressing> label="Pressing" value={value.pressing} options={['low', 'medium', 'high']} onChange={(p) => onChange({ ...value, pressing: p })} />
        </div>

        <div>
          <div className="text-steel-400 mb-1 text-[11px] font-bold uppercase">Set-piece takers</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Taker label="Corners" ids={value.starters} team={team} value={value.setPieces.corners} onChange={(id) => onChange({ ...value, setPieces: { ...value.setPieces, corners: id } })} />
            <Taker label="Free kicks" ids={value.starters} team={team} value={value.setPieces.freeKicks} onChange={(id) => onChange({ ...value, setPieces: { ...value.setPieces, freeKicks: id } })} />
            <Taker label="Penalties" ids={value.starters} team={team} value={value.setPieces.penalties} onChange={(id) => onChange({ ...value, setPieces: { ...value.setPieces, penalties: id } })} />
          </div>
        </div>

        <div>
          <div className="text-steel-400 mb-1 text-[11px] font-bold uppercase">Reserves</div>
          <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {reserves.map((p) => {
              const avail = available.has(p.id)
              return (
                <button
                  key={p.id}
                  disabled={!avail || selSlot === null}
                  draggable={avail}
                  onDragStart={(e) => onDragStart(e, p.id)}
                  onClick={() => selSlot !== null && swapIntoSlot(selSlot, p.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs ${
                    !avail ? 'opacity-40' : selSlot !== null ? 'hover:bg-navy-700' : 'cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <PosBadge group={p.group} />
                  <span className="text-steel-500 w-5">{p.number}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <FormArrow form={formOf(career[p.id])} />
                  <span className="text-steel-400">{p.overall}</span>
                  {!avail && <span className="text-danger-500 text-[10px]">OUT</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="text-steel-400 mb-1 text-[11px] font-bold uppercase">{label}</div>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`flex-1 rounded px-1 py-1.5 text-[11px] font-semibold capitalize ${value === o ? 'bg-accent-500 text-navy-950' : 'border border-navy-600 text-steel-300 hover:bg-navy-800'}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Taker({ label, ids, team, value, onChange }: { label: string; ids: string[]; team: Team; value: string; onChange: (id: string) => void }) {
  return (
    <label className="block">
      <span className="text-steel-500 text-[10px]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-0.5 w-full rounded-md border border-navy-600 bg-navy-800 px-1 py-1 text-xs">
        {ids.map((id) => {
          const p = team.squad.find((x) => x.id === id)!
          return <option key={id} value={id}>{p.name}</option>
        })}
      </select>
    </label>
  )
}
