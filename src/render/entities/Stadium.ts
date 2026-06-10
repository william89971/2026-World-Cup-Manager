import * as THREE from 'three'
import { PITCH } from '../../engine/constants'

// Engine coords (x:[-34,34], y:[-52.5,52.5]) map to Three (x, z); height = Three y.

/** Striped pitch with painted lines and subtle wear in high-traffic zones.
 *  @param shade 1 = normal, <1 darkens the turf (rain / overcast) */
function makePitchTexture(shade = 1): THREE.CanvasTexture {
  const scale = 10 // px per metre
  const W = PITCH.W * scale
  const L = PITCH.L * scale
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = L
  const ctx = cv.getContext('2d')!

  const tint = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.round(((n >> 16) & 255) * shade)
    const g = Math.round(((n >> 8) & 255) * shade)
    const b = Math.round((n & 255) * shade)
    return `rgb(${r},${g},${b})`
  }

  // mowing stripes along the length
  const bands = 16
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? tint('#2f8f3f') : tint('#2a8238')
    ctx.fillRect(0, (i * L) / bands, W, L / bands)
  }

  const mx = (ex: number) => (ex + PITCH.HALF_W) * scale
  const mz = (ez: number) => (ez + PITCH.HALF_L) * scale

  // wear marks: scuffed turf in the centre circle and both penalty areas
  const rnd = (n: number) => ((Math.sin(n * 78.233) * 43758.5453) % 1 + 1) % 1
  const wearPatch = (cx: number, cz: number, spread: number, count: number, seed: number) => {
    for (let i = 0; i < count; i++) {
      const a = rnd(seed + i) * Math.PI * 2
      const r = Math.sqrt(rnd(seed + i + 0.37)) * spread
      const px = mx(cx) + Math.cos(a) * r * scale
      const pz = mz(cz) + Math.sin(a) * r * scale * 0.7
      const size = (1.2 + rnd(seed + i + 0.71) * 2.4) * scale
      ctx.fillStyle = `rgba(118, 96, 50, ${0.05 + rnd(seed + i + 0.13) * 0.08})`
      ctx.beginPath()
      ctx.ellipse(px, pz, size, size * 0.7, a, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  wearPatch(0, 0, 8, 26, 1) // centre circle
  wearPatch(0, PITCH.HALF_L - 11, 7, 22, 2) // penalty spots / six-yard traffic
  wearPatch(0, -(PITCH.HALF_L - 11), 7, 22, 3)
  wearPatch(0, PITCH.HALF_L - 3, 5, 12, 4)
  wearPatch(0, -(PITCH.HALF_L - 3), 5, 12, 5)

  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 3
  const line = (x1: number, z1: number, x2: number, z2: number) => {
    ctx.beginPath()
    ctx.moveTo(mx(x1), mz(z1))
    ctx.lineTo(mx(x2), mz(z2))
    ctx.stroke()
  }
  // boundary
  ctx.strokeRect(mx(-PITCH.HALF_W) + 2, mz(-PITCH.HALF_L) + 2, W - 4, L - 4)
  // halfway line + centre circle + spot
  line(-PITCH.HALF_W, 0, PITCH.HALF_W, 0)
  ctx.beginPath()
  ctx.arc(mx(0), mz(0), PITCH.CENTER_RADIUS * scale, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(mx(0), mz(0), 4, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()

  // penalty + goal boxes at both ends
  for (const end of [-1, 1]) {
    const goalZ = end * PITCH.HALF_L
    const penDepth = PITCH.PEN_BOX_DEPTH * scale * end
    const penHalfW = PITCH.PEN_BOX_HALF_W
    ctx.strokeRect(mx(-penHalfW), mz(end * PITCH.HALF_L), (penHalfW * 2) * scale, -penDepth)
    const sixHalfW = 9.16
    ctx.strokeRect(mx(-sixHalfW), mz(end * PITCH.HALF_L), (sixHalfW * 2) * scale, -(5.5 * scale * end))
    // penalty spot + arc
    const spotZ = goalZ - end * 11
    ctx.beginPath()
    ctx.arc(mx(0), mz(spotZ), 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(mx(0), mz(spotZ), 9.15 * scale, end > 0 ? Math.PI * 1.15 : Math.PI * 0.15, end > 0 ? Math.PI * 1.85 : Math.PI * 0.85)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(cv)
  tex.anisotropy = 8
  return tex
}

function buildGoal(zSign: number): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  const postR = 0.07
  const w = PITCH.GOAL_HALF_W
  const h = PITCH.GOAL_HEIGHT
  const z = zSign * PITCH.HALF_L
  const post = (x: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, h, 10), mat)
    m.position.set(x, h / 2, z)
    g.add(m)
  }
  post(-w)
  post(w)
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, w * 2, 10), mat)
  bar.rotation.z = Math.PI / 2
  bar.position.set(0, h, z)
  g.add(bar)
  // net
  const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, wireframe: true })
  const net = new THREE.Mesh(new THREE.BoxGeometry(w * 2, h, 1.8), netMat)
  net.position.set(0, h / 2, z + zSign * 0.9)
  g.add(net)
  return g
}

