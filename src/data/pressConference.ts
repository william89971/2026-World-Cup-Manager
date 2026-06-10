// Context-aware post-match press conferences. Questions are generated from
// what actually happened — the result, who scored, the group situation,
// discipline risks — with the full context passed in as parameters.
// Pure data + generation, no React, no store imports.

export type PressTone = 'positive' | 'deflect' | 'critical'

export interface PressOption {
  tone: PressTone
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

export interface PressMatchContext {
  won: boolean
  drew: boolean
  lost: boolean
  scoreline: string // e.g. "4-0" from the user's perspective
  margin: number // user goals minus opponent goals
  oppName: string
  /** Opponent was rated clearly above / below the user's side. */
  oppStronger: boolean
  oppWeaker: boolean
  /** User-squad scorers in this match with their goal counts. */
  userScorers: { name: string; goals: number }[]
  /** True if the user currently tops their group (group stage only). */
  topOfGroup: boolean
  groupStage: boolean
  roundLabel: string
  /** A user player sitting one yellow from suspension, if any. */
  disciplineRisk?: string
  nextOppName?: string
  starName?: string
  poorName?: string
  /** Manager reputation 0–100 — shapes how hostile the room is. */
  reputation: number
}

const O = (tone: PressTone, label: string, morale: number, reputation: number): PressOption => ({
  tone,
  label,
  morale,
  reputation,
})

/** Reputation shapes the room: a trusted boss gets warmer responses land
 *  better; a manager under fire pays more for snapping at the press. */
function tuneOptions(options: PressOption[], reputation: number): PressOption[] {
  return options.map((o) => {
    let morale = o.morale
    let rep = o.reputation
    if (reputation >= 70 && o.tone === 'positive') morale += 1
    if (reputation < 40 && o.tone === 'critical') {
      morale -= 1
      rep -= 1
    }
    return { ...o, morale, reputation: rep }
  })
}

type Template = (c: PressMatchContext) => PressQuestion | null

const TEMPLATES: Template[] = [
  // ── the result, framed by how it actually went ────────────────
  (c) => {
    if (c.won && c.margin >= 3)
      return {
        id: 'result',
        text: `That was a dominant ${c.scoreline} performance — what's the secret?`,
        options: [
          O('positive', 'The players executed the plan perfectly. All credit to them.', 5, 2),
          O('deflect', "One game. We'll enjoy tonight and reset tomorrow.", 1, 1),
          O('critical', 'Honestly? We should have scored more.', -2, 1),
        ],
      }
    if (c.lost && c.oppWeaker)
      return {
        id: 'result',
        text: `Losing ${c.scoreline} to ${c.oppName}… some will say this is a crisis. How do you respond?`,
        options: [
          O('positive', 'No crisis. I trust this group completely and we will respond.', 4, 0),
          O('deflect', 'Crisis is your word, not mine. Next question.', 0, -2),
          O('critical', 'They should be embarrassed by that. I expect a reaction.', -4, 2),
        ],
      }
    if (c.lost && c.oppStronger)
      return {
        id: 'result',
        text: `${c.oppName} were favourites, but ${c.scoreline} still stings. What did you learn?`,
        options: [
          O('positive', 'We matched a top side for long spells. The margins were tiny.', 3, 1),
          O('deflect', "I won't dissect it in public. We review behind closed doors.", 0, 1),
          O('critical', 'That level is where we want to be — and today we fell short.', -2, 2),
        ],
      }
    if (c.drew)
      return {
        id: 'result',
        text: `A ${c.scoreline} draw with ${c.oppName} — two points dropped or one gained?`,
        options: [
          O('positive', 'A fair point against a good side. We move on stronger.', 3, 1),
          O('deflect', "I don't deal in hypotheticals. The table will tell us.", 0, 1),
          O('critical', 'Dropped. We had the chances and lacked the killer touch.', -2, 2),
        ],
      }
    return {
      id: 'result',
      text: `A ${c.scoreline} win over ${c.oppName}. Happy with the performance?`,
      options: [
        O('positive', 'Delighted. The boys were outstanding from minute one.', 5, 2),
        O('deflect', "Job done. There's plenty still to work on.", 1, 1),
        O('critical', 'We won, but parts of that performance worried me.', -2, 1),
      ],
    }
  },
  // ── a player who scored 2+ ────────────────────────────────────
  (c) => {
    const hot = c.userScorers.find((s) => s.goals >= 2)
    if (!hot) return null
    return {
      id: 'hotscorer',
      text: `${hot.name} scored ${hot.goals === 2 ? 'twice' : `${hot.goals} times`} today. Can he be your tournament player?`,
      options: [
        O('positive', `${hot.name} is world class — and there's more to come.`, 5, 1),
        O('deflect', 'He scores, but eleven players won us that match.', 1, 2),
        O('critical', "Let's see him do it when it really matters first.", -3, 0),
      ],
    }
  },
  // ── group situation ───────────────────────────────────────────
  (c) =>
    c.groupStage && c.topOfGroup
      ? {
          id: 'group',
          text: 'Top of the group. Are you already thinking about the knockout draw?',
          options: [
            O('positive', 'We believe we can beat anyone we meet. Bring it on.', 4, 1),
            O('deflect', 'One match at a time — anything else is noise.', 1, 1),
            O('critical', 'Top of the group means nothing if we get sloppy now.', -1, 1),
          ],
        }
      : null,
  // ── discipline worry ──────────────────────────────────────────
  (c) =>
    c.disciplineRisk
      ? {
          id: 'discipline',
          text: `${c.disciplineRisk} is one booking from a suspension. Are you worried about his discipline?`,
          options: [
            O('positive', `${c.disciplineRisk} is experienced enough to manage it.`, 3, 1),
            O('deflect', "Squad selection is my problem, not the media's.", 0, 1),
            O('critical', "He's been warned. One more silly foul and he sits.", -2, 2),
          ],
        }
      : null,
  // ── star / struggler ──────────────────────────────────────────
  (c) =>
    c.starName
      ? {
          id: 'star',
          text: `How do you rate ${c.starName} after that display?`,
          options: [
            O('positive', `World class. ${c.starName} is our heartbeat.`, 4, 1),
            O('deflect', 'Football is a team game. I single out no one.', 1, 2),
            O('critical', 'Good — but I demand that level every single match.', -1, 1),
          ],
        }
      : null,
  (c) =>
    c.poorName
      ? {
          id: 'poor',
          text: `${c.poorName} struggled today. Is his place under threat?`,
          options: [
            O('positive', `${c.poorName} has my full backing. Form is temporary.`, 4, 0),
            O('deflect', "I won't discuss individuals in public.", 0, 2),
            O('critical', 'Everyone is fighting for their shirt. No exceptions.', -3, 1),
          ],
        }
      : null,
  // ── looking ahead ─────────────────────────────────────────────
  (c) =>
    c.nextOppName
      ? {
          id: 'next',
          text: `${c.nextOppName} are next. How do you approach it?`,
          options: [
            O('positive', 'We fear no one. We go out to win.', 4, 0),
            O('deflect', 'We focus on ourselves, not the opponent.', 1, 1),
            O('critical', "If we play like today's worst spells, we'll lose.", -2, 1),
          ],
        }
      : null,
  // ── reputation-flavoured pressure question (fallback) ─────────
  (c) => ({
    id: 'pressure',
    text:
      c.reputation < 40
        ? 'There are voices calling for your job. Do you still have the dressing room?'
        : c.reputation >= 70
          ? 'The country is falling in love with this team. Can you feel it?'
          : 'The expectations on this squad are huge. Does that weigh on you?',
    options: [
      O('positive', 'Pressure is a privilege. We embrace all of it.', 3, 2),
      O('deflect', 'I only listen to the people inside our camp.', 1, 0),
      O('critical', 'If anyone here is feeling the pressure, they can step aside.', -2, 1),
    ],
  }),
]

/** Pick 3 applicable questions: the result question always leads. */
export function generatePressConference(c: PressMatchContext): PressQuestion[] {
  const qs = TEMPLATES.map((t) => t(c)).filter((q): q is PressQuestion => q !== null)
  const result = qs.find((q) => q.id === 'result')
  const rest = qs.filter((q) => q.id !== 'result')
  // shuffle the rest
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return [result, ...rest]
    .filter((q): q is PressQuestion => !!q)
    .slice(0, 3)
    .map((q) => ({ ...q, options: tuneOptions(q.options, c.reputation) }))
}
