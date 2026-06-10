import * as THREE from 'three'

// Shared geometries (created once, reused across all 22 figures).
const G = {
  torso: new THREE.BoxGeometry(0.52, 0.62, 0.28),
  hips: new THREE.BoxGeometry(0.48, 0.22, 0.26),
  head: new THREE.SphereGeometry(0.15, 16, 12),
  neck: new THREE.CylinderGeometry(0.06, 0.07, 0.08, 8),
  upperArm: new THREE.CylinderGeometry(0.06, 0.055, 0.34, 8),
  lowerArm: new THREE.CylinderGeometry(0.05, 0.045, 0.32, 8),
  upperLeg: new THREE.CylinderGeometry(0.085, 0.07, 0.42, 8),
  lowerLeg: new THREE.CylinderGeometry(0.06, 0.05, 0.4, 8),
  foot: new THREE.BoxGeometry(0.12, 0.08, 0.26),
  numberPlate: new THREE.PlaneGeometry(0.4, 0.42),
  badge: new THREE.PlaneGeometry(0.11, 0.13),
  shadow: new THREE.CircleGeometry(0.42, 20),
  ring: new THREE.RingGeometry(0.42, 0.56, 24),
  runArrow: new THREE.PlaneGeometry(0.5, 0.9),
}

// chevron texture for the off-ball run indicator
const ARROW_TEX = (() => {
  const cv = document.createElement('canvas')
  cv.width = 32
  cv.height = 56
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  for (const y of [0, 20]) {
    ctx.beginPath()
    ctx.moveTo(2, y + 22)
    ctx.lineTo(16, y + 6)
    ctx.lineTo(30, y + 22)
    ctx.lineTo(16, y + 14)
    ctx.closePath()
    ctx.fill()
  }
  return new THREE.CanvasTexture(cv)
})()

const SKIN = new THREE.MeshStandardMaterial({ color: 0xc89a73, roughness: 0.85 })
const BOOT = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })

// soft radial blob used as a grounding contact shadow under each player
const SHADOW_TEX = (() => {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const ctx = cv.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 32)
  grad.addColorStop(0, 'rgba(0,0,0,0.42)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(cv)
})()

/** Canvas texture with the shirt number, tinted to contrast with the kit. */
function numberTexture(num: number, shirtHex: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const ctx = cv.getContext('2d')!
  const n = parseInt(shirtHex.replace('#', ''), 16)
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  ctx.clearRect(0, 0, 64, 64)
  ctx.fillStyle = lum > 140 ? '#10141f' : '#ffffff'
  ctx.font = '900 44px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(num), 32, 36)
  return new THREE.CanvasTexture(cv)
}

/** Procedural national badge silhouette — distinct per team, not accurate. */
function badgeTexture(seed: number, color: string, accent: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 44
  cv.height = 52
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, 44, 52)
  const kind = Math.abs(seed) % 3
  ctx.fillStyle = color
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.beginPath()
  if (kind === 0) {
    // shield
    ctx.moveTo(6, 4)
    ctx.lineTo(38, 4)
    ctx.lineTo(38, 28)
    ctx.quadraticCurveTo(38, 44, 22, 50)
    ctx.quadraticCurveTo(6, 44, 6, 28)
    ctx.closePath()
  } else if (kind === 1) {
    // roundel
    ctx.arc(22, 26, 18, 0, Math.PI * 2)
  } else {
    // diamond
    ctx.moveTo(22, 3)
    ctx.lineTo(40, 26)
    ctx.lineTo(22, 49)
    ctx.lineTo(4, 26)
    ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()
  // central star
  ctx.fillStyle = accent
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? 8 : 3.5
    const x = 22 + Math.cos(a) * r
    const y = 26 + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  return new THREE.CanvasTexture(cv)
}

export interface HumanoidColors {
  shirt: string
  shorts: string
  /** Sock colour (defaults to the shorts colour for a matching scheme). */
  sock?: string
  /** Badge accent colour + per-team seed for a distinct chest crest. */
  badgeAccent?: string
  badgeSeed?: number
  /** Team-colour identification ring under the feet. */
  ring?: string
}

/** A jointed footballer with run/kick/idle/celebrate/dive/tackle states,
 *  numbered shirt, chest badge and a contact shadow. */
export class Humanoid {
  readonly group = new THREE.Group()
  private leftLeg = new THREE.Group()
  private rightLeg = new THREE.Group()
  private leftArm = new THREE.Group()
  private rightArm = new THREE.Group()
  private torso: THREE.Mesh
  private head: THREE.Mesh
  private phase = Math.random() * Math.PI * 2
  private time = Math.random() * 10
  private kickTimer = 0
  private kickLeg: -1 | 1 = 1
  private tackleTimer = 0
  private diveTimer = 0
  private diveDir: -1 | 1 = 1
  private celebrating = false
  private facing = 0
  private disposables: THREE.Texture[] = []
  private runArrow: THREE.Mesh | null = null
  private runArrowAlpha = 0