function buildCornerFlags(): THREE.Group {
  const g = new THREE.Group()
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd })
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffd400, side: THREE.DoubleSide })
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), poleMat)
      pole.position.set(sx * PITCH.HALF_W, 0.75, sz * PITCH.HALF_L)
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), flagMat)
      flag.position.set(sx * (PITCH.HALF_W - sx * 0.22), 1.3, sz * PITCH.HALF_L)
      g.add(pole, flag)
    }
  return g
}

function buildStands(): THREE.Group {
  const g = new THREE.Group()
  const standMat = new THREE.MeshStandardMaterial({ color: 0x14203a, roughness: 1 })
  const margin = 6
  const tiers = 3
  for (let t = 0; t < tiers; t++) {
    const inset = margin + t * 5
    const height = 4 + t * 4
    const lenX = PITCH.W + inset * 2
    const lenZ = PITCH.L + inset * 2
    const depth = 5
    const mk = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), standMat)
      m.position.set(x, height / 2 - 1, z)
      m.receiveShadow = true
      g.add(m)
    }
    mk(lenX, depth, 0, -(PITCH.HALF_L + inset))
    mk(lenX, depth, 0, PITCH.HALF_L + inset)
    mk(depth, lenZ, -(PITCH.HALF_W + inset), 0)
    mk(depth, lenZ, PITCH.HALF_W + inset, 0)
  }
  return g
}

/** Floodlight rig: four corner pylons with point lights over the pitch. */
function buildFloodlights(): THREE.Group {
  const g = new THREE.Group()
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x39435c, roughness: 0.8 })
  const headMat = new THREE.MeshBasicMaterial({ color: 0xf4f7ff })
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * (PITCH.HALF_W + 16)
      const z = sz * (PITCH.HALF_L + 16)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 26, 8), poleMat)
      pole.position.set(x, 12, z)
      const head = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 0.6), headMat)
      head.position.set(x, 25.5, z)
      head.lookAt(0, 0, 0)
      g.add(pole, head)

      const light = new THREE.PointLight(0xeef4ff, 220, 160, 1.8)
      light.position.set(sx * (PITCH.HALF_W + 10), 30, sz * (PITCH.HALF_L + 10))
      g.add(light)
    }
  return g
}

interface CrowdSeat {
  x: number
  y: number
  z: number
  phase: number
  hue: number
  /** Polar angle around the pitch — drives the travelling wave. */
  angle: number
}

/** Instanced crowd: sways with the play, leaps on goals, does the wave. */
class Crowd {
  readonly mesh: THREE.InstancedMesh
  private seats: CrowdSeat[] = []
  private dummy = new THREE.Object3D()
  private time = 0
  private cheer = 0 // >0 while celebrating (seconds remaining)
  private waveT = -1 // wave progress in radians travelled (-1 = inactive)
  private color = new THREE.Color()

