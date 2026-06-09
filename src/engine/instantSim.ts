import type { Team } from '../data/types'
import { MatchSimulation } from './sim/MatchSimulation'
import { buildAutoSetup, type BuildSetupOptions } from './buildMatch'
import type { MatchResult, MatchSetup } from './types'

const MAX_TICKS = 200_000 // regulation ≈ 54k ticks; generous ceiling incl. ET

/** Run a fully-built setup headlessly to full-time and return the result. */
export function simulateToEnd(setup: MatchSetup): MatchResult {
  const sim = new MatchSimulation(setup)
  let guard = 0
  while (!sim.world.finished && guard++ < MAX_TICKS) sim.step()
  return sim.getResult()
}

/** Convenience: AI-vs-AI instant simulation between two data Teams. */
export function instantSim(home: Team, away: Team, opts: BuildSetupOptions = {}): MatchResult {
  return simulateToEnd(buildAutoSetup(home, away, opts))
}
