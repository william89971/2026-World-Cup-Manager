export type Tone = 'positive' | 'neutral' | 'deflect'

export interface PressOption {
  tone: Tone
  label: string
  /** Applied to the whole squad's morale. */
  morale: number
  /** Applied to the manager's media reputation. */
  reputation: number
}

export interface PressQuestion {
  id: string
  text: string
  options: PressOption[]
}

export interface PressContext {
  won: boolean
  drew: boolean
  lost: boolean
  starName?: string
  poorName?: string
  opponentName?: string
  scoreline: string
}

type Template = (c: PressContext) => PressQuestion | null

const O = (tone: Tone, label: string, morale: number, reputation: number): PressOption => ({ tone, label, morale, reputation })

const TEMPLATES: Template[] = [
  (c) => ({
    id: 'result',
    text: c.won
      ? `A convincing ${c.scoreline}. Are you happy with the performance?`
      : c.drew
        ? `A ${c.scoreline} draw — two points dropped or one gained?`
        : `A disappointing ${c.scoreline}. What went wrong out there?`,
    options: c.lost
      ? [
          O('positive', 'We will bounce back — I believe in these players.', 4, 1),
          O('neutral', 'We made mistakes and we will review them honestly.', 0, 2),
          O('deflect', 'The officials made it very difficult for us today.', -2, -3),
        ]
      : [
          O('positive', 'Delighted — the boys were outstanding.', 5, 2),
          O('neutral', 'Job done, but there is plenty to work on.', 1, 1),
          O('deflect', "Let's not get carried away, it's one game.", -1, 0),
        ],
  }),
  (c) =>
    c.starName
      ? {
          id: 'star',
          text: `How do you rate ${c.starName} after that display?`,
          options: [
            O('positive', `World class. ${c.starName} is our talisman.`, 5, 1),
            O('neutral', `Solid. ${c.starName} did the job asked of him.`, 1, 1),
            O('deflect', 'Football is a team game, I single out no one.', 0, 2),
          ],
        }
      : null,
  (c) =>
    c.poorName
      ? {
          id: 'poor',
          text: `${c.poorName} struggled today. Is his place under threat?`,
          options: [
            O('positive', `Not at all — ${c.poorName} has my full backing.`, 4, 0),
            O('neutral', 'Everyone is being assessed, him included.', -1, 1),
            O('deflect', "I won't discuss individuals in public.", 0, 2),
          ],
        }
      : null,
  (c) =>
    c.opponentName
      ? {
          id: 'next',
          text: `${c.opponentName} are next. How do you approach it?`,
          options: [
            O('positive', 'We fear no one. We go there to win.', 4, 0),
            O('neutral', 'A tough game — we will prepare properly.', 1, 1),
            O('deflect', 'I only focus on ourselves, not the opponent.', 0, 1),
          ],
        }
      : null,
  () => ({
    id: 'pressure',
    text: 'The expectations on this squad are huge. Does that weigh on you?',
    options: [
      O('positive', 'Pressure is a privilege. We embrace it.', 3, 2),
      O('neutral', 'We take it one match at a time.', 1, 1),
      O('deflect', "I don't read what the media writes.", -1, -1),
    ],
  }),
  () => ({
    id: 'morale',
    text: 'How is the mood inside the camp right now?',
    options: [
      O('positive', 'Spirits are sky-high — a brilliant group.', 4, 1),
      O('neutral', 'Focused and professional, as always.', 1, 0),
      O('deflect', 'What happens in the dressing room stays there.', 0, 1),
    ],
  }),
]

/** Pick 3 distinct, applicable questions for the conference. */
export function generatePressConference(c: PressContext): PressQuestion[] {
  const qs = TEMPLATES.map((t) => t(c)).filter((q): q is PressQuestion => q !== null)
  // shuffle
  for (let i = qs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[qs[i], qs[j]] = [qs[j], qs[i]]
  }
  // ensure the result question is always first if present
  const result = qs.find((q) => q.id === 'result')
  const rest = qs.filter((q) => q.id !== 'result')
  return [result, ...rest].filter(Boolean).slice(0, 3) as PressQuestion[]
}
