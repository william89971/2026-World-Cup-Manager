// Player personality archetypes — derived from each player's dominant
// attribute. Archetypes change how players move, receive and decide in the
// match engine, on top of raw attribute effects. Pure data, no engine imports.
import type { Attributes } from './types'

export type Archetype =
  | 'speedster' // pace 85+: runs in behind, direct, less patient
  | 'playmaker' // passing 85+: holds the ball, hunts the killer pass
  | 'targetman' // physicality 85+ & shooting 75+: holds up, lays off, wins headers
  | 'dribbler' // dribbling 85+: takes players on, draws fouls, cuts inside
  | 'workhorse' // physicality 85+ & pace 75+: presses hardest, box-to-box
  | 'balanced'

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  speedster: 'Speedster',
  playmaker: 'Playmaker',
  targetman: 'Target Man',
  dribbler: 'Dribbler',
  workhorse: 'Workhorse',
  balanced: 'Balanced',
}

/** One primary archetype per player: qualifying archetypes compete on the
 *  strength of their key attribute, the most dominant wins. */
export function archetypeOf(attrs: Attributes): Archetype {
  const candidates: { type: Archetype; key: number }[] = []
  if (attrs.pace >= 85) candidates.push({ type: 'speedster', key: attrs.pace })
  if (attrs.passing >= 85) candidates.push({ type: 'playmaker', key: attrs.passing })
  if (attrs.dribbling >= 85) candidates.push({ type: 'dribbler', key: attrs.dribbling })
  if (attrs.physicality >= 85 && attrs.shooting >= 75)
    candidates.push({ type: 'targetman', key: attrs.physicality + attrs.shooting * 0.3 })
  if (attrs.physicality >= 85 && attrs.pace >= 75)
    candidates.push({ type: 'workhorse', key: attrs.physicality + attrs.pace * 0.3 })
  if (candidates.length === 0) return 'balanced'
  candidates.sort((a, b) => b.key - a.key)
  return candidates[0].type
}
