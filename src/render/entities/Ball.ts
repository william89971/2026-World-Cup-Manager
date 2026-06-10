import * as THREE from 'three'

/** Classic black-pentagon / white-hexagon football texture. */
function ballTexture(): THREE.CanvasTexture {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#f6f6f6'
  ctx.fillRect(0, 0, S, S)

  const pentagon = (cx: number, cy: number, r: number, rot = 0) => {
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * Math.PI * 2 - Math.PI / 2
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = '#141414'
    ctx.fill()
  }

  // staggered pentagon lattice (wraps horizontally on the sphere seam)
  const r = 26
  for (let row = 0; row < 3; row++) {
    const y = 42 + row * 86
    const offset = row % 2 === 0 ? 0 : 64
    for (let col = 0; col < 3; col++) {
      pentagon(offset + 22 + col * 128 - (offset ? 64 : 0) + 42, y, r, row * 0.4)
    }
  }
  // faint hexagon seams
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 2
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const cx = col * 72 + (row % 2) * 36
      const cy = row * 72
      ctx.beginPath()
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const x = cx + Math.cos(a) * 34
        const y = cy + Math.sin(a) * 34
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
  return new THREE.CanvasTexture(cv)
}

const TRAIL_LEN = 9
/** Oversized for readability — the ball must be the most prominent object. */
const RADIUS = 0.36

export class Ball {
  readonly mesh: THREE.Mesh
  /** Parent for the ball + its glow, ground shadow and trail. */
  readonly group = new THREE.Group()
  private target = new THREE.Vector3(0, RADIUS, 0)
  private trail: THREE.Mesh[] = []
  private history: THREE.Vector3[] = []
  private lastPos = new THREE.Vector3()
  private shadow: THREE.Mesh
  private glow: THREE.PointLight

  constructor() {
    const tex = ballTexture()
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 24, 18),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.38, // self-lit so it reads in any weather
      }),
    )
    this.mesh.castShadow = true
    this.mesh.position.copy(this.target)
    this.group.add(this.mesh)

    // soft white glow travelling with the ball
    this.glow = new THREE.PointLight(0xffffff, 6, 9, 2)
    this.group.add(this.glow)

    // bold contact shadow so the ball's pitch position is always readable
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const ctx = cv.getContext('2d')!
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 32)
    grad.addColorStop(0, 'rgba(0,0,0,0.6)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 64)
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }),
    )
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.position.y = 0.02
    this.group.add(this.shadow)

    // motion-blur trail: fading ghost spheres shown only on fast shots
    const trailGeo = new THREE.SphereGeometry(RADIUS * 0.8, 8, 6)
    for (let i = 0; i < TRAIL_LEN; i++) {
      const m = new THREE.Mesh(
        trailGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.28 * (1 - i / TRAIL_LEN),
          depthWrite: false,
        }),
      )
      m.visible = false
      this.trail.push(m)
      this.group.add(m)
    }
  }

  /** @param x,z ground position (metres)  @param height ball height (metres) */
  update(x: number, z: number, height: number, dt: number) {
    this.target.set(x, Math.max(RADIUS, height + RADIUS), z)
    this.mesh.position.lerp(this.target, Math.min(1, dt * 22))
    this.glow.position.set(this.mesh.position.x, this.mesh.position.y + 0.4, this.mesh.position.z)
    this.shadow.position.set(this.mesh.position.x, 0.02, this.mesh.position.z)
    // shadow shrinks slightly as the ball rises
    const air = Math.min(1, Math.max(0, this.mesh.position.y - RADIUS) / 4)
    this.shadow.scale.setScalar(1 - air * 0.4)

    // spin for a sense of motion
    this.mesh.rotation.x += dt * 4
    this.mesh.rotation.y += dt * 2.5

    // trail history + visibility based on speed
    const speed = dt > 0 ? this.mesh.position.distanceTo(this.lastPos) / dt : 0
    this.lastPos.copy(this.mesh.position)
    this.history.unshift(this.mesh.position.clone())
    if (this.history.length > TRAIL_LEN * 2) this.history.pop()
    const fast = speed > 7
    this.trail.forEach((m, i) => {
      const h = this.history[(i + 1) * 2]
      m.visible = fast && !!h
      if (h) m.position.copy(h)
    })
  }
}
