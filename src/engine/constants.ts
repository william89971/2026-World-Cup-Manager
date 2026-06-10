// Pitch geometry (metres). Home attacks +Y, away attacks −Y.
export const PITCH = {
  W: 68, // touchline-to-touchline (x)
  L: 105, // goal-to-goal (y)
  HALF_W: 34,
  HALF_L: 52.5,
  GOAL_HALF_W: 3.66, // half of 7.32m goal mouth
  GOAL_HEIGHT: 2.44,
  CENTER_RADIUS: 9.15,
  PEN_BOX_HALF_W: 20.16,
  PEN_BOX_DEPTH: 16.5,
}

/** One simulation tick = this many match-seconds. */
export const TICK_DT = 0.1
export const TICKS_PER_SEC = 1 / TICK_DT
export const HALF_SECONDS = 45 * 60
export const MATCH_SECONDS = 90 * 60

/**
 * Motion time-dilation. The match clock is compressed (1× speed plays 90
 * match-minutes in 9 real minutes = 10× time), so if bodies moved at real
 * football m/s they would look 10× too fast on screen. Scaling every velocity
 * by PACE (and gravity by PACE²) keeps all trajectories geometrically
 * identical while play unfolds at a watchable, broadcast-like tempo:
 * a full-pace sprint crosses the pitch in ~4 real seconds at 1×.
 */
export const PACE = 0.3

// Movement / physics tuning (already PACE-scaled — these are match-time m/s)
export const PLAYER = {
  BASE_SPEED: 6.2 * PACE, // m/s at average pace
  SPEED_PACE_BONUS: 2.6 * PACE, // extra m/s scaling with pace
  ACCEL: 9.0 * PACE,
  CONTROL_RADIUS: 1.1, // distance to gain ball control
  REACH: 1.6, // tackle / interception reach
  KICK_OFFSET: 0.9, // ball sits this far ahead of dribbler
  /** Ticks a player takes to control the ball after receiving (~0.2 real s at 1×). */
  CONTROL_TICKS: 20,
}

export const BALL = {
  // friction decays e^(-λt); dilated time stretches t by 1/PACE, so the
  // per-second retention factors are raised to the PACE power
  GROUND_FRICTION: Math.pow(0.62, PACE),
  AIR_DRAG: Math.pow(0.94, PACE),
  GRAVITY: 9.8 * PACE * PACE, // g scales with k² so arcs keep their shape
  BOUNCE: 0.5,
  MAX_PASS_SPEED: 26 * PACE,
  MAX_SHOT_SPEED: 34 * PACE,
}

// Decision cadence: re-evaluate the on-ball decision every N ticks.
// Dilated with PACE so decisions-per-action match the slower ball movement.
export const DECISION_INTERVAL = 13 // ~1.3 match-s ≈ one thought per touch
