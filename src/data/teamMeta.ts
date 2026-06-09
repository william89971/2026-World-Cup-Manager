import type { PlayingStyle } from './types'

export interface TeamMeta {
  id: string
  name: string
  group: string
  /** Approximate global strength seed (1 = strongest); used for AI scaling. */
  seed: number
  style: PlayingStyle
  /** Additive morale bonus (host nations get a lift). */
  homeMoraleModifier: number
  kit: { primary: string; secondary: string; goalkeeper: string }
  flag: string
}

// Order roughly by global strength; `seed` drives difficulty/AI scaling and
// is independent of the group draw.
export const TEAM_META: Record<string, TeamMeta> = {
  ESP: { id: 'ESP', name: 'Spain', group: 'H', seed: 1, style: 'Possession', homeMoraleModifier: 0, kit: { primary: '#c60b1e', secondary: '#ffc400', goalkeeper: '#2bd66a' }, flag: '🇪🇸' },
  ARG: { id: 'ARG', name: 'Argentina', group: 'J', seed: 2, style: 'Balanced', homeMoraleModifier: 0, kit: { primary: '#75aadb', secondary: '#ffffff', goalkeeper: '#111827' }, flag: '🇦🇷' },
  FRA: { id: 'FRA', name: 'France', group: 'I', seed: 3, style: 'Counter-Attack', homeMoraleModifier: 0, kit: { primary: '#1f3b8b', secondary: '#ffffff', goalkeeper: '#d4af37' }, flag: '🇫🇷' },
  ENG: { id: 'ENG', name: 'England', group: 'L', seed: 4, style: 'Balanced', homeMoraleModifier: 0, kit: { primary: '#ffffff', secondary: '#1f3b8b', goalkeeper: '#16a34a' }, flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  BRA: { id: 'BRA', name: 'Brazil', group: 'C', seed: 5, style: 'Possession', homeMoraleModifier: 0, kit: { primary: '#ffdf00', secondary: '#009c3b', goalkeeper: '#3b5bdb' }, flag: '🇧🇷' },
  POR: { id: 'POR', name: 'Portugal', group: 'K', seed: 6, style: 'Possession', homeMoraleModifier: 0, kit: { primary: '#a4060f', secondary: '#0b6b3a', goalkeeper: '#f59e0b' }, flag: '🇵🇹' },
  NED: { id: 'NED', name: 'Netherlands', group: 'F', seed: 7, style: 'Possession', homeMoraleModifier: 0, kit: { primary: '#f36c21', secondary: '#ffffff', goalkeeper: '#1d4ed8' }, flag: '🇳🇱' },
  BEL: { id: 'BEL', name: 'Belgium', group: 'G', seed: 8, style: 'Balanced', homeMoraleModifier: 0, kit: { primary: '#c8102e', secondary: '#000000', goalkeeper: '#fde047' }, flag: '🇧🇪' },
  GER: { id: 'GER', name: 'Germany', group: 'E', seed: 9, style: 'High-Press', homeMoraleModifier: 0, kit: { primary: '#ffffff', secondary: '#000000', goalkeeper: '#16a34a' }, flag: '🇩🇪' },
  CRO: { id: 'CRO', name: 'Croatia', group: 'L', seed: 10, style: 'Possession', homeMoraleModifier: 0, kit: { primary: '#ff0000', secondary: '#ffffff', goalkeeper: '#1f2937' }, flag: '🇭🇷' },
  MAR: { id: 'MAR', name: 'Morocco', group: 'C', seed: 11, style: 'Counter-Attack', homeMoraleModifier: 0, kit: { primary: '#c1272d', secondary: '#006233', goalkeeper: '#f59e0b' }, flag: '🇲🇦' },
  COL: { id: 'COL', name: 'Colombia', group: 'K', seed: 12, style: 'Balanced', homeMoraleModifier: 0, kit: { primary: '#fcd116', secondary: '#003893', goalkeeper: '#dc2626' }, flag: '🇨🇴' },
  URU: { id: 'URU', name: 'Uruguay', group: 'H', seed: 13, style: 'Defensive', homeMoraleModifier: 0, kit: { primary: '#5cbfeb', secondary: '#1f2937', goalkeeper: '#111827' }, flag: '🇺🇾' },
  SUI: { id: 'SUI', name: 'Switzerland', group: 'B', seed: 14, style: 'Balanced', homeMoraleModifier: 0, kit: { primary: '#d52b1e', secondary: '#ffffff', goalkeeper: '#1f2937' }, flag: '🇨🇭' },
  JPN: { id: 'JPN', name: 'Japan', group: 'F', seed: 15, style: 'High-Press', homeMoraleModifier: 0, kit: { primary: '#1241a0', secondary: '#ffffff', goalkeeper: '#f59e0b' }, flag: '🇯🇵' },
  SEN: { id: 'SEN', name: 'Senegal', group: 'I', seed: 16, style: 'Direct', homeMoraleModifier: 0, kit: { primary: '#ffffff', secondary: '#00853f', goalkeeper: '#dc2626' }, flag: '🇸🇳' },
  USA: { id: 'USA', name: 'United States', group: 'D', seed: 17, style: 'High-Press', homeMoraleModifier: 8, kit: { primary: '#ffffff', secondary: '#1f3b8b', goalkeeper: '#16a34a' }, flag: '🇺🇸' },
  MEX: { id: 'MEX', name: 'Mexico', group: 'A', seed: 18, style: 'Possession', homeMoraleModifier: 8, kit: { primary: '#006847', secondary: '#ffffff', goalkeeper: '#111827' }, flag: '🇲🇽' },
  IRN: { id: 'IRN', name: 'Iran', group: 'G', seed: 19, style: 'Defensive', homeMoraleModifier: 0, kit: { primary: '#ffffff', secondary: '#239f40', goalkeeper: '#dc2626' }, flag: '🇮🇷' },
  ECU: { id: 'ECU', name: 'Ecuador', group: 'E', seed: 20, style: 'Balanced', homeMoraleModifier: 0, kit: { primary: '#ffd100', secondary: '#0072ce', goalkeeper: '#111827' }, flag: '🇪🇨' },
  AUT: { id: 'AUT', name: 'Austria', group: 'J', seed: 21, style: 'High-Press', homeMoraleModifier: 0, kit: { primary: '#ed2939', secondary: '#ffffff', goalkeeper: '#1f2937' }, flag: '🇦🇹' },
  AUS: { id: 'AUS', name: 'Australia', group: 'D', seed: 22, style: 'Direct', homeMoraleModifier: 0, kit: { primary: '#fedd00', secondary: '#00843d', goalkeeper: '#1f2937' }, flag: '🇦🇺' },
  NOR: { id: 'NOR', name: 'Norway', group: 'I', seed: 23, style: 'Direct', homeMoraleModifier: 0, kit: { primary: '#ba0c2f', secondary: '#00205b', goalkeeper: '#16a34a' }, flag: '🇳🇴' },
  EGY: { id: 'EGY', name: 'Egypt', group: 'G', seed: 24, style: 'Counter-Attack', homeMoraleModifier: 0, kit: { primary: '#ce1126', secondary: '#ffffff', goalkeeper: '#1f2937' }, flag: '🇪🇬' },
  ALG: { id: 'ALG', name: 'Algeria', group: 'J', seed: 25, style: 'Possession', homeMoraleModifier: 0, kit: { primary: '#ffffff', secondary: '#007229', goalkeeper: '#dc2626' }, flag: '🇩🇿' },
  SWE: { id: 'SWE', name: 'Sweden', group: 'F', seed: 26, style: 'Direct', homeMoraleModifier: 0, kit: { primary: '#005b99', secondary: '#fecb00', goalkeeper: '#1f2937' }, flag: '🇸🇪' },
  KOR: { id: 'KOR', name: 'South Korea', group: 'A', seed: 27, style: 'High-Press', homeMoraleModifier: 0, kit: { primary: '#c8102e', secondary: '#1f2937', goalkeeper: '#16a34a' }, flag: '🇰🇷' },
  CIV: { id: 'CIV', name: 'Ivory Coast', group: 'E', seed: 28, style: 'Direct', homeMoraleModifier: 0, kit: { primary: '#f77f00', secondary: '#ffffff', goalkeeper: '#16a34a' }, flag: '🇨🇮' },
  TUR: { id: 'TUR', name: 'Türkiye', group: 'D', seed: 29, style: 'Possession', homeMoraleModifier: 0, kit: { primary: '#e30a17', secondary: '#ffffff', goalkeeper: '#1f2937' }, flag: '🇹🇷' },
  PAR: { id: 'PAR', name: 'Paraguay', group: 'D', seed: 30, style: 'Defensive', homeMoraleModifier: 0, kit: { primary: '#d52b1e', secondary: '#0038a8', goalkeeper: '#1f2937' }, flag: '🇵🇾' },
  TUN: { id: 'TUN', name: 'Tunisia', group: 'F', seed: 31, style: 'Defensive', homeMoraleModifier: 0, kit: { primary: '#e70013', secondary: '#ffffff', goalkeeper: '#1f2937' }, flag: '🇹🇳' },
  SCO: { id: 'SCO', name: 'Scotland', group: 'C', seed: 32, style: 'Direct', homeMoraleModifier: 0, kit: { primary: '#0065bf', secondary: '#ffffff', goalkeeper: '#fde047' }, flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  GHA: { id: 'GHA', name: 'Ghana', group: 'L', seed: 33, style: 'Direct', homeMoraleModifier: 0, kit: { primary: '#ffffff', secondary: '#ce1126', goalkeeper: '#16a34a' }, flag: '🇬🇭' },
  CZE: { id: 'CZE', name: 'Czechia', group: 'A', seed: 34, style: 'Balanced', homeMoraleModifier: 0, kit: { primary: '#d7141a', secondary: '#11457e', goalkeeper: '#1f2937' }, flag: '🇨🇿' },
  CPV: { id: 'CPV', name: 'Cape Verde', group: 'H', seed: 35, style: 'Counter-Attack', homeMoraleModifier: 0, kit: { primary: '#003893', secondary: '#ffffff', goalkeeper: '#dc2626' }, flag: '🇨🇻' },
  QAT: { id: 'QAT', name: 'Qatar', group: 'B', seed: 36, style: 'Possession', homeMoraleModifier: 0, kit: { primary: '#8a1538', secondary: '#ffffff', goalkeeper: '#1f2937' }, flag: '🇶🇦' },
  KSA: { id: 'KSA', name: 'Saudi Arabia', group: 'H', seed: 37, style: 'Counter-Attack', homeMoraleModifier: 0, kit: { primary: '#006c35', secondary: '#ffffff', goalkeeper: '#fde047' }, flag: '🇸🇦' },
  COD: { id: 'COD', name: 'DR Congo', group: 'K', seed: 38, style: 'Direct', homeMoraleModifier: 0, kit: { primary: '#007fff', secondary: '#f7d618', goalkeeper: '#dc2626' }, flag: '🇨🇩' },
  BIH: { id: 'BIH', name: 'Bosnia and Herzegovina', group: 'B', seed: 39, style: 'Balanced', homeMoraleModifier: 0, kit: { primary: '#002395', secondary: '#fecb00', goalkeeper: '#16a34a' }, flag: '🇧🇦' },
  UZB: { id: 'UZB', name: 'Uzbekistan', group: 'K', seed: 40, style: 'Balanced', homeMoraleModifier: 0, kit: { primary: '#1eb53a', secondary: '#ffffff', goalkeeper: '#1f2937' }, flag: '🇺🇿' },
  RSA: { id: 'RSA', name: 'South Africa', group: 'A', seed: 41, style: 'Possession', homeMoraleModifier: 0, kit: { primary: '#007749', secondary: '#fcb913', goalkeeper: '#1f2937' }, flag: '🇿🇦' },
  IRQ: { id: 'IRQ', name: 'Iraq', group: 'I', seed: 42, style: 'Defensive', homeMoraleModifier: 0, kit: { primary: '#ffffff', secondary: '#1f2937', goalkeeper: '#16a34a' }, flag: '🇮🇶' },
  JOR: { id: 'JOR', name: 'Jordan', group: 'J', seed: 43, style: 'Defensive', homeMoraleModifier: 0, kit: { primary: '#ffffff', secondary: '#ce1126', goalkeeper: '#1f2937' }, flag: '🇯🇴' },
  CAN: { id: 'CAN', name: 'Canada', group: 'B', seed: 44, style: 'Direct', homeMoraleModifier: 8, kit: { primary: '#ff0000', secondary: '#ffffff', goalkeeper: '#1f2937' }, flag: '🇨🇦' },
  PAN: { id: 'PAN', name: 'Panama', group: 'L', seed: 45, style: 'Defensive', homeMoraleModifier: 0, kit: { primary: '#db0000', secondary: '#005293', goalkeeper: '#fde047' }, flag: '🇵🇦' },
  NZL: { id: 'NZL', name: 'New Zealand', group: 'G', seed: 46, style: 'Direct', homeMoraleModifier: 0, kit: { primary: '#ffffff', secondary: '#1f2937', goalkeeper: '#16a34a' }, flag: '🇳🇿' },
  CUW: { id: 'CUW', name: 'Curaçao', group: 'E', seed: 47, style: 'Counter-Attack', homeMoraleModifier: 0, kit: { primary: '#002b7f', secondary: '#f9e814', goalkeeper: '#dc2626' }, flag: '🇨🇼' },
  HAI: { id: 'HAI', name: 'Haiti', group: 'C', seed: 48, style: 'Counter-Attack', homeMoraleModifier: 0, kit: { primary: '#00209f', secondary: '#d21034', goalkeeper: '#16a34a' }, flag: '🇭🇹' },
}

export const ALL_TEAM_IDS = Object.keys(TEAM_META)
