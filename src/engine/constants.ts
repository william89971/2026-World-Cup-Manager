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

// Movement / physics tuning
export const PLAYER = {
  BASE_SPEED: 6.2, // m/s at average pace
  SPEED_PACE_BONUS: 2.6, // extra m/s scaling with pace
  ACCEL: 9.0,
  CONTROL_RADIUS: 1.1, // distance to gain ball control
  REACH: 1.6, // tackle / interception reach
  KICK_OFFSET: 0.9, // ball sits this far ahead of dribbler
}

export const BALL = {
  GROUND_FRICTION: 0.62, // per second velocity retention factor (applied as pow(dt))
  AIR_DRAG: 0.94,
  GRAVITY: 9.8,
  BOUNCE: 0.5,
  MAX_PASS_SPEED: 26,
  MAX_SHOT_SPEED: 34,
}

// Decision cadence: re-evaluate the on-ball decision every N ticks.
export const DECISION_INTERVAL = 4 // 0.4s
