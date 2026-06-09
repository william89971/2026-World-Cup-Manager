import { MatchSimulation } from '../engine/sim/MatchSimulation'
import { TICK_DT } from '../engine/constants'
import type { MatchEvent, MatchSetup, WorldState } from '../engine/types'
import { MatchRenderer } from '../render/MatchRenderer'

export type SpeedLevel = 1 | 2 | 5 | 99
/** match-seconds advanced per real second at each speed level (baseline ≈10×). */
const SPEED_RATE: Record<SpeedLevel, number> = { 1: 10, 2: 20, 5: 50, 99: 600 }
const MAX_STEPS_PER_FRAME = 1500

export interface MatchCallbacks {
  onEvent?: (ev: MatchEvent) => void
  onFrame?: (world: WorldState) => void
  onFinished?: (world: WorldState) => void
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

  constructor(container: HTMLElement, setup: MatchSetup, cb: MatchCallbacks = {}) {
    this.sim = new MatchSimulation(setup)
    this.renderer = new MatchRenderer(container, setup)
    this.cb = cb
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

  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now

    if (!this.paused && !this.sim.world.finished) {
      const matchSeconds = dt * SPEED_RATE[this.speed]
      const steps = Math.min(MAX_STEPS_PER_FRAME, Math.round(matchSeconds / TICK_DT))
      for (let i = 0; i < steps && !this.sim.world.finished; i++) this.sim.step()
      this.drainEvents()
    }

    this.renderer.update(this.sim.world, dt)
    this.cb.onFrame?.(this.sim.world)

    if (this.sim.world.finished && !this.finishedFired) {
      this.finishedFired = true
      this.drainEvents()
      this.cb.onFinished?.(this.sim.world)
    }
  }

  private drainEvents() {
    const evs = this.sim.events
    for (; this.eventCursor < evs.length; this.eventCursor++) {
      const ev = evs[this.eventCursor]
      if (ev.type === 'goal' && ev.pos) this.renderer.cutTo(ev.pos.x, ev.pos.y)
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
