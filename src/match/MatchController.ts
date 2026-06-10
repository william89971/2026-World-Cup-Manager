import { MatchSimulation } from '../engine/sim/MatchSimulation'
import { TICK_DT } from '../engine/constants'
import type { MatchEvent, MatchSetup, PenaltyKickResult, Side, WorldState } from '../engine/types'
import { MatchRenderer } from '../render/MatchRenderer'
import { ReplayBuffer, type GoalReplay, type ReplayFrame } from './replay'

/** One shootout kick plus the running score after it. */
export interface ShootoutKickView extends PenaltyKickResult {
  index: number
  score: { home: number; away: number }
}

interface ShootoutState {
  orders: Record<Side, string[]>
  score: { home: number; away: number }
  taken: { home: number; away: number }
  kicks: ShootoutKickView[]
  next: Side
  /** ms timestamp when the next kick may start (pause between kicks). */
  nextKickAt: number
  current: PenaltyKickResult | null
  finished: boolean
}

export type SpeedLevel = 1 | 2 | 5 | 99
/** match-seconds advanced per real second at each speed level (baseline ≈10×). */
const SPEED_RATE: Record<SpeedLevel, number> = { 1: 10, 2: 20, 5: 50, 99: 600 }
const MAX_STEPS_PER_FRAME = 1500
/** sim ticks between replay samples, per speed (coarser when fast-forwarding). */
const SAMPLE_EVERY: Record<SpeedLevel, number> = { 1: 2, 2: 2, 5: 4, 99: 10 }

export interface MatchCallbacks {
  onEvent?: (ev: MatchEvent) => void
  onFrame?: (world: WorldState) => void
  onFinished?: (world: WorldState) => void
  /** Fired when an automatic goal replay starts / ends. */
  onReplay?: (active: boolean) => void
  /** 90' is up in a level knockout tie — the manager must pick takers. */
  onShootoutNeeded?: () => void
  /** A penalty has been taken (animation finished). */
  onShootoutKick?: (kick: ShootoutKickView) => void
  /** The shootout is decided. */
  onShootoutDone?: (score: { home: number; away: number }) => void
}

/** Drives a live match: owns the simulation + 3D renderer and a rAF loop. */
export class MatchController {
  readonly sim: MatchSimulation
  readonly renderer: MatchRenderer
  private cb: MatchCallbacks
  private raf = 0
  private last = 0
  private paused = true
  private speed: SpeedLevel = 1
  private eventCursor = 0
  private finishedFired = false

  private buffer = new ReplayBuffer()
  private replays: GoalReplay[] = []
  private pendingReplay: ReplayFrame[] | null = null
  private replayStartAt = 0
  private wasReplaying = false
  private playerMeta: GoalReplay['meta'] = {}
  private shootoutNeededFired = false
  private shootout: ShootoutState | null = null
  private shootoutHoldUntil = 0

  constructor(container: HTMLElement, setup: MatchSetup, cb: MatchCallbacks = {}) {
    this.sim = new MatchSimulation(setup)
    this.sim.interactiveShootout = true
    this.renderer = new MatchRenderer(container, setup)
    this.cb = cb
    for (const side of ['home', 'away'] as Side[]) {
      const team = side === 'home' ? setup.home : setup.away
      for (const p of Object.values(team.players)) {
        this.playerMeta[p.id] = { side, gk: p.role === 'GK' }
      }
    }
    this.loop = this.loop.bind(this)
  }

  start() {
    this.paused = false
    this.last = performance.now()
    if (!this.raf) this.raf = requestAnimationFrame(this.loop)
  }
  pause() {
    this.paused = true
  }
  resume() {
    this.paused = false
    this.last = performance.now()
  }
  togglePause(): boolean {
    this.paused = !this.paused
    if (!this.paused) this.last = performance.now()
    return this.paused
  }
  isPaused() {
    return this.paused
  }
  setSpeed(s: SpeedLevel) {
    this.speed = s
  }
  getSpeed() {
    return this.speed
  }

