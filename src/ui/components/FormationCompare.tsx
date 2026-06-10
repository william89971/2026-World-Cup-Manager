import { getFormation } from '../../engine/formations'
import type { Team, TacticalRole, PlayingStyle } from '../../data/types'

type Band = 'defence' | 'midfield' | 'attack'

const BAND_OF: Record<TacticalRole, Band | null> = {
  GK: null,
  CB: 'defence',
  FB: 'defence',
  CDM: 'midfield',
  CM: 'midfield',
  CAM: 'midfield',
  WM: 'midfield',
  Wing: 'attack',
  ST: 'attack',
}

function bandCounts(formationName: string): Record<Band, number> {
  const counts: Record<Band, number> = { defence: 0, midfield: 0, attack: 0 }
  for (const s of getFormation(formationName).slots) {
    const band = BAND_OF[s.role]
    if (band) counts[band]++
  }
  return counts
}

/** One-line tactical read of the matchup. */
function tacticalNote(
  userFormation: string,
  oppFormation: string,
  oppStyle: PlayingStyle,
  user: Record<Band, number>,
  opp: Record<Band, number>,
): string {
  if (oppStyle === 'High-Press')
    return `Their ${oppFormation} will press high — your CDM will be key to bypassing their midfield.`
  if (user.midfield > opp.midfield)
    return `Your ${userFormation} outnumbers their midfield — control the tempo through the centre.`
  if (opp.midfield > user.midfield)
    return `They pack the midfield with their ${oppFormation} — move the ball quickly into wide areas.`
  if (opp.attack > user.defence)
    return `They commit ${opp.attack} forward against your back ${user.defence} — stay compact and hit the space behind.`
  if (oppStyle === 'Counter-Attack')
    return `They sit deep and spring — don't over-commit your fullbacks after losing the ball.`
  return 'An even tactical battle — small margins and set pieces will decide it.'
}

function MiniPitch({ formationName, color, mirrored }: { formationName: string; color: string; mirrored?: boolean }) {
  const slots = getFormation(formationName).slots
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-navy-600 bg-gradient-to-b from-pitch-900 to-pitch-950">
      <div className="absolute left-0 right-0 top-1/2 border-t border-white/10" />
      {slots.map((s, i) => {
        const left = ((s.x + 1) / 2) * 100
        const top = mirrored ? ((s.y + 1) / 2) * 100 : (1 - (s.y + 1) / 2) * 100
        return (
          <span
            key={i}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${left}%`, top: `${top}%`, background: color }}
          />
        )
      })}
    </div>
  )
}

/** Side-by-side formation comparison with band mismatches + an AI read. */
export default function FormationCompare({
  userTeam,
  userFormation,
  oppTeam,
  oppFormation,
}: {
  userTeam: Team
  userFormation: string
  oppTeam: Team
  oppFormation: string
}) {
  const user = bandCounts(userFormation)
  const opp = bandCounts(oppFormation)
  const bands: { key: Band; label: string }[] = [
    { key: 'defence', label: 'DEF' },
    { key: 'midfield', label: 'MID' },
    { key: 'attack', label: 'ATT' },
  ]
  return (
    <div>
      <div className="text-steel-400 mb-2 text-[11px] font-bold uppercase">Tactical Matchup</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-center text-xs font-bold">{userTeam.flag} {userFormation}</div>
          <MiniPitch formationName={userFormation} color={userTeam.kit.primary} />
        </div>
        <div>
          <div className="mb-1 text-center text-xs font-bold">{oppTeam.flag} {oppFormation}</div>
          <MiniPitch formationName={oppFormation} color={oppTeam.kit.primary} mirrored />
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {bands.map((b) => {
          // your attack meets their defence and vice versa; midfield is direct
          const mine = user[b.key]
          const theirs = b.key === 'attack' ? opp.defence : b.key === 'defence' ? opp.attack : opp.midfield
          const diff = mine - theirs
          return (
            <div key={b.key} className="flex items-center gap-2 text-xs">
              <span className="text-steel-500 w-8 font-bold">{b.label}</span>
              <span className="font-mono">{mine}v{theirs}</span>
              {diff > 0 && <span className="rounded bg-accent-500/20 px-1.5 font-bold text-accent-400">+{diff} overload</span>}
              {diff < 0 && <span className="rounded bg-danger-500/20 px-1.5 font-bold text-danger-500">{diff} outnumbered</span>}
              {diff === 0 && <span className="text-steel-600">even</span>}
            </div>
          )
        })}
      </div>
      <p className="text-steel-300 mt-2 rounded-md bg-navy-800 p-2 text-xs leading-snug">
        💡 {tacticalNote(userFormation, oppFormation, oppTeam.style, user, opp)}
      </p>
    </div>
  )
}
