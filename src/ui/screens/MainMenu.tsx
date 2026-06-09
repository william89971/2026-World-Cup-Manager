import { useState } from 'react'
import { useGame } from '../../store/gameStore'
import { GROUPS } from '../../data/draw2026'
import { TEAMS } from '../../data'
import { DIFFICULTIES } from '../../game/difficulty'
import type { Difficulty } from '../../data/types'

export default function MainMenu() {
  const newGame = useGame((s) => s.newGame)
  const [selected, setSelected] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('Professional')

  return (
    <div className="flex h-full flex-col">
      <div className="px-8 pt-8 pb-4 text-center">
        <div className="text-accent-500 text-xs font-bold uppercase tracking-[0.4em]">FIFA World Cup</div>
        <h1 className="mt-1 text-5xl font-black tracking-tight">
          MANAGER <span className="text-accent-500">2026</span>
        </h1>
        <p className="text-steel-400 mt-2 text-sm">Choose your nation. 48 teams. One trophy.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {GROUPS.map((g) => (
            <div key={g.id} className="panel p-3">
              <div className="text-steel-400 mb-2 text-[11px] font-bold uppercase">Group {g.id}</div>
              <div className="space-y-1">
                {g.teams.map((tid) => {
                  const t = TEAMS[tid]
                  const sel = selected === tid
                  return (
                    <button
                      key={tid}
                      onClick={() => setSelected(tid)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        sel ? 'bg-accent-500 text-navy-950 font-bold' : 'hover:bg-navy-800'
                      }`}
                    >
                      <span className="text-base">{t.flag}</span>
                      <span className="flex-1 truncate">{t.name}</span>
                      <span className={`text-xs ${sel ? 'text-navy-900' : 'text-steel-400'}`}>{t.overall}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-navy-700 bg-navy-900/60 px-8 py-4">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div>
            <div className="text-steel-400 mb-1 text-[11px] font-bold uppercase">Difficulty</div>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    difficulty === d ? 'bg-accent-500 text-navy-950' : 'border border-navy-600 text-steel-300 hover:bg-navy-800'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {selected && (
              <div className="text-right">
                <div className="text-lg font-bold">
                  {TEAMS[selected].flag} {TEAMS[selected].name}
                </div>
                <div className="text-steel-400 text-xs">
                  {TEAMS[selected].style} · OVR {TEAMS[selected].overall}
                </div>
              </div>
            )}
            <button disabled={!selected} className="btn-primary px-8 py-3 text-base" onClick={() => selected && newGame(selected, difficulty)}>
              Start Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