  /** All goal replays captured this match (for the post-match viewer). */
  getReplays(): GoalReplay[] {
    return this.replays
  }

  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop)
    // clamp to [0, 50ms] — the first rAF timestamp can precede performance.now()
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000))
    this.last = now

    // a queued goal replay starts once the celebration cut-away has played
    if (this.pendingReplay && now >= this.replayStartAt && !this.paused) {
      this.renderer.startReplay(this.pendingReplay)
      this.pendingReplay = null
    }
    const replaying = this.renderer.isReplaying()
    if (replaying !== this.wasReplaying) {
      this.wasReplaying = replaying
      this.cb.onReplay?.(replaying)
    }

    // 90' up in a level knockout tie → hand over to the shootout UI
    if (this.sim.awaitingShootout() && !this.shootoutNeededFired) {
      this.shootoutNeededFired = true
      this.drainEvents(now)
      this.cb.onShootoutNeeded?.()
    }
    if (this.shootout && !this.paused) this.stepShootout(now)

    // the sim holds while a replay plays — the world resumes exactly after
    if (!this.paused && !replaying && !this.sim.world.finished) {
      const matchSeconds = dt * SPEED_RATE[this.speed]
      const steps = Math.min(MAX_STEPS_PER_FRAME, Math.round(matchSeconds / TICK_DT))
      const sampleEvery = SAMPLE_EVERY[this.speed]
      for (let i = 0; i < steps && !this.sim.world.finished; i++) {
        this.sim.step()
        if (this.sim.world.tick % sampleEvery === 0) this.buffer.record(this.sim.world)
      }
      this.drainEvents(now)
    }

    this.renderer.update(this.sim.world, dt)
    this.cb.onFrame?.(this.sim.world)

    if (
      this.sim.world.finished &&
      !this.finishedFired &&
      !replaying &&
      !this.pendingReplay &&
      now >= this.shootoutHoldUntil
    ) {
      this.finishedFired = true
      this.drainEvents(now)
      this.cb.onFinished?.(this.sim.world)
    }
  }

  // ── penalty shootout orchestration ─────────────────────────────

  /** Start the shootout with the user's chosen taker order (5 ids, in order).
   *  The AI side's order is picked automatically. */
  beginShootout(userSide: Side, userOrder: string[]): void {
    const aiSide: Side = userSide === 'home' ? 'away' : 'home'
    const orders: Record<Side, string[]> = {
      home: userSide === 'home' ? userOrder : this.sim.defaultShootoutOrder('home'),
      away: userSide === 'away' ? userOrder : this.sim.defaultShootoutOrder('away'),
    }
    void aiSide
    this.renderer.beginShootoutStage()
    this.shootout = {
      orders,
      score: { home: 0, away: 0 },
      taken: { home: 0, away: 0 },
      kicks: [],
      next: 'home',
      nextKickAt: performance.now() + 1400,
      current: null,
      finished: false,
    }
  }

  private stepShootout(now: number): void {
    const s = this.shootout!
    if (s.finished) return

    if (s.current) {
      if (this.renderer.penaltyBusy()) return
      // animation done: tally the kick
      const k = s.current
      s.current = null
      if (k.scored) s.score[k.side]++
      s.taken[k.side]++
      const view: ShootoutKickView = { ...k, index: s.kicks.length, score: { ...s.score } }
      s.kicks.push(view)
      this.cb.onShootoutKick?.(view)
      s.next = k.side === 'home' ? 'away' : 'home'
      s.nextKickAt = now + 1000
      if (this.shootoutDecided(s)) {
        s.finished = true
        this.renderer.endShootout()
        this.sim.applyShootoutResult(s.score)
        this.shootoutHoldUntil = now + 2400
        this.cb.onShootoutDone?.({ ...s.score })
      }
      return
    }

    if (now < s.nextKickAt) return
    const side = s.next
    const order = s.orders[side]
    const takerId = order[s.taken[side] % Math.max(1, order.length)]
    const kickIndex = s.taken.home + s.taken.away
    const result = this.sim.resolvePenaltyKick(takerId, side, kickIndex)
    s.current = result
    const gk = this.sim.world.players.find((p) => p.side !== side && p.role === 'GK' && p.onPitch)
    this.renderer.playPenalty(result, gk?.id ?? null)
  }

  /** Best-of-5 with early termination, then sudden death. */
  private shootoutDecided(s: ShootoutState): boolean {
    const remHome = Math.max(0, 5 - s.taken.home)
    const remAway = Math.max(0, 5 - s.taken.away)
    if (s.taken.home <= 5 && s.taken.away <= 5) {
      if (s.score.home > s.score.away + remAway) return true
      if (s.score.away > s.score.home + remHome) return true
    }
    if (s.taken.home >= 5 && s.taken.away >= 5 && s.taken.home === s.taken.away) {
      return s.score.home !== s.score.away
    }
    return false
  }

  private drainEvents(now: number) {
    const evs = this.sim.events
    for (; this.eventCursor < evs.length; this.eventCursor++) {
      const ev = evs[this.eventCursor]
      if ((ev.type === 'kickoff' || ev.type === 'halftime') && this.speed === 1) {
        this.renderer.cinematicPan()
        // big occasions: the crowd does a full stadium wave before kick-off
        if (ev.type === 'kickoff' && this.sim.setup.occasion?.wave) this.renderer.stadiumWave()
      }
      if (ev.type === 'tackle') this.renderer.triggerTackle(ev.playerId)
      if (ev.type === 'goal' && ev.pos) {
        this.renderer.cutTo(ev.pos.x, ev.pos.y)
        // bank the last ~8 seconds and queue the cinematic replay
        const frames = this.buffer.snapshot()
        if (frames.length >= 6) {
          this.replays.push({
            id: `g${this.replays.length}-${ev.tick}`,
            minute: Math.max(1, Math.ceil(ev.timeSec / 60)),
            scorerName: ev.playerName ?? 'Unknown',
            side: ev.side ?? 'home',
            score: ev.score ?? { ...this.sim.world.score },
            frames,
            kits: { home: { ...this.sim.setup.home.kit }, away: { ...this.sim.setup.away.kit } },
            meta: this.playerMeta,
          })
          if (this.speed !== 99) {
            this.pendingReplay = frames
            this.replayStartAt = now + 1700 // after the goal cut-away
          }
        }
      }
      this.cb.onEvent?.(ev)
    }
  }

  resize() {
    this.renderer.resize()
  }

  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.renderer.dispose()
  }
}
