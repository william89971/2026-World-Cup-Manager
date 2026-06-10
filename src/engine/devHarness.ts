/* Headless engine sanity check. Run with: npm run sim
 * Validates scorelines, possession, shots across many simulated matches. */
import { TEAMS } from '../data'
import { instantSim } from './instantSim'

function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100)
}

function single(homeId: string, awayId: string, seed: number) {
  const r = instantSim(TEAMS[homeId], TEAMS[awayId], { seed })
  const posH = pct(r.stats.possessionTicks.home, r.stats.possessionTicks.home + r.stats.possessionTicks.away)
  const passAcc = pct(
    r.stats.passesCompleted.home + r.stats.passesCompleted.away,
    r.stats.passesAttempted.home + r.stats.passesAttempted.away,
  )
  console.log(
    `${homeId} ${r.homeScore}-${r.awayScore} ${awayId} | ` +
      `poss ${posH}/${100 - posH} | shots ${r.stats.shots.home}-${r.stats.shots.away} ` +
      `(OT ${r.stats.onTarget.home}-${r.stats.onTarget.away}) | ` +
      `passAcc ${passAcc}% | fouls ${r.stats.fouls.home}-${r.stats.fouls.away} | ` +
      `cards Y${r.stats.yellows.home + r.stats.yellows.away}/R${r.stats.reds.home + r.stats.reds.away} | ` +
      `events ${r.events.length}`,
  )
  const top = [...r.ratings.home, ...r.ratings.away].sort((a, b) => b.rating - a.rating).slice(0, 3)
  console.log('   top: ' + top.map((p) => `${p.name} ${p.rating}${p.goals ? ` (${p.goals}G)` : ''}`).join(', '))
}

function aggregate(n: number) {
  const ids = Object.keys(TEAMS)
  let goals = 0
  let shots = 0
  let matches = 0
  let homeWins = 0
  let draws = 0
  let nilNils = 0
  for (let i = 0; i < n; i++) {
    const h = ids[(i * 7) % ids.length]
    const a = ids[(i * 13 + 3) % ids.length]
    if (h === a) continue
    const r = instantSim(TEAMS[h], TEAMS[a], { seed: 1000 + i })
    goals += r.homeScore + r.awayScore
    shots += r.stats.shots.home + r.stats.shots.away
    matches++
    if (r.homeScore > r.awayScore) homeWins++
    else if (r.homeScore === r.awayScore) draws++
    if (r.homeScore === 0 && r.awayScore === 0) nilNils++
  }
  console.log(
    `\nAGG over ${matches} matches: avg goals/match ${(goals / matches).toFixed(2)}, ` +
      `avg shots/match ${(shots / matches).toFixed(1)}, ` +
      `home win ${pct(homeWins, matches)}% / draw ${pct(draws, matches)}% / 0-0 ${pct(nilNils, matches)}%`,
  )
}

console.log('=== Sample matches ===')
single('ESP', 'HAI', 1)
single('BRA', 'ARG', 2)
single('ENG', 'USA', 3)
single('GER', 'JPN', 4)
single('FRA', 'NOR', 5)
aggregate(120)
