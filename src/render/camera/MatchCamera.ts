import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type CameraMode = 'follow' | 'free' | 'broadcast'

/** Critically-damped vector smoothing (eases in and out, never overshoots). */
class SmoothVec3 {
  value = new THREE.Vector3()
  private vel = new THREE.Vector3()
  private change = new THREE.Vector3()
  private temp = new THREE.Vector3()

  to(target: THREE.Vector3, smoothTime: number, dt: number) {
    const omega = 2 / Math.max(0.0001, smoothTime)
    const x = omega * dt
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
    this.change.copy(this.value).sub(target)
    // temp = (vel + omega * change) * dt
    this.temp.copy(this.change).multiplyScalar(omega).add(this.vel).multiplyScalar(dt)
    // vel = (vel - omega * temp) * exp
    this.vel.addScaledVector(this.temp, -omega).multiplyScalar(exp)
    // value = target + (change + temp) * exp
    this.value.copy(target).addScaledVector(this.change.add(this.temp), exp)
  }

  snap(v: THREE.Vector3) {
    this.value.copy(v)
    this.vel.set(0, 0, 0)
  }
}

/** Ball-following camera with eased pan/zoom, cinematic pans and goal cuts. */
export class MatchCamera {
  readonly camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private mode: CameraMode = 'follow'
  private look = new SmoothVec3()
  private pos = new SmoothVec3()
  private desired = new THREE.Vector3()
  private zoom = 1
  private cut = 0
  private cutPos = new THREE.Vector3()
  private pan = 0
  private panDur = 0

  constructor(aspect: number, dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.5, 600)
    this.camera.position.set(0, 38, 58)
    this.pos.snap(this.camera.position)
    this.controls = new OrbitControls(this.camera, dom)
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = Math.PI * 0.49
    this.controls.minDistance = 12
    this.controls.maxDistance = 140
    this.controls.enabled = false
  }

  setMode(mode: CameraMode) {
    this.mode = mode
    this.controls.enabled = mode === 'free'
  }

  getMode(): CameraMode {
    return this.mode
  }

  setZoom(z: number) {
    this.zoom = THREE.MathUtils.clamp(z, 0.5, 2)
  }

  /** Brief cinematic cut focusing on a pitch position (e.g. a goal). */
  cutTo(x: number, z: number, seconds = 1.6) {
    this.cut = seconds
    this.cutPos.set(x, 1, z)
  }

  /** Slow sweeping pan across the pitch (kick-off / half-time). */
  cinematicPan(seconds = 3.5) {
    this.pan = seconds
    this.panDur = seconds
  }

  /** Smoothly frame an arbitrary position/look-at (shootout staging etc). */
  frameTo(px: number, py: number, pz: number, lx: number, ly: number, lz: number, dt: number) {
    this.pos.to(new THREE.Vector3(px, py, pz), 0.6, dt)
    this.look.to(new THREE.Vector3(lx, ly, lz), 0.4, dt)
    this.camera.position.copy(this.pos.value)
    this.camera.lookAt(this.look.value)
  }

  /** Low, dramatic angle used while a goal replay plays. */
  replayUpdate(ballX: number, ballZ: number, dt: number) {
    const side = ballZ >= 0 ? 1 : -1
    const target = new THREE.Vector3(ballX * 0.55 + 14, 2.6, ballZ - side * 10)
    this.pos.to(target, 0.55, dt)
    this.look.to(new THREE.Vector3(ballX, 0.6, ballZ), 0.3, dt)
    this.camera.position.copy(this.pos.value)
    this.camera.lookAt(this.look.value)
  }

  update(ballX: number, ballZ: number, dt: number) {
    if (this.mode === 'free') {
      this.controls.update()
      return
    }

    // cinematic pan overrides normal tracking (kick-off, half-time)
    if (this.pan > 0) {
      this.pan -= dt
      const t = 1 - this.pan / this.panDur // 0→1
      const ease = t * t * (3 - 2 * t) // smoothstep
      const ang = -0.7 + ease * 1.4
      this.desired.set(Math.sin(ang) * 62, 19 + Math.sin(ease * Math.PI) * 7, Math.cos(ang) * 62)
      this.pos.to(this.desired, 0.7, dt)
      this.look.to(new THREE.Vector3(0, 1, 0), 0.5, dt)
      this.camera.position.copy(this.pos.value)
      this.camera.lookAt(this.look.value)
      return
    }

    const focusX = this.cut > 0 ? this.cutPos.x : ballX
    const focusZ = this.cut > 0 ? this.cutPos.z : ballZ
    this.look.to(new THREE.Vector3(focusX, 1, focusZ), 0.35, dt)

    if (this.cut > 0) {
      this.cut -= dt
      // low, close cinematic angle
      this.desired.set(focusX * 0.6, 9, focusZ + 16)
    } else if (this.mode === 'broadcast') {
      this.desired.set(0, 46 * this.zoom, 70 * this.zoom)
    } else {
      // follow: trail the ball from a raised angle
      this.desired.set(focusX * 0.5, 30 * this.zoom, focusZ + 42 * this.zoom)
    }
    this.pos.to(this.desired, 0.45, dt)
    this.camera.position.copy(this.pos.value)
    this.camera.lookAt(this.look.value)
  }

  resize(aspect: number) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.controls.dispose()
  }
}
