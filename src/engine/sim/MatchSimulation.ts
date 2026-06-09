import { DECISION_INTERVAL, HALF_SECONDS, MATCH_SECONDS, TICK_DT } from '../constants'
import type { Mentality, Pressing } from '../../data/types'
import type {
  MatchEvent,
  MatchResult,
  MatchSetup,
  PlayerMatchRating,
  Side,
  SimPlayer,
  WorldState,
} from '../types'
import { clamp, makeRng } from '../util'
import { createWorld, onPitch, orientAnchor, other } from './world'
import { computeTargets } from './positioning'
import { stepMovement } from './movement'
import { stepBall } from './physics'
import { decideOnBall, type EmitFn } from './decision'
import { getFormation } from '../formations'

const EXTRA_SECONDS = 2 * 15 * 60 // two 15-min halves

export class MatchSimulation {
  readonly setup: MatchSetup
  world: WorldState
  events: MatchEvent[] = []
  private rng: () => number
  private subsUsed: Record<Side, number> = { home: 0, away: 0 }
  private finalized = false
  private result: MatchResult | null = null

  constructor(setup: MatchSetup) {
    this.setup = setup
    this.rng = makeRng((setup.seed ?? 12345) >>> 0)
    this.world = createWorld(setup, 'home')
  }

  private emit: EmitFn = (ev) => {
    this.events.push({
      ...ev,
      tick: this.world.tick,
      timeSec: this.world.timeSec,
      score: ev.score ?? { ...this.world.score },
    })
  }

  /** Advance one simulation tick (TICK_DT match-seconds). */
  step(): void {
    const w = this.world
    if (w.finished) return

    // ── clock + period transitions ──────────────────────────────
    w.tick++
    w.timeSec += TICK_DT

    if (w.half === 1 && w.timeSec >= HALF_SECONDS) {
      this.emit({ type: 'halftime', text: 'Half-time' })
      w.half = 2
      this.kickoff(other('home')) // away kicks off 2nd half
    } else if (w.half === 2 && w.timeSec >= MATCH_SECONDS) {
      if (this.needsExtra()) {
        w.half = 3
        this.kickoff('home')
      } else {
        return this.finish()
      }
    } else if (w.half === 3 && w.timeSec >= MATCH_SECONDS + EXTRA_SECONDS / 2) {
      w.half = 4
      this.kickoff(other('home'))
    } else if (w.half === 4 && w.timeSec >= MATCH_SECONDS + EXTRA_SECONDS) {
      if (w.score.home === w.score.away) this.shootout()
      return this.finish()
    }

    // ── restart / celebration handling ──────────────────────────
    if (w.phase === 'celebrate') {
      if (w.tick >= w.celebrateUntil && w.restart) {
        this.kickoff(w.restart.side)
        w.restart = null
      }
    } else if (w.restart && w.restart.delay > 0) {
      w.restart.delay--
      if (w.restart.delay === 0) w.phase = 'open'
    }

    // ── decisions + movement + physics ──────────────────────────
    let ownerTarget = null
    if ((w.phase === 'open' || w.phase === 'kickoff') && w.ball.ownerId && w.tick % DECISION_INTERVAL === 0) {
      ownerTarget = decideOnBall(w, this.setup, this.rng, this.emit)
    }
    const targets = computeTargets(w, this.setup)
    if (ownerTarget && w.ball.ownerId) targets.set(w.ball.ownerId, ownerTarget)
    stepMovement(w, targets)
    stepBall(w, this.setup, this.rng, this.emit)

    // possession accounting
    const ownerSide = w.players.find((p) => p.id === w.ball.ownerId)?.side
    if (ownerSide) w.stats.possessionTicks[ownerSide]++
  }

  private needsExtra(): boolean {
    return !!this.setup.knockout && this.world.score.home === this.world.score.away
  }

  /** Reset to formation shape and restart play from the centre circle. */
  private kickoff(side: Side): void {
    const w = this.world
    for (const p of w.players) {
      if (!p.onPitch || p.red) continue
      p.pos = { ...p.anchor }
      p.vel = { x: 0, y: 0 }
    }
    const taker =
      onPitch(w, side).find((p) => p.role === 'ST' || p.role === 'CAM' || p.role === 'CM') ??
      onPitch(w, side)[0]
    w.ball.pos = { x: 0, y: 0 }
    w.ball.vel = { x: 0, y: 0 }
    w.ball.z = 0
    w.ball.vz = 0
    w.ball.ownerId = taker?.id ?? null
    w.ball.inFlight = false
    w.ball.shotOutcome = null
    w.ball.lastTouch = side
    w.ball.lastPasserId = null
    if (taker) taker.pos = { x: 0, y: 0 }
    w.phase = 'kickoff'
    if (w.tick === 0) this.emit({ type: 'kickoff', side, text: 'Kick-off' })
  }

  // ── penalty shootout (knockout, still level after extra time) ──
  private shootout(): void {
    const w = this.world
    const order: Side[] = ['home', 'away']
    const takers: Record<Side, SimPlayer[]> = {
      home: this.shootoutTakers('home'),
      away: this.shootoutTakers('away'),
    }
    const gk: Record<Side, SimPlayer | undefined> = {
      home: onPitch(w, 'home').find((p) => p.role === 'GK'),
      away: onPitch(w, 'away').find((p) => p.role === 'GK'),
    }
    const sc: Record<Side, number> = { home: 0, away: 0 }
    const take = (s: Side, i: number): boolean => {
      const taker = takers[s][i % takers[s].length]
      const keeper = gk[other(s)]
      const p = clamp(0.74 + (taker.attrs.shooting - 80) / 220 - ((keeper?.overall ?? 75) - 78) / 320, 0.5, 0.9)
      return this.rng() < p
    }
    for (let i = 0; i < 5; i++) for (const s of order) if (take(s, i)) sc[s]++
    let i = 5
    while (sc.home === sc.away) {
      const h = take('home', i)
      const a = take('away', i)
      if (h) sc.home++
      if (a) sc.away++
      i++
      if (i > 25) break
    }
    w.shootout = { ...sc }
    this.emit({ type: 'fulltime', text: `Shootout: ${sc.home}–${sc.away}` })
  }

