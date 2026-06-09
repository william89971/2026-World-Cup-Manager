import type { Difficulty } from '../data/types'

/** AI strength multiplier applied to non-player teams' attributes. */
export const AI_STRENGTH: Record<Difficulty, number> = {
  Amateur: 0.92,
  Professional: 1.0,
  'World Class': 1.06,
  Legendary: 1.12,
}

export const DIFFICULTIES: Difficulty[] = ['Amateur', 'Professional', 'World Class', 'Legendary']

export function aiStrength(difficulty: Difficulty): number {
  return AI_STRENGTH[difficulty]
}
