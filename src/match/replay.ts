// Goal replay capture: a fixed-size ring buffer of recent ball/player
// positions, sampled outside the hot sim loop so recording never slows the
// simulation. Pure data — no React, no Three.js.
import type { Side, WorldState } from '../engine/types'

export interface ReplayFrame {
  ball: { x: number; y: number; z: number }
  players: { id: string; x: number; y: number }[]
}

export interface GoalReplay {
  id: string
  minute: number
  scorerName: string
  side: Side
  score: { home: number; away: number }
  frames: ReplayFrame[]
  kits: {
    home: { primary: string; secondary: string; goalkeeper: string }
    away: { primary: string; secondary: string; goalkeeper: string }
  }
  /** Per-player side + keeper flag so a viewer can dress the figures. */
  meta: Record<string, { side: Side; gk: boolean }>
}

/** ~8.8 match-seconds at one sample per 0.2 match-seconds. */
const DEFAULT_CAPACITY = 44

export class ReplayBuffer {
  private frames: ReplayFrame[] = []
  private head = 0
  private size = 0

  constructor(private capacity = DEFAULT_CAPACITY) {}

  record(world: WorldState): void {
    const frame: ReplayFrame = {
      ball: { x: world.ball.pos.x, y: world.ball.pos.y, z: world.ball.z },
      players: world.players
        .filter((p) => p.onPitch && !p.red)
        .map((p) => ({ id: p.id, x: p.pos.x, y: p.pos.y })),
    }
    if (this.size < this.capacity) {
      this.frames.push(frame)
      this.size++
    } else {
      this.frames[this.head] = frame
      this.head = (this.head + 1) % this.capacity
    }
  }

  /** Chronologically-ordered copy of the buffered frames. */
  snapshot(): ReplayFrame[] {
    if (this.size < this.capacity) return [...this.frames]
    return [...this.frames.slice(this.head), ...this.frames.slice(0, this.head)]
  }
}