  private shootoutTakers(side: Side): SimPlayer[] {
    return onPitch(this.world, side)
      .filter((p) => p.role !== 'GK')
      .sort((a, b) => b.attrs.shooting - a.attrs.shooting)
      .slice(0, 5)
  }

  // ── in-match manager controls ──────────────────────────────────
  canSub(side: Side): boolean {
    return this.subsUsed[side] < 5
  }

  subsRemaining(side: Side): number {
    return 5 - this.subsUsed[side]
  }

  makeSub(side: Side, outId: string, inId: string): boolean {
    if (!this.canSub(side)) return false
    const w = this.world
    const out = w.players.find((p) => p.id === outId && p.side === side && p.onPitch)
    const team = side === 'home' ? this.setup.home : this.setup.away
    const rec = team.players[inId]
    if (!out || !rec || w.players.some((p) => p.id === inId && p.onPitch)) return false

    out.onPitch = false
    const minutes = Math.floor(w.timeSec / 60)
    w.players.push({
      id: rec.id,
      side,
      name: rec.name,
      number: rec.number,
      role: out.role,
      anchor: { ...out.anchor },
      pos: { ...out.pos },
      vel: { x: 0, y: 0 },
      attrs: rec.attrs,
      overall: rec.overall,
      stamina: 100,
      onPitch: true,
      yellow: 0,
      red: false,
      ratingPoints: 0,
      goals: 0,
      assists: 0,
      kickCd: 0,
    })
    if (w.ball.ownerId === outId) w.ball.ownerId = inId
    this.subsUsed[side]++
    this.emit({
      type: 'sub',
      side,
      playerId: out.id,
      playerName: out.name,
      secondaryId: rec.id,
      secondaryName: rec.name,
      text: `Sub: ${rec.name} on for ${out.name} (${minutes}')`,
    })
    return true
  }

  setMentality(side: Side, m: Mentality): void {
    if (side === 'home') this.setup.home.mentality = m
    else this.setup.away.mentality = m
  }

  setPressing(side: Side, p: Pressing): void {
    if (side === 'home') this.setup.home.pressing = p
    else this.setup.away.pressing = p
  }

  /** Change formation mid-match: re-anchor on-pitch players to new slots. */
  setFormation(side: Side, formationName: string): void {
    const team = side === 'home' ? this.setup.home : this.setup.away
    team.formationName = formationName
    const slots = getFormation(formationName).slots
    const players = onPitch(this.world, side)
    players.forEach((p, i) => {
      const slot = slots[i] ?? slots[slots.length - 1]
      p.role = slot.role
      p.anchor = orientAnchor(slot.x, slot.y, side)
    })
  }

  shout(side: Side, kind: 'push' | 'direct' | 'hold'): void {
    if (kind === 'push') this.setPressing(side, 'high')
    else if (kind === 'hold') this.setMentality(side, 'balanced')
    else if (kind === 'direct') this.setMentality(side, 'attacking')
  }

  // ── finalisation ───────────────────────────────────────────────
  private finish(): void {
    if (this.finalized) return
    this.world.finished = true
    this.world.phase = 'fulltime'
    this.finalized = true
    this.emit({ type: 'fulltime', text: 'Full-time' })
    this.result = this.buildResult()
  }

  getResult(): MatchResult {
    if (!this.result) {
      if (!this.world.finished) this.finish()
      this.result = this.result ?? this.buildResult()
    }
    return this.result
  }

  private buildResult(): MatchResult {
    const w = this.world
    const ratingsFor = (side: Side): PlayerMatchRating[] => {
      const seen = new Set<string>()
      const list: PlayerMatchRating[] = []
      for (const p of w.players.filter((pl) => pl.side === side)) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        const minutes = p.onPitch ? Math.min(90, Math.floor(w.timeSec / 60)) : 45
        list.push({
          id: p.id,
          name: p.name,
          rating: clamp(Number((6.4 + p.ratingPoints).toFixed(1)), 2, 10),
          goals: p.goals,
          assists: p.assists,
          minutes,
          yellow: p.yellow,
          red: p.red,
        })
      }
      return list
    }

    let winnerId: string | null = null
    const hs = w.score.home + (w.shootout ? 0 : 0)
    const as = w.score.away
    if (w.score.home !== w.score.away) {
      winnerId = w.score.home > w.score.away ? this.setup.home.teamId : this.setup.away.teamId
    } else if (w.shootout) {
      winnerId = w.shootout.home > w.shootout.away ? this.setup.home.teamId : this.setup.away.teamId
    }

    return {
      homeId: this.setup.home.teamId,
      awayId: this.setup.away.teamId,
      homeScore: hs,
      awayScore: as,
      shootout: w.shootout,
      events: this.events,
      stats: w.stats,
      ratings: { home: ratingsFor('home'), away: ratingsFor('away') },
      winnerId,
    }
  }
}
