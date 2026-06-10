import { MatchSimulation } from '../engine/sim/MatchSimulation'
import { TICK_DT } from '../engine/constants'
import type { MatchEvent, MatchSetup, Side, WorldState } from '../engine/types'
import { MatchRenderer } from '../render/MatchRenderer'
import { ReplayBuffer, type GoalReplay, type ReplayFrame } from './replay'

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

  constructor(container: HTMLElement, setup: MatchSetup, cb: MatchCallbacks = {}) {
    this.sim = new MatchSimulation(setup)
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

    if (this.sim.world.finished && !this.finishedFired && !replaying && !this.pendingReplay) {
      this.finishedFired = true
      this.drainEvents(now)
      this.cb.onFinished?.(this.sim.world)
    }
  }

  private drainEvents(now: number) {
    const evs = this.sim.events
    for (; this.eventCursor < evs.length; this.eventCursor++) {
      const ev = evs[this.eventCursor]
      if ((ev.type === 'kickoff' || ev.type === 'halftime') && this.speed === 1) {
        this.renderer.cinematicPan()
      }
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
