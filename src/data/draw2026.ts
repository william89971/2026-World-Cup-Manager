// ─────────────────────────────────────────────────────────────────────────
// 2026 FIFA World Cup — official final draw (5 Dec 2025) and tournament
// structure. Cross-checked across Wikipedia, ESPN, Yahoo, NBC (HIGH confidence;
// all 48 placements unanimous, 7 favourite anchors verified).
// ─────────────────────────────────────────────────────────────────────────

export interface GroupDef {
  id: string
  /** Team codes in drawn order (slot 1–4). */
  teams: [string, string, string, string]
}

export const GROUPS: GroupDef[] = [
  { id: 'A', teams: ['MEX', 'CZE', 'RSA', 'KOR'] },
  { id: 'B', teams: ['CAN', 'SUI', 'QAT', 'BIH'] },
  { id: 'C', teams: ['BRA', 'MAR', 'SCO', 'HAI'] },
  { id: 'D', teams: ['USA', 'PAR', 'AUS', 'TUR'] },
  { id: 'E', teams: ['GER', 'ECU', 'CIV', 'CUW'] },
  { id: 'F', teams: ['NED', 'JPN', 'TUN', 'SWE'] },
  { id: 'G', teams: ['BEL', 'IRN', 'EGY', 'NZL'] },
  { id: 'H', teams: ['ESP', 'URU', 'KSA', 'CPV'] },
  { id: 'I', teams: ['FRA', 'SEN', 'NOR', 'IRQ'] },
  { id: 'J', teams: ['ARG', 'AUT', 'ALG', 'JOR'] },
  { id: 'K', teams: ['POR', 'COL', 'UZB', 'COD'] },
  { id: 'L', teams: ['ENG', 'CRO', 'GHA', 'PAN'] },
]

/** Host nations (auto Pot 1) — used for the home-morale boost. */
export const HOSTS = ['USA', 'MEX', 'CAN']

/** Round labels used across the tournament engine + bracket UI. */
export type RoundId = 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'TPP' | 'FINAL'

export const ROUND_LABEL: Record<RoundId, string> = {
  GROUP: 'Group Stage',
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-final',
  SF: 'Semi-final',
  TPP: 'Third-place Play-off',
  FINAL: 'Final',
}

/**
 * Round of 32 slot definitions (match order 73–88 per the official bracket).
 * `home`/`away` reference qualified slots:
 *   'W<G>'  = winner of group G
 *   'R<G>'  = runner-up of group G
 *   'T<n>'  = nth-best third-placed team (1..8) — assigned by FIFA's fixed
 *             allocation table once the 8 best thirds are known.
 * Pairings are deterministic; the third-placed candidate pools are encoded in
 * the tournament engine which resolves T1..T8 to concrete groups.
 */
export interface BracketSlot {
  match: number
  home: string
  away: string
}

export const R32_SLOTS: BracketSlot[] = [
  { match: 73, home: 'RA', away: 'RB' },
  { match: 74, home: 'WE', away: 'T1' },
  { match: 75, home: 'WF', away: 'RC' },
  { match: 76, home: 'WC', away: 'RF' },
  { match: 77, home: 'WI', away: 'T2' },
  { match: 78, home: 'RE', away: 'RI' },
  { match: 79, home: 'WA', away: 'T3' },
  { match: 80, home: 'WL', away: 'T4' },
  { match: 81, home: 'WD', away: 'T5' },
  { match: 82, home: 'WG', away: 'T6' },
  { match: 83, home: 'RK', away: 'RL' },
  { match: 84, home: 'WH', away: 'RJ' },
  { match: 85, home: 'WB', away: 'T7' },
  { match: 86, home: 'WJ', away: 'RH' },
  { match: 87, home: 'WK', away: 'T8' },
  { match: 88, home: 'RD', away: 'RG' },
]

/** Round of 16 pairings reference R32 match winners (e.g. 'M73'). */
export const R16_SLOTS: BracketSlot[] = [
  { match: 89, home: 'M74', away: 'M77' },
  { match: 90, home: 'M73', away: 'M75' },
  { match: 91, home: 'M76', away: 'M78' },
  { match: 92, home: 'M79', away: 'M80' },
  { match: 93, home: 'M83', away: 'M84' },
  { match: 94, home: 'M81', away: 'M82' },
  { match: 95, home: 'M85', away: 'M86' },
  { match: 96, home: 'M87', away: 'M88' },
]

export const QF_SLOTS: BracketSlot[] = [
  { match: 97, home: 'M89', away: 'M90' },
  { match: 98, home: 'M93', away: 'M94' },
  { match: 99, home: 'M91', away: 'M92' },
  { match: 100, home: 'M95', away: 'M96' },
]

export const SF_SLOTS: BracketSlot[] = [
  { match: 101, home: 'M97', away: 'M98' },
  { match: 102, home: 'M99', away: 'M100' },
]

export const TPP_SLOT: BracketSlot = { match: 103, home: 'L101', away: 'L102' }
export const FINAL_SLOT: BracketSlot = { match: 104, home: 'M101', away: 'M102' }

/** Approximate matchday dates (display only). */
export const SCHEDULE = {
  groupMatchdays: ['Jun 11–16', 'Jun 17–22', 'Jun 23–27'],
  R32: 'Jun 28 – Jul 3',
  R16: 'Jul 4 – 7',
  QF: 'Jul 9 – 11',
  SF: 'Jul 14 – 15',
  TPP: 'Jul 18',
  FINAL: 'Jul 19',
}
