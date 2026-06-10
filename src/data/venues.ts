// Real 2026 World Cup venues, assigned deterministically to fixtures.
export interface Venue {
  stadium: string
  city: string
}

export const VENUES: Venue[] = [
  { stadium: 'MetLife Stadium', city: 'New York/New Jersey' },
  { stadium: 'AT&T Stadium', city: 'Dallas' },
  { stadium: 'Estadio Azteca', city: 'Mexico City' },
  { stadium: 'SoFi Stadium', city: 'Los Angeles' },
  { stadium: 'Hard Rock Stadium', city: 'Miami' },
  { stadium: 'Mercedes-Benz Stadium', city: 'Atlanta' },
  { stadium: 'NRG Stadium', city: 'Houston' },
  { stadium: 'Lincoln Financial Field', city: 'Philadelphia' },
  { stadium: 'Lumen Field', city: 'Seattle' },
  { stadium: 'Levi’s Stadium', city: 'San Francisco Bay Area' },
  { stadium: 'Gillette Stadium', city: 'Boston' },
  { stadium: 'Arrowhead Stadium', city: 'Kansas City' },
  { stadium: 'BMO Field', city: 'Toronto' },
  { stadium: 'BC Place', city: 'Vancouver' },
  { stadium: 'Estadio BBVA', city: 'Monterrey' },
  { stadium: 'Estadio Akron', city: 'Guadalajara' },
]

/** Deterministic venue for a fixture id; the Final is always at MetLife. */
export function venueFor(fixtureId: string, round: string): Venue {
  if (round === 'FINAL') return VENUES[0]
  if (round === 'SF') return fixtureId.endsWith('1') ? VENUES[1] : VENUES[2]
  let h = 0
  for (let i = 0; i < fixtureId.length; i++) h = (h * 31 + fixtureId.charCodeAt(i)) | 0
  return VENUES[Math.abs(h) % VENUES.length]
}
