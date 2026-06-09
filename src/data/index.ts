import type { Player, Team } from './types'
import { TEAM_META } from './teamMeta'
import { buildPlayer, teamOverall } from './buildSquad'
import type { RawSquad } from './squads/_type'

// Raw squads (research-sourced). One export per 3-letter code.
import { MEX } from './squads/MEX'
import { CZE } from './squads/CZE'
import { RSA } from './squads/RSA'
import { KOR } from './squads/KOR'
import { CAN } from './squads/CAN'
import { SUI } from './squads/SUI'
import { QAT } from './squads/QAT'
import { BIH } from './squads/BIH'
import { BRA } from './squads/BRA'
import { MAR } from './squads/MAR'
import { SCO } from './squads/SCO'
import { HAI } from './squads/HAI'
import { USA } from './squads/USA'
import { PAR } from './squads/PAR'
import { AUS } from './squads/AUS'
import { TUR } from './squads/TUR'
import { GER } from './squads/GER'
import { ECU } from './squads/ECU'
import { CIV } from './squads/CIV'
import { CUW } from './squads/CUW'
import { NED } from './squads/NED'
import { JPN } from './squads/JPN'
import { TUN } from './squads/TUN'
import { SWE } from './squads/SWE'
import { BEL } from './squads/BEL'
import { IRN } from './squads/IRN'
import { EGY } from './squads/EGY'
import { NZL } from './squads/NZL'
import { ESP } from './squads/ESP'
import { URU } from './squads/URU'
import { KSA } from './squads/KSA'
import { CPV } from './squads/CPV'
import { FRA } from './squads/FRA'
import { SEN } from './squads/SEN'
import { NOR } from './squads/NOR'
import { IRQ } from './squads/IRQ'
import { ARG } from './squads/ARG'
import { AUT } from './squads/AUT'
import { ALG } from './squads/ALG'
import { JOR } from './squads/JOR'
import { POR } from './squads/POR'
import { COL } from './squads/COL'
import { UZB } from './squads/UZB'
import { COD } from './squads/COD'
import { ENG } from './squads/ENG'
import { CRO } from './squads/CRO'
import { GHA } from './squads/GHA'
import { PAN } from './squads/PAN'

const RAW_SQUADS: Record<string, RawSquad> = {
  MEX, CZE, RSA, KOR, CAN, SUI, QAT, BIH, BRA, MAR, SCO, HAI, USA, PAR, AUS, TUR,
  GER, ECU, CIV, CUW, NED, JPN, TUN, SWE, BEL, IRN, EGY, NZL, ESP, URU, KSA, CPV,
  FRA, SEN, NOR, IRQ, ARG, AUT, ALG, JOR, POR, COL, UZB, COD, ENG, CRO, GHA, PAN,
}

function assemble(): Record<string, Team> {
  const out: Record<string, Team> = {}
  for (const meta of Object.values(TEAM_META)) {
    const raw = RAW_SQUADS[meta.id]
    if (!raw) throw new Error(`Missing squad for ${meta.id}`)
    const squad: Player[] = raw.map((rp) => buildPlayer(meta.id, rp))
    out[meta.id] = {
      id: meta.id,
      name: meta.name,
      group: meta.group,
      seed: meta.seed,
      overall: teamOverall(squad),
      style: meta.style,
      homeMoraleModifier: meta.homeMoraleModifier,
      kit: meta.kit,
      flag: meta.flag,
      squad,
    }
  }
  return out
}

/** All 48 fully-assembled teams, keyed by 3-letter code. */
export const TEAMS: Record<string, Team> = assemble()

export function getTeam(id: string): Team {
  const t = TEAMS[id]
  if (!t) throw new Error(`Unknown team ${id}`)
  return t
}

export function allTeams(): Team[] {
  return Object.values(TEAMS)
}
