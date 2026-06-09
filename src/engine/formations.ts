import type { Formation, TacticalRole } from '../data/types'

// Normalised slot coords: x ∈ [-1,1] (left→right), y ∈ [-1,1] (own goal→opp goal),
// authored for a team attacking +y. GK first, then 10 outfield.
function slot(role: TacticalRole, x: number, y: number) {
  return { role, x, y }
}

export const FORMATIONS: Record<string, Formation> = {
  '4-3-3': {
    name: '4-3-3',
    slots: [
      slot('GK', 0, -0.95),
      slot('FB', -0.72, -0.58), slot('CB', -0.26, -0.68), slot('CB', 0.26, -0.68), slot('FB', 0.72, -0.58),
      slot('CM', -0.4, -0.12), slot('CDM', 0, -0.32), slot('CM', 0.4, -0.12),
      slot('Wing', -0.62, 0.55), slot('ST', 0, 0.72), slot('Wing', 0.62, 0.55),
    ],
  },
  '4-4-2': {
    name: '4-4-2',
    slots: [
      slot('GK', 0, -0.95),
      slot('FB', -0.72, -0.58), slot('CB', -0.26, -0.68), slot('CB', 0.26, -0.68), slot('FB', 0.72, -0.58),
      slot('WM', -0.72, 0.02), slot('CM', -0.24, -0.2), slot('CM', 0.24, -0.2), slot('WM', 0.72, 0.02),
      slot('ST', -0.2, 0.66), slot('ST', 0.2, 0.66),
    ],
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    slots: [
      slot('GK', 0, -0.95),
      slot('FB', -0.72, -0.58), slot('CB', -0.26, -0.68), slot('CB', 0.26, -0.68), slot('FB', 0.72, -0.58),
      slot('CDM', -0.24, -0.34), slot('CDM', 0.24, -0.34),
      slot('Wing', -0.62, 0.34), slot('CAM', 0, 0.24), slot('Wing', 0.62, 0.34),
      slot('ST', 0, 0.72),
    ],
  },
  '3-5-2': {
    name: '3-5-2',
    slots: [
      slot('GK', 0, -0.95),
      slot('CB', -0.42, -0.68), slot('CB', 0, -0.72), slot('CB', 0.42, -0.68),
      slot('FB', -0.82, 0.0), slot('CM', -0.32, -0.18), slot('CDM', 0, -0.36), slot('CM', 0.32, -0.18), slot('FB', 0.82, 0.0),
      slot('ST', -0.22, 0.64), slot('ST', 0.22, 0.64),
    ],
  },
  '5-3-2': {
    name: '5-3-2',
    slots: [
      slot('GK', 0, -0.95),
      slot('FB', -0.82, -0.44), slot('CB', -0.42, -0.7), slot('CB', 0, -0.74), slot('CB', 0.42, -0.7), slot('FB', 0.82, -0.44),
      slot('CM', -0.36, -0.08), slot('CDM', 0, -0.28), slot('CM', 0.36, -0.08),
      slot('ST', -0.22, 0.6), slot('ST', 0.22, 0.6),
    ],
  },
  '3-4-3': {
    name: '3-4-3',
    slots: [
      slot('GK', 0, -0.95),
      slot('CB', -0.42, -0.68), slot('CB', 0, -0.72), slot('CB', 0.42, -0.68),
      slot('WM', -0.78, -0.04), slot('CM', -0.26, -0.2), slot('CM', 0.26, -0.2), slot('WM', 0.78, -0.04),
      slot('Wing', -0.62, 0.55), slot('ST', 0, 0.72), slot('Wing', 0.62, 0.55),
    ],
  },
}

export const FORMATION_NAMES = Object.keys(FORMATIONS)

export function getFormation(name: string): Formation {
  return FORMATIONS[name] ?? FORMATIONS['4-3-3']
}
