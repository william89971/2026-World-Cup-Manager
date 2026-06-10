import * as THREE from 'three'
import type { MatchSetup, PenaltyKickResult, Side, SimPlayer, WorldState } from '../engine/types'
import type { ReplayFrame } from '../match/replay'
import { PITCH } from '../engine/constants'
import { Stadium } from './entities/Stadium'
import { Ball } from './entities/Ball'
import { Humanoid } from './entities/Humanoid'
import { MatchCamera, type CameraMode } from './camera/MatchCamera'

export type Weather = 'clear-night' | 'overcast' | 'rain'

interface Figure {
  h: Humanoid
  facing: number
  prevKickCd: number
}

/** Perceptual-ish distance between two hex colours (kit clash check). */
function colorDistance(a: string, b: string): number {
  const pa = parseInt(a.replace('#', ''), 16)
  const pb = parseInt(b.replace('#', ''), 16)
  const dr = ((pa >> 16) & 255) - ((pb >> 16) & 255)
  const dg = ((pa >> 8) & 255) - ((pb >> 8) & 255)
  const db = (pa & 255) - (pb & 255)
  return Math.sqrt(dr * dr * 2 + dg * dg * 4 + db * db)
}

/** Stable small hash for per-team badge variants. */
function teamSeed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return h
}

interface ActiveReplay {
  frames: ReplayFrame[]
  t: number
  dur: number
}

/** Scripted penalty kick: setup → run-up → ball flight + dive → result hold. */
interface PenaltySeq {
  kick: PenaltyKickResult
  gkId: string | null
  t: number
}
const PEN = {
  SPOT_Z: PITCH.HALF_L - 11, // stage at the +z goal
  GOAL_Z: PITCH.HALF_L,
  SETUP: 0.6,
  RUNUP: 0.9,
  FLIGHT: 0.5,
  HOLD: 1.3,
  total: 0, // filled below
}
PEN.total = PEN.SETUP + PEN.RUNUP + PEN.FLIGHT + PEN.HOLD

/** Per-weather scene parameters. */
const WEATHER_PRESETS: Record<
  Weather,
  { bg: number; fog: [number, number]; hemi: number; sun: number; sunColor: number; pitchShade: number }
> = {
  'clear-night': { bg: 0x0a1424, fog: [140, 320], hemi: 1.1, sun: 1.5, sunColor: 0xffffff, pitchShade: 1 },
  overcast: { bg: 0x39414f, fog: [120, 300], hemi: 0.95, sun: 0.7, sunColor: 0xccd4e0, pitchShade: 0.88 },
  rain: { bg: 0x232a36, fog: [90, 260], hemi: 0.8, sun: 0.55, sunColor: 0xb8c4d4, pitchShade: 0.78 },
}

