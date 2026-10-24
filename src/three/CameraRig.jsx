// One camera, three modes: hub (orbit the Core), travel (fly a curve), shot (a chapter beat).
// Every mode only sets a target; critically damped springs make every change fluid.
import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HUB_DIST, rig } from '../lib/rig'
import { DEG, TAU, clamp, damp, smooth, spring3 } from '../lib/math'
import { hubShot, nextBeat, prevBeat, shotCtx } from '../lib/director'
import { sound } from '../lib/sound'
import { useStore } from '../store'
import { hums } from './secrets/Signal'

const UP = new THREE.Vector3(0, 1, 0)
const _ahead = new THREE.Vector3()
const _off = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _target = new THREE.Vector3()
const _hubRight = new THREE.Vector3()

const MIN_DIST = HUB_DIST * 0.72
const MAX_DIST = 1500

function useControls() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    const pts = new Map()
    let pinch = 0
    let wheelAcc = 0
    let wheelAt = 0
    let lastBeatAt = 0

    const down = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY })
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const ptr = rig.pointer
      ptr.x = e.clientX - r.left
      ptr.y = e.clientY - r.top
      ptr.nx = (ptr.x / r.width) * 2 - 1
      ptr.ny = (ptr.y / r.height) * 2 - 1
      ptr.active = true
      ptr.at = performance.now()
      rig.hub.px = ptr.nx
      rig.hub.py = ptr.ny
      const p = pts.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0 && rig.camMode === 'hub') rig.hub.tdist = clamp(rig.hub.tdist * (pinch / d), MIN_DIST, MAX_DIST)
        pinch = d
        return
      }
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 5) return
      if (rig.camMode === 'hub' && rig.phase === 'hub') {
        rig.hub.dragging = true
        rig.hub.taz -= dx * 0.0052
        rig.hub.tel = clamp(rig.hub.tel + dy * 0.004, 0.04, 1.4)
        rig.hub.lastInput = performance.now()
      } else if (rig.camMode === 'shot') {
        const ch = rig.chapter
        ch.tyaw = clamp(ch.tyaw - dx * 0.0042, -0.75, 0.75)
        ch.tpitch = clamp(ch.tpitch + dy * 0.0032, -0.4, 0.4)
      }
    }
    const up = (e) => {
      pts.delete(e.pointerId)
      if (pts.size < 2) pinch = 0
      if (!pts.size) rig.hub.dragging = false
    }
    const leave = () => (rig.pointer.active = false)
    const wheel = (e) => {
      if (rig.camMode === 'hub' && rig.phase === 'hub') {
        e.preventDefault()
        rig.hub.tdist = clamp(rig.hub.tdist * Math.exp(e.deltaY * 0.0011), MIN_DIST, MAX_DIST)
        rig.hub.lastInput = performance.now()
      } else if (rig.camMode === 'shot') {
        e.preventDefault()
        const now = performance.now()
        if (now - wheelAt > 300) wheelAcc = 0
        wheelAt = now
        wheelAcc += e.deltaY
        if (Math.abs(wheelAcc) > 90 && now - lastBeatAt > 700) {
          lastBeatAt = now
          if (wheelAcc > 0) nextBeat()
          else prevBeat()
          wheelAcc = 0
        }
      }
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl])
}