  /** @param density 0–1 fill (group stage 0.7 → final 1.0) */
  constructor(density = 1) {
    const count = Math.round(4000 * Math.max(0.3, Math.min(1, density)))
    const geo = new THREE.BoxGeometry(0.4, 0.7, 0.4)
    const mat = new THREE.MeshStandardMaterial({ roughness: 1 })
    this.mesh = new THREE.InstancedMesh(geo, mat, count)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const ringX = PITCH.HALF_W + 8
    const ringZ = PITCH.HALF_L + 8
    const rnd = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1
    // later rounds bring more colour to the stands
    const sat = density >= 1 ? 0.8 : density >= 0.85 ? 0.65 : 0.5
    for (let i = 0; i < count; i++) {
      const edge = i % 4
      const r = rnd(i)
      const r2 = rnd(i + 0.5)
      let x: number, z: number
      const spread = 14
      if (edge === 0) { x = (r - 0.5) * (ringX * 2); z = -(ringZ + r2 * spread) }
      else if (edge === 1) { x = (r - 0.5) * (ringX * 2); z = ringZ + r2 * spread }
      else if (edge === 2) { x = -(ringX + r2 * spread); z = (r - 0.5) * (ringZ * 2) }
      else { x = ringX + r2 * spread; z = (r - 0.5) * (ringZ * 2) }
      const tier = Math.floor(r2 * 3)
      const seat: CrowdSeat = {
        x,
        y: 1.5 + tier * 4 + r * 1.5,
        z,
        phase: rnd(i + 7) * Math.PI * 2,
        hue: rnd(i + 7),
        angle: Math.atan2(z, x),
      }
      this.seats.push(seat)
      this.dummy.position.set(x, seat.y, z)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.color.setHSL(seat.hue, sat, 0.45 + rnd(i + 3) * 0.3)
      this.mesh.setColorAt(i, this.color)
    }
  }

  celebrate() {
    this.cheer = 2.4
  }

  /** Kick off a full-stadium wave (two laps). */
  startWave() {
    this.waveT = 0
  }

  get waving(): boolean {
    return this.waveT >= 0
  }

  /** @param excitement 0–1: home side attacking raises the sway amplitude */
  update(dt: number, excitement = 0) {
    this.time += dt
    const cheering = this.cheer > 0
    if (cheering) this.cheer -= dt
    const waving = this.waveT >= 0
    if (waving) {
      this.waveT += dt * 2.4 // radians/sec around the bowl
      if (this.waveT > Math.PI * 4) this.waveT = -1 // two laps then done
    }

    const total = this.seats.length
    // the wave animates every seat; otherwise a rotating slice keeps cost low
    const slice = waving ? total : cheering ? 1400 : 400
    const start = waving ? 0 : ((Math.floor(this.time * 47) * slice) % total + total) % total
    const swayAmp = 0.07 * (1 + excitement * 1.6)
    for (let k = 0; k < slice; k++) {
      const i = (start + k) % total
      const s = this.seats[i]
      let bob: number
      if (waving) {
        // travelling pulse: stand as the wave passes your section
        const d = ((s.angle - this.waveT) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        bob = d < 0.7 ? Math.sin((1 - d / 0.7) * Math.PI) * 0.9 : 0
      } else if (cheering) {
        bob = Math.max(0, Math.sin(this.time * 9 + s.phase)) * 0.55 // jumping
      } else {
        bob = Math.sin(this.time * 1.6 + s.phase) * swayAmp // sway with the play
      }
      this.dummy.position.set(s.x, s.y + bob, s.z)
      this.dummy.rotation.y = cheering ? Math.sin(this.time * 5 + s.phase) * 0.3 : 0
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      if (cheering && this.mesh.instanceColor) {
        // colour flash while celebrating
        this.color.setHSL((s.hue + this.time * 0.5) % 1, 0.85, 0.6)
        this.mesh.setColorAt(i, this.color)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
    if (cheering && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
}

export class Stadium {
  readonly group = new THREE.Group()
  private crowd: Crowd

  /** @param pitchShade 1 = normal turf, <1 darker (overcast / rain)
   *  @param crowdDensity 0–1 fill scaling with the round */
  constructor(pitchShade = 1, crowdDensity = 1) {
    const tex = makePitchTexture(pitchShade)
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH.W, PITCH.L),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
    )
    grass.rotation.x = -Math.PI / 2
    grass.receiveShadow = true
    this.group.add(grass)

    // surrounding turf apron
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH.W + 12, PITCH.L + 12),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(0x256b30).multiplyScalar(pitchShade), roughness: 1 }),
    )
    apron.rotation.x = -Math.PI / 2
    apron.position.y = -0.02
    this.group.add(apron)

    this.crowd = new Crowd(crowdDensity)
    this.group.add(buildGoal(1), buildGoal(-1), buildCornerFlags(), buildStands(), buildFloodlights(), this.crowd.mesh)
  }

  /** Crowd erupts (goal scored). */
  celebrate() {
    this.crowd.celebrate()
  }

  /** Full-stadium wave (big-occasion kick-offs). */
  startWave() {
    this.crowd.startWave()
  }

  update(dt: number, excitement = 0) {
    this.crowd.update(dt, excitement)
  }
}
