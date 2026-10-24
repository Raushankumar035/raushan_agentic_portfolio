// Agent 404: the shy sixth agent. Hides behind the Core and peeks out when nobody's looking.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig, HUB_DIST } from '../../lib/rig'
import { clamp } from '../../lib/math'
import { useStore } from '../../store'
import { sound } from '../../lib/sound'
import { AGENT_404 } from '../../content/secrets'
import { DEG, VISOR_R, VISOR_Z, robotGeometry, robotMaterials } from '../robot'

const DEF = { id: '404', color: '#cbd5e1', deep: '#334155', icon: 'question' }
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _hide = new THREE.Vector3()
const _peek = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()

const ease = (p) => p * p * (3 - 2 * p)

export default function Agent404() {
  const g = robotGeometry()
  const m = useMemo(() => robotMaterials(DEF), [])
  const root = useRef()
  const head = useRef()
  const armL = useRef()
  const armR = useRef()
  const icon = useRef()
  const st = useRef({ mode: 'wait', at: 0, next: 14 + Math.random() * 10, side: 1, p: 0, catches: 0 })

  useFrame((state, dt) => {
    const s = st.current
    const t = state.clock.elapsedTime
    const cam = state.camera
    const home = rig.phase === 'hub' && rig.hub.dist < HUB_DIST * 1.8
    if (!home) {
      s.mode = 'wait'
      s.p = 0
      s.next = Math.max(s.next, t + 6)
      root.current.visible = false
      return
    }
    // tiny state machine: wait → out → look → back
    if (s.mode === 'wait' && t > s.next) {
      s.mode = 'out'
      s.at = t
      s.side = Math.random() < 0.5 ? -1 : 1
    }
    if (s.mode === 'out') {
      s.p = clamp((t - s.at) / 0.55, 0, 1)
      if (s.p >= 1) {
        s.mode = 'look'
        s.at = t
      }
    } else if (s.mode === 'look') {
      if (t - s.at > 2.8) {
        s.mode = 'back'
        s.at = t
      }
    } else if (s.mode === 'back' || s.mode === 'caught') {
      const d = s.mode === 'caught' ? 0.22 : 0.45
      s.p = 1 - clamp((t - s.at) / d, 0, 1)
      if (s.p <= 0) {
        s.mode = 'wait'
        s.next = t + 18 + Math.random() * 16
      }
    }
    root.current.visible = s.p > 0.001
    if (!root.current.visible) return

    const R = rig.L.portraitR
    _fwd.set(0, 0, -1).applyQuaternion(cam.quaternion)
    _right.set(1, 0, 0).applyQuaternion(cam.quaternion)
    _up.set(0, 1, 0).applyQuaternion(cam.quaternion)
    _hide.set(0, 0, 0).addScaledVector(_fwd, 1.6).addScaledVector(_right, s.side * 0.3).addScaledVector(_up, -0.4)
    _peek.set(0, 0, 0).addScaledVector(_fwd, 0.7).addScaledVector(_right, s.side * (R + 0.42)).addScaledVector(_up, -0.55)
    const k = ease(s.p)
    root.current.position.lerpVectors(_hide, _peek, k)
    _e.set(0, -s.side * 0.5 * k, s.side * 0.28 * k)
    _q.setFromEuler(_e)
    root.current.quaternion.copy(cam.quaternion).multiply(_q)
    root.current.scale.setScalar(0.6)
    const look = s.mode === 'look' ? Math.sin((t - s.at) * 2.4) : 0
    head.current.rotation.set(0.1 + Math.sin(t * 3) * 0.04, look * 0.5, -look * 0.1)
    const wave = s.mode === 'look' && t - s.at > 1.2 && t - s.at < 2.2 ? 1 : 0
    const near = s.side > 0 ? armL : armR
    const far = s.side > 0 ? armR : armL
    near.current.rotation.set(-20 * DEG, 0, (s.side > 0 ? -1 : 1) * (40 + wave * (110 + Math.sin(t * 14) * 20)) * DEG)
    far.current.rotation.set(-10 * DEG, 0, (s.side > 0 ? 1 : -1) * 24 * DEG)
    icon.current.scale.setScalar(Math.sin(t * 5) > 0.92 ? 0.2 : 1)
  })

  const onClick = (e) => {
    e.stopPropagation()
    const s = st.current
    if (s.p < 0.4 || s.mode === 'caught') return
    s.mode = 'caught'
    s.at = rig.time
    s.catches++
    sound.pop()
    sound.chirp(1.5, 4)
    const st0 = useStore.getState()
    st0.toast({ kind: 'note', title: 'Agent 404', text: AGENT_404[Math.min(s.catches, AGENT_404.length) - 1], ms: 6500 })
    if (s.catches >= 3) st0.award('debugger')
    s.next = rig.time + 5
  }

  return (
    <group ref={root} visible={false}>
      <group position={[0, -0.68, 0]}>
        <group position={[0, 0.68, 0]}>
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh geometry={g.leg} material={m.accent} position={[sd * 0.13, -0.42, 0]} />
              <mesh geometry={g.foot} material={m.shell} position={[sd * 0.14, -0.6, 0.05]} scale={[1, 0.62, 1.3]} />
            </group>
          ))}
          {[
            [-1, armL],
            [1, armR],
          ].map(([sd, ref]) => (
            <group key={sd} ref={ref} position={[sd * 0.27, 0.03, 0]}>
              <mesh geometry={g.arm} material={m.accent} />
              <mesh geometry={g.hand} material={m.accent} position={[0, -0.34, 0]} />
            </group>
          ))}
          <mesh geometry={g.body} material={m.shell} position={[0, -0.12, 0]} scale={[1, 0.95, 0.88]} />
          <group position={[0, 0.16, 0]}>
            <group ref={head}>
              <group position={[0, 0.46, 0]}>
                <mesh geometry={g.head} material={m.shell} scale={[1.18, 1, 1.02]} />
                <mesh geometry={g.visor} material={m.glass} position={[0, 0, VISOR_Z]} scale={[VISOR_R[0] * 2, VISOR_R[1] * 2, VISOR_R[2] * 2]} />
                <mesh geometry={g.rim} material={m.neon} />
                <mesh ref={icon} geometry={g.icon} material={m.icon} position={[0, 0.02, 0.555]} />
                {[-1, 1].map((sd) => (
                  <mesh key={sd} geometry={g.ear} material={m.accent} position={[sd * 0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
                ))}
                <mesh geometry={g.stem} material={m.accent} position={[0, 0.52, 0]} />
                <mesh geometry={g.knob} material={m.neon} position={[0, 0.6, 0]} />
              </group>
            </group>
          </group>
        </group>
      </group>
      <mesh geometry={g.hit} position={[0, 0.25, 0]} onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}
