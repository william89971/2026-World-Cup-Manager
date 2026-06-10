import { useGame } from '../../store/gameStore'
import { getTeam, TEAMS } from '../../data'
import { archetypeOf, ARCHETYPE_LABEL } from '../../data/archetypes'
import { formOf, formRating } from '../../game/career'
import { FormArrow, MoraleBar, Pill, ratingColor } from './common'
import type { Attributes } from '../../data/types'

const AXES: { key: keyof Attributes; label: string }[] = [
  { key: 'pace', label: 'PAC' },
  { key: 'shooting', label: 'SHO' },
  { key: 'passing', label: 'PAS' },
  { key: 'dribbling', label: 'DRI' },
  { key: 'defending', label: 'DEF' },
  { key: 'physicality', label: 'PHY' },
]

/** SVG hexagon radar of the six attributes. */
function AttributeHexagon({ attrs }: { attrs: Attributes }) {
  const size = 180
  const c = size / 2
  const r = size / 2 - 26
  const point = (i: number, value: number) => {
    const ang = (i / 6) * Math.PI * 2 - Math.PI / 2
    const rad = (value / 99) * r
    return [c + Math.cos(ang) * rad, c + Math.sin(ang) * rad] as const
  }
  const ring = (frac: number) =>
    AXES.map((_, i) => point(i, 99 * frac).join(',')).join(' ')
  const poly = AXES.map((a, i) => point(i, attrs[a.key]).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-44">
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = point(i, 99)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" />
      })}
      <polygon points={poly} fill="rgba(24,217,107,0.25)" stroke="#18d96b" strokeWidth="2" strokeLinejoin="round" />
      {AXES.map((a, i) => {
        const [x, y] = point(i, 99 * 1.22)
        return (
          <text key={a.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="#6b7a93">
            {a.label} {attrs[a.key]}
          </text>
        )
      })}
    </svg>
  )
}

/** Slide-up player detail modal. Opens from any screen via setInspectPlayer. */
export default function PlayerCard() {
  const id = useGame((s) => s.inspectPlayerId)
  const setInspect = useGame((s) => s.setInspectPlayer)
  const career = useGame((s) => s.career)
  const tournament = useGame((s) => s.tournament)

  if (!id) return null
  const c = career[id]
  const teamId = c?.teamId ?? Object.values(TEAMS).find((t) => t.squad.some((p) => p.id === id))?.id
  if (!teamId) return null
  const team = getTeam(teamId)
  const player = team.squad.find((p) => p.id === id)
  if (!player) return null

  const form = formOf(c)
  const formAvg = formRating(c)
  const archetype = archetypeOf(player.attributes)

  // morale reason: explicit note, else team-context fallback
  const teamResults = tournament.fixtures
    .filter((f) => f.played && f.result && (f.homeId === teamId || f.awayId === teamId))
    .slice(-3)
  const teamWins = teamResults.filter((f) => f.result!.winnerId === teamId).length
  const moraleReason =
    c?.moraleNote ??
    (teamResults.length >= 2 && teamWins === 0
      ? 'Team on a poor run'
      : teamResults.length >= 2 && teamWins === teamResults.length
        ? 'Team winning run'
        : 'Settled in camp')

  const status =
    (c?.injuredMatches ?? 0) > 0 ? (
      <Pill tone="danger">Injured — out {c!.injuredMatches} match{c!.injuredMatches > 1 ? 'es' : ''}</Pill>
    ) : (c?.suspendedMatches ?? 0) > 0 ? (
      <Pill tone="warn">Suspended — {c!.suspendedMatches} match{c!.suspendedMatches > 1 ? 'es' : ''}</Pill>
    ) : (c?.yellowAccrued ?? 0) > 0 ? (
      <Pill tone="warn">1 yellow from a ban</Pill>
    ) : (
      <Pill tone="ok">Available</Pill>
    )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/70 backdrop-blur-sm sm:items-center" onClick={() => setInspect(null)}>
      <div
        className="panel slide-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{team.flag}</span>
            <div>
              <div className="text-lg font-black leading-tight">
                {player.name} {player.star && <span className="text-warn-500">★</span>}
              </div>
              <div className="text-steel-400 text-xs">
                {player.position} · {player.age} yrs · {team.name} · OVR <span className="font-bold text-white">{player.overall}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Pill>{ARCHETYPE_LABEL[archetype]}</Pill>
                {status}
              </div>
            </div>
          </div>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setInspect(null)}>✕</button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* attribute hexagon */}
          <div>
            <AttributeHexagon attrs={player.attributes} />
          </div>

          <div className="space-y-4">
            {/* morale */}
            <div>
              <div className="text-steel-400 mb-1 text-[11px] font-bold uppercase">Morale</div>
              <div className="flex items-center gap-2">
                <div className="flex-1"><MoraleBar value={c?.morale ?? 70} /></div>
                <span className="text-sm font-bold">{Math.round(c?.morale ?? 70)}</span>
              </div>
              <div className="text-steel-500 mt-1 text-xs">{moraleReason}</div>
            </div>

            {/* form */}
            <div>
              <div className="text-steel-400 mb-1 flex items-center gap-2 text-[11px] font-bold uppercase">
                Form <FormArrow form={form} />
                {formAvg !== null && <span className="text-steel-500 normal-case">avg {formAvg.toFixed(1)}</span>}
              </div>
              {c && c.recentRatings.length > 0 ? (
                <div className="space-y-1">
                  {[...c.recentRatings].reverse().map((r, i) => {
                    const opp = TEAMS[r.oppId]
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className={`w-9 text-center font-black ${ratingColor(r.rating)}`}>{r.rating.toFixed(1)}</span>
                        <span className="text-steel-400 text-xs">vs {opp ? `${opp.flag} ${opp.name}` : r.oppId}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-steel-600 text-xs">No appearances yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* tournament stats */}
        <div className="mt-4 grid grid-cols-5 gap-2 text-center">
          <StatCell label="Goals" value={c?.goals ?? 0} />
          <StatCell label="Assists" value={c?.assists ?? 0} />
          <StatCell label="Apps" value={c?.apps ?? 0} />
          <StatCell label="Minutes" value={c?.minutes ?? 0} />
          <StatCell label="Yellows" value={c?.yellows ?? 0} />
        </div>
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-navy-800 py-2">
      <div className="text-lg font-black">{value}</div>
      <div className="text-steel-400 text-[10px] uppercase">{label}</div>
    </div>
  )
}
