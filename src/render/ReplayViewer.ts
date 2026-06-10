import * as THREE from 'three'
import type { GoalReplay } from '../match/replay'
import { Stadium } from './entities/Stadium'
import { Ball } from './entities/Ball'
import { Humanoid } from './entities/Humanoid'

/** Standalone looping player for a saved goal replay (post-match viewer).
 *  Self-contained Three scene — independent of the live MatchRenderer. */
export class ReplayViewer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private ball = new Ball()
  private figures = new Map<string, Humanoid>()
  private replay: GoalReplay
  private t = 0
  private readonly dur = 5.5
  private raf = 0
  private last = 0
  private container: HTMLElement
  private look = new THREE.Vector3()

  constructor(container: HTMLElement, replay: GoalReplay) {
    this.container = container
    this.replay = replay
    const w = container.clientWidth || 640
    const h = container.clientHeight || 360

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x0a1424)
    this.scene.fog = new THREE.Fog(0x0a1424, 140, 320)
    this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x2a5530, 1.1))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(40, 80, 30)
    this.scene.add(sun)

    this.scene.add(new Stadium().group)
    this.scene.add(this.ball.group)

    // build figures for everyone present in the clip
    const ids = new Set<string>()
    for (const f of replay.frames) for (const p of f.players) ids.add(p.id)
    for (const id of ids) {
      const meta = replay.meta[id]
      const kit = meta?.side === 'away' ? replay.kits.away : replay.kits.home
      const colors = meta?.gk
        ? { shirt: kit.goalkeeper, shorts: kit.goalkeeper }
        : { shirt: kit.primary, shorts: kit.secondary }
      const fig = new Humanoid(colors)
      this.scene.add(fig.group)
      this.figures.set(id, fig)
    }

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 600)
    this.loop = this.loop.bind(this)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000))
    this.last = now
    this.t += dt
    if (this.t >= this.dur + 0.8) this.t = 0 // loop with a beat at the end

    const frames = this.replay.frames
    const n = frames.length
    const f = Math.min(1, this.t / this.dur) * (n - 1)
    const i = Math.min(n - 2, Math.floor(f))
    const frac = f - i
    const a = frames[i]
    const b = frames[i + 1]

    for (const pa of a.players) {
      const fig = this.figures.get(pa.id)
      if (!fig) continue
      const pb = b.players.find((q) => q.id === pa.id) ?? pa
      const x = pa.x + (pb.x - pa.x) * frac
      const z = pa.y + (pb.y - pa.y) * frac
      const speed = Math.hypot(pb.x - pa.x, pb.y - pa.y) / 0.2
      fig.group.position.set(x, 0, z)
      fig.update(speed, speed > 0.5 ? Math.atan2(pb.x - pa.x, pb.y - pa.y) : 0, dt)
    }
    const bx = a.ball.x + (b.ball.x - a.ball.x) * frac
    const bz = a.ball.y + (b.ball.y - a.ball.y) * frac
    const bh = a.ball.z + (b.ball.z - a.ball.z) * frac
    this.ball.update(bx, bz, bh, dt)

    // dramatic low side-on angle tracking the ball
    const ballPos = this.ball.mesh.position
    const side = ballPos.z >= 0 ? 1 : -1
    const camTarget = new THREE.Vector3(ballPos.x * 0.55 + 14, 2.8, ballPos.z - side * 11)
    this.camera.position.lerp(camTarget, Math.min(1, dt * 2.2))
    this.look.lerp(new THREE.Vector3(ballPos.x, 0.6, ballPos.z), Math.min(1, dt * 4))
    this.camera.lookAt(this.look)

    this.renderer.render(this.scene, this.camera)
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    for (const f of this.figures.values()) f.dispose()
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
