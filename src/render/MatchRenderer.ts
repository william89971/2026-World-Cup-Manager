import * as THREE from 'three'
import type { MatchSetup, Side, SimPlayer, WorldState } from '../engine/types'
import { Stadium } from './entities/Stadium'
import { Ball } from './entities/Ball'
import { Humanoid } from './entities/Humanoid'
import { MatchCamera, type CameraMode } from './camera/MatchCamera'

interface Figure {
  h: Humanoid
  facing: number
  prevKickCd: number
}

export class MatchRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private cam: MatchCamera
  private ball = new Ball()
  private figures = new Map<string, Figure>()
  private container: HTMLElement
  private setup: MatchSetup

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

    this.scene.background = new THREE.Color(0x0a1424)
    this.scene.fog = new THREE.Fog(0x0a1424, 140, 320)

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x2a5530, 1.1)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(40, 80, 30)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const c = sun.shadow.camera as THREE.OrthographicCamera
    c.left = -70; c.right = 70; c.top = 90; c.bottom = -90; c.near = 1; c.far = 220
    this.scene.add(sun)

    this.scene.add(new Stadium().group)
    this.scene.add(this.ball.mesh)

    this.cam = new MatchCamera(w / h, this.renderer.domElement)
  }

  private kitFor(side: Side, role: string): { shirt: string; shorts: string } {
    const kit = side === 'home' ? this.setup.home.kit : this.setup.away.kit
    if (role === 'GK') return { shirt: kit.goalkeeper, shorts: kit.goalkeeper }
    return { shirt: kit.primary, shorts: kit.secondary }
  }

  private ensure(p: SimPlayer): Figure {
    let f = this.figures.get(p.id)
    if (!f) {
      const h = new Humanoid(this.kitFor(p.side, p.role))
      this.scene.add(h.group)
      f = { h, facing: p.side === 'home' ? 0 : Math.PI, prevKickCd: 0 }
      this.figures.set(p.id, f)
    }
    return f
  }

  /** Sync visuals to the latest engine world for one rendered frame. */
  update(world: WorldState, dt: number) {
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
      fig.h.update(speed, fig.facing, dt)
    }

    this.ball.update(world.ball.pos.x, world.ball.pos.y, world.ball.z, dt)
    this.cam.update(this.ball.mesh.position.x, this.ball.mesh.position.z, dt)
    this.renderer.render(this.scene, this.cam.camera)
  }

  /** Cinematic cut to a pitch position (engine x,y). */
  cutTo(x: number, y: number) {
    this.cam.cutTo(x, y)
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
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const m = o.material
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m.dispose()
      }
    })
  }
}
