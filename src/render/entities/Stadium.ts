import * as THREE from 'three'
import { PITCH } from '../../engine/constants'

// Engine coords (x:[-34,34], y:[-52.5,52.5]) map to Three (x, z); height = Three y.

function makePitchTexture(): THREE.CanvasTexture {
  const scale = 10 // px per metre
  const W = PITCH.W * scale
  const L = PITCH.L * scale
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = L
  const ctx = cv.getContext('2d')!

  // mowing stripes along the length
  const bands = 16
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2f8f3f' : '#2a8238'
    ctx.fillRect(0, (i * L) / bands, W, L / bands)
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 3
  const mx = (ex: number) => (ex + PITCH.HALF_W) * scale
  const mz = (ez: number) => (ez + PITCH.HALF_L) * scale
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

/** Instanced crowd silhouettes dotted across the stands. */
function buildCrowd(): THREE.InstancedMesh {
  const count = 4000
  const geo = new THREE.BoxGeometry(0.4, 0.7, 0.4)
  const mat = new THREE.MeshStandardMaterial({ roughness: 1 })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const ringX = PITCH.HALF_W + 8
  const ringZ = PITCH.HALF_L + 8
  let i = 0
  // deterministic-ish scatter without Math.random dependence on first frame
  const rnd = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1
  while (i < count) {
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
    dummy.position.set(x, 1.5 + tier * 4 + r * 1.5, z)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    color.setHSL(rnd(i + 7), 0.5, 0.45 + rnd(i + 3) * 0.3)
    mesh.setColorAt(i, color)
    i++
  }
  return mesh
}

export class Stadium {
  readonly group = new THREE.Group()

  constructor() {
    const tex = makePitchTexture()
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
      new THREE.MeshStandardMaterial({ color: 0x256b30, roughness: 1 }),
    )
    apron.rotation.x = -Math.PI / 2
    apron.position.y = -0.02
    this.group.add(apron)

    this.group.add(buildGoal(1), buildGoal(-1), buildCornerFlags(), buildStands(), buildCrowd())
  }
}
