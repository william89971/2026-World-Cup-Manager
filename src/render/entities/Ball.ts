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

export class Ball {
  readonly mesh: THREE.Mesh
  /** Parent for the ball + its motion-blur trail. Add this to the scene. */
  readonly group = new THREE.Group()
  private target = new THREE.Vector3(0, 0.12, 0)
  private trail: THREE.Mesh[] = []
  private history: THREE.Vector3[] = []
  private lastPos = new THREE.Vector3()

  constructor() {
    const tex = ballTexture()
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 20, 14),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }),
    )
    this.mesh.castShadow = true
    this.mesh.position.copy(this.target)
    this.group.add(this.mesh)

    // motion-blur trail: fading ghost spheres shown only on fast shots
    const trailGeo = new THREE.SphereGeometry(0.1, 8, 6)
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
    this.target.set(x, Math.max(0.12, height + 0.12), z)
    this.mesh.position.lerp(this.target, Math.min(1, dt * 22))

    // spin for a sense of motion
    this.mesh.rotation.x += dt * 6
    this.mesh.rotation.y += dt * 4

    // trail history + visibility based on speed
    const speed = dt > 0 ? this.mesh.position.distanceTo(this.lastPos) / dt : 0
    this.lastPos.copy(this.mesh.position)
    this.history.unshift(this.mesh.position.clone())
    if (this.history.length > TRAIL_LEN * 2) this.history.pop()
    const fast = speed > 14
    this.trail.forEach((m, i) => {
      const h = this.history[(i + 1) * 2]
      m.visible = fast && !!h
      if (h) m.position.copy(h)
    })
  }
}
