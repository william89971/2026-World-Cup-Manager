import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type CameraMode = 'follow' | 'free' | 'broadcast'

/** Ball-following camera with smooth pan/zoom plus an optional free-look mode. */
export class MatchCamera {
  readonly camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private mode: CameraMode = 'follow'
  private look = new THREE.Vector3()
  private desired = new THREE.Vector3()
  private zoom = 1
  private cut = 0
  private cutPos = new THREE.Vector3()

  constructor(aspect: number, dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.5, 600)
    this.camera.position.set(0, 38, 58)
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

  update(ballX: number, ballZ: number, dt: number) {
    if (this.mode === 'free') {
      this.controls.update()
      return
    }

    const focusX = this.cut > 0 ? this.cutPos.x : ballX
    const focusZ = this.cut > 0 ? this.cutPos.z : ballZ
    this.look.lerp(new THREE.Vector3(focusX, 1, focusZ), Math.min(1, dt * 3))

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
    this.camera.position.lerp(this.desired, Math.min(1, dt * 2.4))
    this.camera.lookAt(this.look)
  }

  resize(aspect: number) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.controls.dispose()
  }
}