  constructor(colors: HumanoidColors, number?: number) {
    const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.shirt), roughness: 0.7 })
    const shorts = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.shorts), roughness: 0.7 })
    const sock = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.sock ?? colors.shorts), roughness: 0.9 })

    const hips = new THREE.Mesh(G.hips, shorts)
    hips.position.y = 0.92
    this.group.add(hips)

    this.torso = new THREE.Mesh(G.torso, shirt)
    this.torso.position.y = 1.28
    this.group.add(this.torso)

    const neck = new THREE.Mesh(G.neck, SKIN)
    neck.position.y = 1.62
    this.group.add(neck)

    this.head = new THREE.Mesh(G.head, SKIN)
    this.head.position.y = 1.76
    this.group.add(this.head)

    // shirt number on the back
    if (number != null) {
      const tex = numberTexture(number, colors.shirt)
      this.disposables.push(tex)
      const plate = new THREE.Mesh(G.numberPlate, new THREE.MeshBasicMaterial({ map: tex, transparent: true }))
      plate.position.set(0, 1.3, -0.145)
      plate.rotation.y = Math.PI
      this.group.add(plate)
    }
    // badge on the left chest
    if (colors.badgeAccent != null) {
      const tex = badgeTexture(colors.badgeSeed ?? 0, colors.badgeAccent, '#ffffff')
      this.disposables.push(tex)
      const badge = new THREE.Mesh(G.badge, new THREE.MeshBasicMaterial({ map: tex, transparent: true }))
      badge.position.set(-0.13, 1.42, 0.145)
      this.group.add(badge)
    }

    // arms hang from shoulders
    this.buildLimb(this.leftArm, shirt, SKIN, -0.32, 1.55, 0.34, 0.32, true)
    this.buildLimb(this.rightArm, shirt, SKIN, 0.32, 1.55, 0.34, 0.32, true)
    // legs from hips
    this.buildLimb(this.leftLeg, shorts, sock, -0.13, 0.86, 0.42, 0.4, false)
    this.buildLimb(this.rightLeg, shorts, sock, 0.13, 0.86, 0.42, 0.4, false)

    this.group.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg)
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true
    })

    // contact shadow (added after the traverse so it never casts)
    const blob = new THREE.Mesh(
      G.shadow,
      new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false }),
    )
    blob.rotation.x = -Math.PI / 2
    blob.position.y = 0.015
    this.group.add(blob)

    // team-colour ring so players stay identifiable even when overlapping
    if (colors.ring) {
      const ring = new THREE.Mesh(
        G.ring,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.ring), transparent: true, opacity: 0.85, depthWrite: false }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.03
      this.group.add(ring)

      // off-ball run chevrons (ahead of the player, shown while sprinting)
      this.runArrow = new THREE.Mesh(
        G.runArrow,
        new THREE.MeshBasicMaterial({ map: ARROW_TEX, color: new THREE.Color(colors.ring), transparent: true, opacity: 0, depthWrite: false }),
      )
      this.runArrow.rotation.x = -Math.PI / 2
      this.runArrow.position.set(0, 0.04, 1.1)
      this.group.add(this.runArrow)
    }
  }

  /** Show/hide the sprint chevrons (faded in update for a soft pulse). */
  setRunIndicator(on: boolean) {
    this.runArrowAlpha = on ? 1 : 0
  }

  private buildLimb(
    pivot: THREE.Group,
    upperMat: THREE.Material,
    lowerMat: THREE.Material,
    x: number,
    y: number,
    upperLen: number,
    lowerLen: number,
    isArm: boolean,
  ) {
    pivot.position.set(x, y, 0)
    const upper = new THREE.Mesh(isArm ? G.upperArm : G.upperLeg, upperMat)
    upper.position.y = -upperLen / 2
    pivot.add(upper)
    const lowerPivot = new THREE.Group()
    lowerPivot.position.y = -upperLen
    const lower = new THREE.Mesh(isArm ? G.lowerArm : G.lowerLeg, lowerMat)
    lower.position.y = -lowerLen / 2
    lowerPivot.add(lower)
    if (!isArm) {
      const foot = new THREE.Mesh(G.foot, BOOT)
      foot.position.set(0, -lowerLen + 0.02, 0.07)
      lowerPivot.add(foot)
    }
    pivot.add(lowerPivot)
    pivot.userData.lower = lowerPivot
  }

  triggerKick() {
    this.kickTimer = 0.35
    this.kickLeg = Math.random() < 0.5 ? -1 : 1
  }

  /** Slide-tackle lunge (forward tilt, leading leg extended). */
  triggerTackle() {
    if (this.diveTimer <= 0) this.tackleTimer = 0.5
  }

  /** Goalkeeper dive: full sideways stretch toward `dir` (-1 left, 1 right). */
  triggerDive(dir: -1 | 1) {
    this.diveTimer = 0.85
    this.diveDir = dir
  }

  /** Arms-aloft celebration while moving (goalscorer + teammates). */
  setCelebrating(on: boolean) {
    this.celebrating = on
  }

  /** @param speed metres/sec   @param facing radians (y-rotation)   @param dt seconds */
  update(speed: number, facing: number, dt: number) {
    this.time += dt
    // run indicator fade
    if (this.runArrow) {
      const mat = this.runArrow.material as THREE.MeshBasicMaterial
      const target = this.runArrowAlpha * (0.55 + Math.sin(this.time * 9) * 0.2)
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * 8)
    }
    // smoothly turn toward heading
    let diff = facing - this.facing
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.facing += diff * Math.min(1, dt * 10)
    this.group.rotation.y = this.facing

    const moving = speed > 0.4
    const cadence = 4 + Math.min(speed, 9) * 1.4
    this.phase += dt * cadence
    const amp = moving ? Math.min(0.5 + speed * 0.07, 1.05) : 0.12
    const s = Math.sin(this.phase)

    // ── goalkeeper dive (overrides everything) ──────────────────
    if (this.diveTimer > 0) {
      this.diveTimer -= dt
      const k = Math.sin(Math.min(1, (0.85 - this.diveTimer) / 0.3) * Math.PI * 0.5) // 0→1 fast
      this.group.rotation.z = -this.diveDir * 1.25 * k
      this.group.position.y = -0.55 * k
      // arms stretched toward the ball
      this.leftArm.rotation.x = 0
      this.rightArm.rotation.x = 0
      this.leftArm.rotation.z = this.diveDir > 0 ? -2.6 * k : -0.4
      this.rightArm.rotation.z = this.diveDir > 0 ? 0.4 : 2.6 * k
      this.leftLeg.rotation.x = 0.3 * k
      this.rightLeg.rotation.x = -0.3 * k
      if (this.diveTimer <= 0) {
        this.group.rotation.z = 0
        this.group.position.y = 0
        this.leftArm.rotation.z = 0
        this.rightArm.rotation.z = 0
      }
      return
    }

    // ── slide tackle ────────────────────────────────────────────
    if (this.tackleTimer > 0) {
      this.tackleTimer -= dt
      const k = Math.sin(Math.min(1, (0.5 - this.tackleTimer) / 0.22) * Math.PI * 0.5)
      this.group.rotation.x = 0.55 * k // forward lunge
      this.group.position.y = -0.3 * k
      this.rightLeg.rotation.x = -1.4 * k // leading leg extended
      ;(this.rightLeg.userData.lower as THREE.Group).rotation.x = 0.1
      this.leftLeg.rotation.x = 0.8 * k
      ;(this.leftLeg.userData.lower as THREE.Group).rotation.x = 1.2 * k
      if (this.tackleTimer <= 0) {
        this.group.rotation.x = 0
        this.group.position.y = 0
      }
      return
    }
    this.group.rotation.x = 0
    this.group.position.y = 0
    this.group.rotation.z = 0

    // ── kick follow-through ─────────────────────────────────────
    if (this.kickTimer > 0) {
      this.kickTimer -= dt
      const k = Math.sin((1 - this.kickTimer / 0.35) * Math.PI) // 0→1→0
      const kl = this.kickLeg === -1 ? this.leftLeg : this.rightLeg
      const ol = this.kickLeg === -1 ? this.rightLeg : this.leftLeg
      kl.rotation.x = -k * 1.3
      ;(kl.userData.lower as THREE.Group).rotation.x = k * 0.6
      ol.rotation.x = 0.1
      return
    }

    // ── celebration: arms aloft while running ───────────────────
    if (this.celebrating) {
      this.leftArm.rotation.x = Math.PI - 0.3 + Math.sin(this.time * 6) * 0.15
      this.rightArm.rotation.x = Math.PI - 0.3 - Math.sin(this.time * 6) * 0.15
      this.leftLeg.rotation.x = s * amp
      this.rightLeg.rotation.x = -s * amp
      ;(this.leftLeg.userData.lower as THREE.Group).rotation.x = Math.max(0, -s) * amp * 1.1
      ;(this.rightLeg.userData.lower as THREE.Group).rotation.x = Math.max(0, s) * amp * 1.1
      return
    }

    // ── idle breathing / run cycle ──────────────────────────────
    if (!moving) {
      // subtle weight shift + breathing bob roughly every 2 seconds
      const breathe = Math.sin(this.time * Math.PI) // ~2s cycle
      this.torso.position.y = 1.28 + breathe * 0.012
      this.torso.rotation.z = Math.sin(this.time * 0.7) * 0.02
      this.head.position.y = 1.76 + breathe * 0.01
    } else {
      this.torso.position.y = 1.28
      this.torso.rotation.z = 0
      this.head.position.y = 1.76
    }

    this.leftLeg.rotation.x = s * amp
    this.rightLeg.rotation.x = -s * amp
    ;(this.leftLeg.userData.lower as THREE.Group).rotation.x = Math.max(0, -s) * amp * 1.1
    ;(this.rightLeg.userData.lower as THREE.Group).rotation.x = Math.max(0, s) * amp * 1.1
    this.leftArm.rotation.x = -s * amp * 0.8
    this.rightArm.rotation.x = s * amp * 0.8
    this.leftArm.rotation.z = 0
    this.rightArm.rotation.z = 0
  }

  dispose() {
    for (const t of this.disposables) t.dispose()
  }
}