export class MatchRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private cam: MatchCamera
  private ball = new Ball()
  private figures = new Map<string, Figure>()
  private container: HTMLElement
  private setup: MatchSetup
  private stadium: Stadium
  private rain: THREE.Points | null = null
  private rainVel: Float32Array | null = null
  private replay: ActiveReplay | null = null
  private shootoutStage = false
  private penalty: PenaltySeq | null = null
  private standSpots = new Map<string, { x: number; z: number }>()
  /** Away side wears its second kit when the primaries clash. */
  private awaySecondKit: boolean
  private shotLive = false
  readonly weather: Weather

  constructor(container: HTMLElement, setup: MatchSetup) {
    this.container = container
    this.setup = setup
    const w = container.clientWidth || 960
    const h = container.clientHeight || 540

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    container.appendChild(this.renderer.domElement)

    // weather is decided once per match from the seed and never changes
    this.weather = pickWeather(setup.seed ?? 0)
    const preset = WEATHER_PRESETS[this.weather]

    this.scene.background = new THREE.Color(preset.bg)
    this.scene.fog = new THREE.Fog(preset.bg, preset.fog[0], preset.fog[1])

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x2a5530, preset.hemi)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(preset.sunColor, preset.sun)
    sun.position.set(40, 80, 30)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const c = sun.shadow.camera as THREE.OrthographicCamera
    c.left = -70; c.right = 70; c.top = 90; c.bottom = -90; c.near = 1; c.far = 220
    this.scene.add(sun)

    this.stadium = new Stadium(preset.pitchShade, setup.occasion?.density ?? 1)
    this.scene.add(this.stadium.group)
    this.scene.add(this.ball.group)

    this.awaySecondKit = colorDistance(setup.home.kit.primary, setup.away.kit.primary) < 130

    if (this.weather === 'rain') this.buildRain()

    this.cam = new MatchCamera(w / h, this.renderer.domElement)
  }

  private buildRain() {
    const count = 2600
    const positions = new Float32Array(count * 3)
    this.rainVel = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (PITCH.W + 60)
      positions[i * 3 + 1] = Math.random() * 45
      positions[i * 3 + 2] = (Math.random() - 0.5) * (PITCH.L + 60)
      this.rainVel[i] = 26 + Math.random() * 12
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xaabdd4,
      size: 0.14,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    this.rain = new THREE.Points(geo, mat)
    this.scene.add(this.rain)
  }

  private updateRain(dt: number) {
    if (!this.rain || !this.rainVel) return
    const attr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < this.rainVel.length; i++) {
      arr[i * 3 + 1] -= this.rainVel[i] * dt
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 40 + Math.random() * 5
    }
    attr.needsUpdate = true
  }

  private kitFor(side: Side, role: string): { shirt: string; shorts: string; sock: string; badgeAccent: string; badgeSeed: number } {
    const team = side === 'home' ? this.setup.home : this.setup.away
    const kit = team.kit
    const seed = teamSeed(team.teamId)
    if (role === 'GK')
      return { shirt: kit.goalkeeper, shorts: kit.goalkeeper, sock: kit.goalkeeper, badgeAccent: kit.primary, badgeSeed: seed }
    // away changes into its second kit when the primaries are too similar
    const shirt = side === 'away' && this.awaySecondKit ? kit.secondary : kit.primary
    const shorts = side === 'away' && this.awaySecondKit ? kit.primary : kit.secondary
    return { shirt, shorts, sock: shirt, badgeAccent: shorts, badgeSeed: seed }
  }

  private ensure(p: SimPlayer): Figure {
    let f = this.figures.get(p.id)
    if (!f) {
      const h = new Humanoid(this.kitFor(p.side, p.role), p.number)
      this.scene.add(h.group)
      f = { h, facing: p.side === 'home' ? 0 : Math.PI, prevKickCd: 0 }
      this.figures.set(p.id, f)
    }
    return f
  }

  /** Slide-tackle animation on the named player (driven by engine events). */
  triggerTackle(playerId: string | undefined) {
    if (!playerId) return
    this.figures.get(playerId)?.h.triggerTackle()
  }

  /** Big-occasion stadium wave (semi-final / final kick-offs). */
  stadiumWave() {
    this.stadium.startWave()
  }

  // ── goal replay playback ────────────────────────────────────────
  startReplay(frames: ReplayFrame[]) {
    if (frames.length < 2) return
    this.replay = { frames, t: 0, dur: 5 }
  }

  isReplaying(): boolean {
    return this.replay !== null
  }

  skipReplay() {
    this.replay = null
  }

  private updateReplay(dt: number) {
    const r = this.replay!
    r.t += dt
    if (r.t >= r.dur) {
      this.replay = null
      return
    }
    const n = r.frames.length
    const f = (r.t / r.dur) * (n - 1)
    const i = Math.min(n - 2, Math.floor(f))
    const frac = f - i
    const a = r.frames[i]
    const b = r.frames[i + 1]

    // interpolate the recorded positions
    const present = new Set<string>()
    for (const pa of a.players) {
      const pb = b.players.find((q) => q.id === pa.id) ?? pa
      const fig = this.figures.get(pa.id)
      if (!fig) continue
      present.add(pa.id)
      const x = pa.x + (pb.x - pa.x) * frac
      const z = pa.y + (pb.y - pa.y) * frac
      const dx = (pb.x - pa.x) / 0.2
      const dz = (pb.y - pa.y) / 0.2
      const speed = Math.hypot(dx, dz)
      if (speed > 0.4) fig.facing = Math.atan2(dx, dz)
      fig.h.group.visible = true
      fig.h.group.position.set(x, 0, z)
      fig.h.update(speed, fig.facing, dt)
    }
    const bx = a.ball.x + (b.ball.x - a.ball.x) * frac
    const bz = a.ball.y + (b.ball.y - a.ball.y) * frac
    const bh = a.ball.z + (b.ball.z - a.ball.z) * frac
    this.ball.update(bx, bz, bh, dt)
    this.cam.replayUpdate(this.ball.mesh.position.x, this.ball.mesh.position.z, dt)
  }

  // ── penalty shootout staging ────────────────────────────────────
  beginShootoutStage() {
    this.shootoutStage = true
    this.standSpots.clear()
  }

  endShootout() {
    this.shootoutStage = false
    this.penalty = null
    // clear any dive lean left on figures
    for (const f of this.figures.values()) f.h.group.rotation.z = 0
  }

  playPenalty(kick: PenaltyKickResult, gkId: string | null) {
    this.penalty = { kick, gkId, t: 0 }
  }

  penaltyBusy(): boolean {
    return this.penalty !== null
  }

  private updateShootout(world: WorldState, dt: number) {
    // assign standing spots around the centre circle once
    if (this.standSpots.size === 0) {
      let i = 0
      for (const p of world.players) {
        if (!p.onPitch || p.red) continue
        const ang = (i / 20) * Math.PI * 2
        this.standSpots.set(p.id, { x: Math.cos(ang) * 11, z: Math.sin(ang) * 8 - 2 })
        i++
      }
    }

    const pen = this.penalty
    const takerId = pen?.kick.takerId
    const gkId = pen?.gkId
    if (pen) pen.t += dt

    let ballX = 0
    let ballZ = PEN.SPOT_Z
    let ballH = 0

    for (const p of world.players) {
      const f = this.figures.get(p.id)
      if (!p.onPitch || p.red) {
        if (f) f.h.group.visible = false
        continue
      }
      const fig = this.ensure(p)
      fig.h.group.visible = true

      if (pen && p.id === takerId) {
        // run-up: walk in, strike, follow through
        const t = pen.t
        let z = PEN.SPOT_Z - 6
        let speed = 0
        if (t > PEN.SETUP && t <= PEN.SETUP + PEN.RUNUP) {
          const k = (t - PEN.SETUP) / PEN.RUNUP
          z = PEN.SPOT_Z - 6 + k * 5.2
          speed = 5
          if (k > 0.92 && fig.prevKickCd === 0) {
            fig.h.triggerKick()
            fig.prevKickCd = 1
          }
        } else if (t > PEN.SETUP + PEN.RUNUP) {
          z = PEN.SPOT_Z - 0.8
        }
        fig.h.group.position.set(0, 0, z)
        fig.facing = 0 // facing +z goal
        fig.h.update(speed, 0, dt)
        continue
      }

      if (pen && p.id === gkId) {
        // keeper: set on the line, dive during flight
        const t = pen.t
        const flightStart = PEN.SETUP + PEN.RUNUP
        let x = 0
        let lean = 0
        if (t > flightStart) {
          const k = Math.min(1, (t - flightStart) / 0.4)
          x = pen.kick.diveDir * 2.3 * k
          lean = pen.kick.diveDir !== 0 ? -pen.kick.diveDir * 0.95 * k : 0
        }
        fig.h.group.position.set(x, 0, PEN.GOAL_Z - 0.4)
        fig.h.group.rotation.z = lean
        fig.facing = Math.PI // facing the taker (-z)
        fig.h.update(0, Math.PI, dt)
        continue
      }

      // everyone else stands around the centre circle
      const spot = this.standSpots.get(p.id) ?? { x: 0, z: -6 }
      const target = new THREE.Vector3(spot.x, 0, spot.z)
      fig.h.group.position.lerp(target, Math.min(1, dt * 4))
      fig.h.group.rotation.z = 0
      fig.h.update(0.2, 0, dt)
    }

    // ball trajectory
    if (pen) {
      const t = pen.t
      const flightStart = PEN.SETUP + PEN.RUNUP
      if (t > flightStart) {
        const k = Math.min(1, (t - flightStart) / PEN.FLIGHT)
        const targetX =
          pen.kick.outcome === 'off'
            ? pen.kick.shotDir * (PITCH.GOAL_HALF_W + 1.5) || 1.2
            : pen.kick.shotDir * (PITCH.GOAL_HALF_W - 1.1)
        const targetH = pen.kick.outcome === 'off' && pen.kick.shotDir === 0 ? PITCH.GOAL_HEIGHT + 1 : 0.8 + Math.abs(pen.kick.shotDir) * 0.3
        if (pen.kick.outcome === 'save' && k >= 1) {
          // parried back out
          ballX = targetX * 1.1
          ballZ = PEN.GOAL_Z - 2.5
          ballH = 0.2
        } else {
          ballX = targetX * k
          ballZ = PEN.SPOT_Z + (PEN.GOAL_Z + (pen.kick.outcome === 'goal' ? 0.8 : 0.2) - PEN.SPOT_Z) * k
          ballH = Math.sin(k * Math.PI * 0.5) * targetH
        }
      }
      if (pen.t >= PEN.total) {
        // sequence complete
        const takerFig = takerId ? this.figures.get(takerId) : null
        if (takerFig) takerFig.prevKickCd = 0
        this.penalty = null
      }
    }
    this.ball.update(ballX, ballZ, ballH, dt)

    // camera: low behind-the-spot framing
    this.cam.frameTo(7.5, 4.2, PEN.SPOT_Z - 15, 0, 1.2, PEN.GOAL_Z - 2, dt)
    this.renderer.render(this.scene, this.cam.camera)
  }

  /** Sync visuals to the latest engine world for one rendered frame. */
  update(world: WorldState, dt: number) {
    // crowd stirs when the ball enters either attacking third
    const excitement = Math.abs(world.ball.pos.y) > PITCH.HALF_L / 3 ? 1 : 0
    this.stadium.update(dt, this.shootoutStage || this.replay ? 1 : excitement)
    this.updateRain(dt)

    if (this.shootoutStage) {
      this.updateShootout(world, dt)
      return
    }

    if (this.replay) {
      this.updateReplay(dt)
      this.renderer.render(this.scene, this.cam.camera)
      return
    }

    // goalkeeper dives at incoming shots (outcome pre-decided by the engine —
    // on goals the keeper often picked the wrong way, so dive opposite)
    const shotIncoming = !!world.ball.inFlight && !!world.ball.shotOutcome
    if (shotIncoming && !this.shotLive) {
      this.shotLive = true
      const shooter = world.players.find((p) => p.id === world.ball.shooterId)
      const gk = world.players.find((p) => p.side !== shooter?.side && p.role === 'GK' && p.onPitch)
      if (gk) {
        const fig = this.figures.get(gk.id)
        const toward = Math.sign(world.ball.vel.x) || 1
        const dir = world.ball.shotOutcome === 'goal' && Math.random() < 0.6 ? -toward : toward
        fig?.h.triggerDive(dir as -1 | 1)
      }
    } else if (!shotIncoming) {
      this.shotLive = false
    }

    const celebrating = world.phase === 'celebrate'
    const scorer = celebrating ? world.players.find((p) => p.id === world.lastScorerId) : undefined

    for (const p of world.players) {
      const f = this.figures.get(p.id)
      if (!p.onPitch || p.red) {
        if (f) f.h.group.visible = false
        continue
      }
      const fig = this.ensure(p)
      fig.h.group.visible = true
      const target = new THREE.Vector3(p.pos.x, 0, p.pos.y)
      fig.h.group.position.lerp(target, Math.min(1, dt * 12))

      const speed = Math.hypot(p.vel.x, p.vel.y)
      if (speed > 0.3) fig.facing = Math.atan2(p.vel.x, p.vel.y)
      if (p.kickCd > fig.prevKickCd) fig.h.triggerKick()
      fig.prevKickCd = p.kickCd
      // arms aloft for the scoring side while the celebration plays
      fig.h.setCelebrating(celebrating && !!scorer && p.side === scorer.side && p.role !== 'GK')
      fig.h.update(speed, fig.facing, dt)
    }

    this.ball.update(world.ball.pos.x, world.ball.pos.y, world.ball.z, dt)
    this.cam.update(this.ball.mesh.position.x, this.ball.mesh.position.z, dt)
    this.renderer.render(this.scene, this.cam.camera)
  }

  /** Cinematic cut to a pitch position (engine x,y) + crowd eruption. */
  cutTo(x: number, y: number) {
    this.cam.cutTo(x, y)
    this.stadium.celebrate()
  }

  /** Slow establishing pan (kick-off / half-time). */
  cinematicPan() {
    this.cam.cinematicPan()
  }

  setCameraMode(mode: CameraMode) {
    this.cam.setMode(mode)
  }
  getCameraMode(): CameraMode {
    return this.cam.getMode()
  }
  setZoom(z: number) {
    this.cam.setZoom(z)
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.cam.resize(w / h)
  }

  dispose() {
    this.cam.dispose()
    for (const f of this.figures.values()) f.h.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose()
        const m = o.material
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else (m as THREE.Material).dispose()
      }
    })
  }
}

/** Deterministic per-match weather from the sim seed (set once at kick-off). */
function pickWeather(seed: number): Weather {
  const r = Math.abs(Math.sin(seed * 0.41421 + 1.618)) % 1
  if (r < 0.55) return 'clear-night'
  if (r < 0.8) return 'overcast'
  return 'rain'
}