export default function CameraRig() {
  useControls()
  const camera = useThree((s) => s.camera)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    rig.time = state.clock.elapsedTime
    rig.camera = camera
    const W = rig.want
    const C = rig.cam
    const mode = rig.camMode
    let omega = 3
    let lookOmega = 3

    if (mode === 'hub') {
      const h = rig.hub
      h.az = damp(h.az, h.taz, 6, dt)
      h.el = damp(h.el, h.tel, 6, dt)
      h.dist = damp(h.dist, h.tdist, 4.5, dt)
      h.sx = damp(h.sx, h.dragging ? 0 : h.px, 2.2, dt)
      h.sy = damp(h.sy, h.dragging ? 0 : h.py, 2.2, dt)
      const f = hubShot(W.pos, W.look)
      W.fov = f.fov
      W.fx = f.fx
      W.fy = f.fy
      // pointer parallax, scaled down as you zoom out
      const k = rig.reduce ? 0 : 1 - smooth(HUB_DIST, HUB_DIST * 3, h.dist)
      _hubRight.set(Math.cos(h.az), 0, -Math.sin(h.az))
      W.pos.addScaledVector(_hubRight, h.sx * 0.9 * k)
      W.pos.y -= h.sy * 0.45 * k
      W.look.addScaledVector(_hubRight, h.sx * 0.12 * k)
      W.look.y -= h.sy * 0.06 * k
      omega = 7
      lookOmega = 7
      if (h.dist > 620) useStore.getState().award('outside')
    } else if (mode === 'travel' && rig.travel.curve) {
      const T = rig.travel
      const t = T.t
      T.curve.getPointAt(t, W.pos)
      T.curve.getPointAt(Math.min(1, t + 0.06), _ahead)
      W.look.copy(T.look0).lerp(_ahead, smooth(0, 0.28, t)).lerp(T.look1, smooth(0.55, 0.94, t))
      const base = T.fov0 + (T.fov1 - T.fov0) * smooth(0, 1, t)
      W.fov = base + Math.pow(Math.sin(Math.PI * t), 1.5) * Math.max(0, T.peak - base)
      W.fx = T.fx0 + (T.fx1 - T.fx0) * smooth(0.45, 1, t)
      W.fy = T.fy0 + (T.fy1 - T.fy0) * smooth(0.45, 1, t)
      omega = 14
      lookOmega = 10
    } else if (mode === 'shot') {
      const s = useStore.getState()
      const w = rig.worlds[s.agent]
      if (w) {
        const f = w.shot(s.beat, W.pos, W.look, shotCtx())
        W.fov = f.fov
        W.fx = f.fx
        W.fy = f.fy
        // the visitor can look around a little; the director resets it on every beat
        const ch = rig.chapter
        ch.yaw = damp(ch.yaw, ch.tyaw, 5, dt)
        ch.pitch = damp(ch.pitch, ch.tpitch, 5, dt)
        if (Math.abs(ch.yaw) + Math.abs(ch.pitch) > 1e-4) {
          _off.copy(W.pos).sub(W.look)
          _off.applyAxisAngle(UP, ch.yaw)
          _right.crossVectors(_off, UP).normalize()
          _off.applyAxisAngle(_right, ch.pitch)
          W.pos.copy(W.look).add(_off)
        }
      }
      omega = 2.4
      lookOmega = 2.8
    }

    spring3(C.pos, W.pos, C.vel, omega, dt)
    spring3(C.look, W.look, C.lookVel, lookOmega, dt)
    C.fov = damp(C.fov, W.fov, mode === 'travel' ? 12 : 3.2, dt)
    C.fx = damp(C.fx, W.fx, mode === 'travel' ? 12 : 3, dt)
    C.fy = damp(C.fy, W.fy, mode === 'travel' ? 12 : 3, dt)

    camera.position.copy(C.pos)
    if (C.shake > 0.001) {
      const k = C.shake * 0.35
      camera.position.x += (Math.random() - 0.5) * k
      camera.position.y += (Math.random() - 0.5) * k
      C.shake = damp(C.shake, 0, 3.5, dt)
    }
    // frame shift: aim off-centre so the focus lands at (fx, fy) on screen
    _fwd.copy(C.look).sub(C.pos)
    const dist = Math.max(0.001, _fwd.length())
    _fwd.divideScalar(dist)
    _right.crossVectors(_fwd, UP).normalize()
    _up.crossVectors(_right, _fwd)
    const halfH = dist * Math.tan((C.fov * DEG) / 2)
    const halfW = halfH * camera.aspect
    _target.copy(C.look).addScaledVector(_right, -C.fx * halfW).addScaledVector(_up, -C.fy * halfH)
    camera.lookAt(_target)
    if (Math.abs(camera.fov - C.fov) > 1e-3) {
      camera.fov = C.fov
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()

    // speed → warp streaks, aberration and the engine sound
    rig.camVel.copy(C.vel)
    const speed = C.vel.length()
    rig.warp = damp(rig.warp, smooth(30, 170, speed) * (mode === 'travel' ? 1 : 0.35), 6, dt)

    let hum = 0
    for (const k in hums) hum = Math.max(hum, hums[k])
    rig.hum = hum
    sound.update(rig.warp, hum)

    rig.party = damp(rig.party, rig.partyOn ? 1 : 0, 3, dt)
    if (!rig.reduce) rig.orbit.base += dt * (TAU / 80) * rig.orbit.speed
  }, -10)

  return null
}
