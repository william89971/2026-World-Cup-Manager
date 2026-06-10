// ─────────────────────────────────────────────────────────────────────────
// Live commentary lines for the in-match feed. Pure data + a picker — no
// React, no engine imports beyond types.
// ─────────────────────────────────────────────────────────────────────────
import type { MatchEvent } from '../engine/types'

export interface CommentaryContext {
  /** Display name of the team the event belongs to (event.side). */
  teamName: string
  /** Display name of the other team. */
  oppName: string
  score: { home: number; away: number }
  minute: number
}

type Tone = 'normal' | 'tense' | 'dominant'

/** {p} = player, {p2} = secondary player, {team} = event team, {opp} = other team */
type LineSet = Partial<Record<Tone, string[]>> & { normal: string[] }

const LINES: Partial<Record<MatchEvent['type'], LineSet>> = {
  kickoff: {
    normal: [
      'And we are under way!',
      'The referee blows the whistle and {team} get us started.',
      'Kick-off! The atmosphere here is electric.',
      'Here we go — 90 minutes of World Cup football ahead.',
    ],
  },
  goal: {
    normal: [
      'GOAL! {p} finds the net for {team}!',
      'It’s in! {p} makes no mistake — {team} celebrate!',
      'GOAL! A clinical finish from {p}!',
      '{p} scores! The {team} bench erupts!',
      'What a moment for {p} — {team} have their goal!',
    ],
    tense: [
      'GOAL! {p} scores — and this match has come alive!',
      'UNBELIEVABLE! {p} strikes at the perfect moment for {team}!',
      'GOAL! {p} with a priceless strike — the tension is unbearable!',
      'They’ve done it! {p} delivers when it matters most!',
    ],
    dominant: [
      'Another one! {p} adds to the rout for {team}.',
      'It’s a procession now — {p} piles on the misery for {opp}.',
      'GOAL! {p} again — {team} are simply relentless today.',
      '{p} helps himself — this is turning into a statement win for {team}.',
    ],
  },
  yellow: {
    normal: [
      'The referee reaches for his pocket — {p} goes into the book.',
      'Yellow card for {p}. A needless one, you’d say.',
      '{p} is cautioned after that challenge.',
      'A booking for {p} — he’ll have to be careful now.',
    ],
    tense: [
      'Yellow for {p} — nerves are clearly fraying out there.',
      '{p} is booked. The pressure is starting to tell.',
      'A rash challenge from {p} earns a caution — tempers rising here.',
    ],
  },
  red: {
    normal: [
      'RED CARD! {p} is off! {team} are down to ten men!',
      'He’s sent him off! {p} can have no complaints.',
      'Disaster for {team} — {p} sees red and the long walk begins.',
      'A moment of madness from {p} — and the referee shows him the red card!',
    ],
  },
  save: {
    normal: [
      'Brilliant save by {p}!',
      '{p} gets down well and turns it away.',
      'Denied! {p} stands tall for {team}.',
      'What a stop from {p} — top-class goalkeeping!',
    ],
    tense: [
      'SAVE! {p} keeps {team} alive with that one!',
      'Heroics from {p}! That could be worth a goal at the other end.',
      'How has he kept that out?! {p} with a save for the ages!',
    ],
  },
  bigchance: {
    normal: [
      'Big chance — {p} winds up from a dangerous position…',
      '{p} shoots — this looks promising!',
      'Space opens up for {p}…',
    ],
    tense: [
      '{p} with a sight of goal — hearts in mouths here…',
      'A huge opening for {p} at a crucial stage…',
    ],
  },
  penalty: {
    normal: [
      'PENALTY to {team}! The referee points to the spot!',
      'It’s a penalty! A golden chance for {team}!',
      'The whistle goes — penalty for {team}!',
    ],
  },
  corner: {
    normal: [
      'Corner to {team} — bodies forward in the box.',
      '{team} swing it in from the flag…',
      'A chance to deliver here for {team}.',
    ],
  },
  freekick: {
    normal: [
      'Free kick to {team} in a useful area.',
      '{team} have a set piece to work with.',
      'The wall is being organised — free kick {team}.',
    ],
  },
  foul: {
    normal: [
      'A foul by {p} — {p2} was clattered there.',
      '{p} catches {p2} late and the referee spots it.',
      'Play stops — {p} with the infringement.',
    ],
  },
  halftime: {
    normal: [
      'The referee brings the first half to a close.',
      'Half-time. Plenty for both managers to chew over.',
      'That’s the interval — time to regroup.',
    ],
    tense: ['Half-time — this one is beautifully poised.'],
    dominant: ['Half-time, and it’s been one-way traffic so far.'],
  },
  fulltime: {
    normal: [
      'The final whistle goes!',
      'Full-time! That’s how it ends.',
      'It’s all over here.',
    ],
    tense: ['Full-time! Barely a breath between these two sides all game.'],
    dominant: ['Full-time — an emphatic statement from the winners today.'],
  },
  sub: {
    normal: [
      'A change for {team}: {p2} replaces {p}.',
      '{p} makes way — {p2} comes on for {team}.',
      'Fresh legs for {team} as {p2} enters the fray for {p}.',
    ],
  },
  tackle: {
    normal: [
      'Strong challenge from {p} — won cleanly.',
      '{p} times the tackle perfectly.',
      'Possession turned over — fine defending by {p}.',
    ],
  },
  interception: {
    normal: [
      '{p} reads it and cuts out the danger.',
      'Intercepted — {p} was alert to it.',
    ],
  },
}

/** Custom feed lines for manager actions (no engine event exists for these). */
export const TACTICAL_LINES = [
  'A tactical switch from the bench — the shape is changing.',
  'Instructions are being barked from the touchline.',
  'The manager has seen enough — a change of approach for his side.',
  'A reshuffle in the dugout: new orders are going out.',
]

function tone(ctx: CommentaryContext): Tone {
  const diff = Math.abs(ctx.score.home - ctx.score.away)
  if (diff >= 3) return 'dominant'
  if (diff <= 1 && ctx.minute >= 70) return 'tense'
  return 'normal'
}

/** Pick a varied commentary line for an event, or null for uncovered types. */
export function commentaryFor(
  ev: MatchEvent,
  ctx: CommentaryContext,
  rand: () => number = Math.random,
): string | null {
  const set = LINES[ev.type]
  if (!set) return null
  // routine events only occasionally make the feed, to avoid spam
  if ((ev.type === 'tackle' || ev.type === 'interception') && rand() > 0.06) return null
  if ((ev.type === 'foul' || ev.type === 'freekick') && rand() > 0.2) return null
  const pool = set[tone(ctx)] ?? set.normal
  const line = pool[Math.floor(rand() * pool.length)] ?? set.normal[0]
  return line
    .replaceAll('{p}', ev.playerName ?? 'the man in possession')
    .replaceAll('{p2}', ev.secondaryName ?? 'his opponent')
    .replaceAll('{team}', ctx.teamName)
    .replaceAll('{opp}', ctx.oppName)
}
