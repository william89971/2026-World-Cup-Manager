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
  shadow: new THREE.CircleGeometry(0.42, 20),
}

const SKIN = new THREE.MeshStandardMaterial({ color: 0xc89a73, roughness: 0.85 })
const SOCK = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 })
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
  // pick black/white for contrast against the shirt colour
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

export interface HumanoidColors {
  shirt: string
  shorts: string
}

/** A jointed footballer figure with a code-driven run/kick cycle, a numbered
 *  shirt and a soft contact shadow for grounding. */
export class Humanoid {
  readonly group = new THREE.Group()
  private leftLeg = new THREE.Group()
  private rightLeg = new THREE.Group()
  private leftArm = new THREE.Group()
  private rightArm = new THREE.Group()
  private phase = Math.random() * Math.PI * 2
  private kickTimer = 0
  private kickLeg: -1 | 1 = 1
  private facing = 0
  private numberTex: THREE.CanvasTexture | null = null

  constructor(colors: HumanoidColors, number?: number) {
    const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.shirt), roughness: 0.7 })
    const shorts = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.shorts), roughness: 0.7 })

    const hips = new THREE.Mesh(G.hips, shorts)
    hips.position.y = 0.92
    this.group.add(hips)

    const torso = new THREE.Mesh(G.torso, shirt)
    torso.position.y = 1.28
    this.group.add(torso)

    const neck = new THREE.Mesh(G.neck, SKIN)
    neck.position.y = 1.62
    this.group.add(neck)

    const head = new THREE.Mesh(G.head, SKIN)
    head.position.y = 1.76
    this.group.add(head)

    // shirt number on the back
    if (number != null) {
      this.numberTex = numberTexture(number, colors.shirt)
      const plate = new THREE.Mesh(
        G.numberPlate,
        new THREE.MeshBasicMaterial({ map: this.numberTex, transparent: true }),
      )
      plate.position.set(0, 1.3, -0.145)
      plate.rotation.y = Math.PI
      this.group.add(plate)
    }

    // arms hang from shoulders
    this.buildLimb(this.leftArm, shirt, SKIN, -0.32, 1.55, 0.34, 0.32, true)
    this.buildLimb(this.rightArm, shirt, SKIN, 0.32, 1.55, 0.34, 0.32, true)
    // legs from hips
    this.buildLimb(this.leftLeg, shorts, SOCK, -0.13, 0.86, 0.42, 0.4, false)
    this.buildLimb(this.rightLeg, shorts, SOCK, 0.13, 0.86, 0.42, 0.4, false)

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

  /** @param speed metres/sec   @param facing radians (y-rotation)   @param dt seconds */
  update(speed: number, facing: number, dt: number) {
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

    this.leftLeg.rotation.x = s * amp
    this.rightLeg.rotation.x = -s * amp
    ;(this.leftLeg.userData.lower as THREE.Group).rotation.x = Math.max(0, -s) * amp * 1.1
    ;(this.rightLeg.userData.lower as THREE.Group).rotation.x = Math.max(0, s) * amp * 1.1
    this.leftArm.rotation.x = -s * amp * 0.8
    this.rightArm.rotation.x = s * amp * 0.8
  }

  dispose() {
    this.numberTex?.dispose()
  }
}
