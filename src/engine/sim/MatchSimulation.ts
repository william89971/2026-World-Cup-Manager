import { DECISION_INTERVAL, HALF_SECONDS, MATCH_SECONDS, TICK_DT } from '../constants'
import { archetypeOf } from '../../data/archetypes'
import type { Mentality, Pressing } from '../../data/types'
import type {
  MatchEvent,
  MatchResult,
  MatchSetup,
  PenaltyKickResult,
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

export class MatchSimulation {
  readonly setup: MatchSetup
  world: WorldState
  events: MatchEvent[] = []
  /** When true, a level knockout tie freezes at 90' (phase 'shootout') and
   *  waits for the UI to run the shootout. Headless sims resolve it instantly. */
  interactiveShootout = false
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
    // frozen at 90' awaiting the interactive penalty shootout
    if (w.phase === 'shootout') return

    // ── clock + period transitions ──────────────────────────────
    w.tick++
    w.timeSec += TICK_DT

    if (w.half === 1 && w.timeSec >= HALF_SECONDS) {
      this.emit({ type: 'halftime', text: 'Half-time' })
      w.half = 2
      this.kickoff(other('home')) // away kicks off 2nd half
    } else if (w.half === 2 && w.timeSec >= MATCH_SECONDS) {
      // no extra time: a level knockout tie goes straight to penalties
      if (this.setup.knockout && w.score.home === w.score.away) {
        if (this.interactiveShootout) {
          w.phase = 'shootout'
          this.emit({ type: 'fulltime', text: 'Full-time — penalties will decide it!' })
          return
        }
        this.shootout()
      }
      return this.finish()
    }

    // momentum drifts back toward neutral
    w.momentum.home += (50 - w.momentum.home) * 0.0004
    w.momentum.away += (50 - w.momentum.away) * 0.0004

    // ── restart / celebration handling ──────────────────────────
    if (w.phase === 'celebrate') {
      if (w.tick >= w.celebrateUntil && w.restart) {
        this.kickoff(w.restart.side)
        w.restart = null
      }
    } else if (w.restart && w.restart.delay > 0) {
      w.restart.delay--
      if (w.restart.delay === 0) {
        w.phase = 'open'
        w.restart = null
      }
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
    w.restart = null // discard any set piece interrupted by the period change
    w.transition = null
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

  // ── interactive shootout (UI-driven) ───────────────────────────

  /** True while frozen at 90' waiting for the shootout to be run. */
  awaitingShootout(): boolean {
    return this.world.phase === 'shootout' && !this.world.finished
  }

  /** On-pitch outfielders a manager can pick penalty takers from. */
  shootoutCandidates(side: Side): SimPlayer[] {
    return onPitch(this.world, side)
      .filter((p) => p.role !== 'GK')
      .sort((a, b) => b.attrs.shooting - a.attrs.shooting)
  }

  /** Default AI taker order (best 5 shooters). */
  defaultShootoutOrder(side: Side): string[] {
    return this.shootoutCandidates(side)
      .slice(0, 5)
      .map((p) => p.id)
  }

  /** Resolve one penalty kick. `kickIndex` is 0-based across the shootout —
   *  later kicks carry more pressure. Pure outcome; animation is the UI's job. */
  resolvePenaltyKick(takerId: string, side: Side, kickIndex: number): PenaltyKickResult {
    const taker = this.world.players.find((p) => p.id === takerId)
    const keeper = onPitch(this.world, other(side)).find((p) => p.role === 'GK')
    const shooting = taker?.attrs.shooting ?? 70
    const gkRating = keeper?.overall ?? 75
    const pressure = clamp(0.018 * Math.max(0, kickIndex - 1) + (kickIndex >= 10 ? 0.05 : 0), 0, 0.16)
    const pScore = clamp(0.78 + (shooting - 80) / 220 - (gkRating - 78) / 320 - pressure, 0.42, 0.92)
    const scored = this.rng() < pScore
    const dirs: (-1 | 0 | 1)[] = [-1, 0, 1]
    const shotDir = dirs[Math.floor(this.rng() * 3)]
    let outcome: PenaltyKickResult['outcome']
    let diveDir: -1 | 0 | 1
    if (scored) {
      outcome = 'goal'
      // keeper usually goes the wrong way on a goal
      const wrong = dirs.filter((d) => d !== shotDir)
      diveDir = this.rng() < 0.7 ? wrong[Math.floor(this.rng() * wrong.length)] : shotDir
    } else if (this.rng() < 0.78) {
      outcome = 'save'
      diveDir = shotDir
    } else {
      outcome = 'off'
      diveDir = dirs[Math.floor(this.rng() * 3)]
    }
    return {
      takerId,
      takerName: taker?.name ?? takerId,
      side,
      scored,
      outcome,
      shotDir,
      diveDir,
    }
  }

  /** Record the final shootout score and end the match. */
  applyShootoutResult(score: { home: number; away: number }): void {
    this.world.shootout = { ...score }
    this.emit({ type: 'fulltime', text: `Shootout: ${score.home}–${score.away}` })
    this.finish()
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
    out.offSec = w.timeSec
    const minutes = Math.floor(w.timeSec / 60)
    w.players.push({
      id: rec.id,
      side,
      name: rec.name,
      number: rec.number,
      role: out.role,
      archetype: archetypeOf(rec.attrs),
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
      saves: 0,
      joinedSec: w.timeSec,
      offSec: null,
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

  /** Change formation mid-match: re-anchor on-pitch players to new slots.
   *  The keeper always keeps the GK slot; outfielders are matched greedily to
   *  the nearest new anchor so substitutions don't scramble role assignment. */
  setFormation(side: Side, formationName: string): void {
    const team = side === 'home' ? this.setup.home : this.setup.away
    team.formationName = formationName
    const slots = getFormation(formationName).slots
    const players = onPitch(this.world, side)

    const gkSlot = slots.find((s) => s.role === 'GK')
    const gk = players.find((p) => p.role === 'GK')
    if (gk && gkSlot) gk.anchor = orientAnchor(gkSlot.x, gkSlot.y, side)

    const outfieldSlots = slots
      .filter((s) => s.role !== 'GK')
      .map((s) => ({ role: s.role, anchor: orientAnchor(s.x, s.y, side) }))
    const outfielders = players.filter((p) => p !== gk)
    const taken = new Set<number>()
    for (const p of outfielders) {
      let bestIdx = -1
      let bestD = Infinity
      outfieldSlots.forEach((s, i) => {
        if (taken.has(i)) return
        const d = (s.anchor.x - p.anchor.x) ** 2 + (s.anchor.y - p.anchor.y) ** 2
        if (d < bestD) {
          bestD = d
          bestIdx = i
        }
      })
      if (bestIdx >= 0) {
        taken.add(bestIdx)
        p.role = outfieldSlots[bestIdx].role
        p.anchor = { ...outfieldSlots[bestIdx].anchor }
      }
    }
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
        const end = p.offSec ?? w.timeSec
        const minutes = Math.max(1, Math.floor((end - p.joinedSec) / 60))
        list.push({
          id: p.id,
          name: p.name,
          rating: clamp(Number((6.4 + p.ratingPoints).toFixed(1)), 2, 10),
          goals: p.goals,
          assists: p.assists,
          saves: p.saves,
          minutes,
          yellow: p.yellow,
          red: p.red,
        })
      }
      return list
    }

    let winnerId: string | null = null
    const hs = w.score.home
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
