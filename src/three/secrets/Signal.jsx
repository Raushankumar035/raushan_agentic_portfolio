// A lost signal: a small sonar-pinging orb. It hums louder as the camera gets close.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { rig } from '../../lib/rig'
import { damp, smooth } from '../../lib/math'
import { useStore } from '../../store'
import { signalFrag, signalVert } from '../shaders'
import { stageOf } from '../worlds/common'

const _w = new THREE.Vector3()
const _q = new THREE.Quaternion()

// proximity per signal, read by the camera rig to drive the hum
export const hums = {}

export default function Signal({ where, position, size = 2.2, color = '#bfe9ff', children }) {
  const root = useRef()
  const orb = useRef()
  const kids = useRef()
  const collected = useStore((s) => s.signals.includes(where))
  const st = useRef({ fade: 0, pop: 0 })
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: signalVert,
        fragmentShader: signalFrag,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color).multiplyScalar(1.8) }, uAlpha: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color],
  )

  useFrame((state, dt) => {
    const g = root.current
    if (!g) return
    const live = where === 'hub' ? rig.phase === 'hub' : stageOf(where) > 0 && rig.phase === 'chapter'
    const s = st.current
    s.fade = damp(s.fade, collected ? 0 : live ? 1 : 0, 3, dt)
    const vis = s.fade > 0.01 || s.pop > 0.01
    g.visible = vis
    hums[where] = 0
    if (!vis) return
    orb.current.getWorldPosition(_w)
    const d = state.camera.position.distanceTo(_w)
    hums[where] = smooth(70, 14, d) * s.fade
    g.getWorldQuaternion(_q)
    orb.current.quaternion.copy(_q.invert()).multiply(state.camera.quaternion)
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uAlpha.value = s.fade + s.pop * 2
    orb.current.scale.setScalar(size * (1 + s.pop * 2.5) * (0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 3)))
    if (kids.current) kids.current.scale.setScalar(Math.max(0.001, s.fade))
  })

  const onClick = (e) => {
    e.stopPropagation()
    if (collected || st.current.fade < 0.5 || e.delta > 6) return
    useStore.getState().collect(where)
    gsap.fromTo(st.current, { pop: 1 }, { pop: 0, duration: 0.9, ease: 'power2.out' })
  }

  return (
    <group
      ref={root}
      position={position}
      visible={false}
      onClick={onClick}
      onPointerOver={() => !collected && (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh ref={orb} material={mat}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={kids}>{children}</group>
    </group>
  )
}
