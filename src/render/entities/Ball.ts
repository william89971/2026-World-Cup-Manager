import * as THREE from 'three'

export class Ball {
  readonly mesh: THREE.Mesh
  private target = new THREE.Vector3(0, 0.12, 0)

  constructor() {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 64, 64)
    ctx.fillStyle = '#111'
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.arc(12 + (i % 3) * 22, 14 + Math.floor(i / 3) * 30, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    const tex = new THREE.CanvasTexture(cv)
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }),
    )
    this.mesh.castShadow = true
    this.mesh.position.copy(this.target)
  }

  /** @param x,z ground position (metres)  @param height ball height (metres) */
  update(x: number, z: number, height: number, dt: number) {
    this.target.set(x, Math.max(0.12, height + 0.12), z)
    this.mesh.position.lerp(this.target, Math.min(1, dt * 22))
    // spin for a sense of motion
    this.mesh.rotation.x += dt * 6
    this.mesh.rotation.y += dt * 4
  }
}
