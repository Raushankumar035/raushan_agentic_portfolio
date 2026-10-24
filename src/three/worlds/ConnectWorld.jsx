// Connect: a rose world with a great relay dish. Send a message and it fires into the galaxy.
import { useCallback, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { agentById } from '../../agents'
import { CHAPTERS } from '../../content/chapters'
import { rig } from '../../lib/rig'
import { damp } from '../../lib/math'
import { useStore } from '../../store'
import Planet from '../Planet'
import Signal from '../secrets/Signal'
import { heartGeometry } from '../robot'
import { beamFrag, beamVert } from '../shaders'
import { UP, around, azToCore, chapterFrame, useWorld } from './common'

const ID = 'connect'
const HEARTS = 14

function dishGeometry() {
  const pts = []
  for (let i = 0; i <= 24; i++) {
    const r = (i / 24) * 3.4
    pts.push(new THREE.Vector2(r, r * r * 0.11))
  }
  for (let i = 24; i >= 0; i--) {
    const r = (i / 24) * 3.4
    pts.push(new THREE.Vector2(r * 0.985, r * r * 0.11 - 0.1))
  }
  return new THREE.LatheGeometry(pts, 72)
}

export default function ConnectWorld() {
  const agent = agentById(ID)
  const P = useMemo(() => new THREE.Vector3(...agent.world.pos), [agent])
  const front = useMemo(() => azToCore(P), [P])
  // the heart crater is baked facing the Relay's first camera shot (the planet doesn't spin)
  const world = useMemo(() => {
    const w = agent.world
    const cam = around(new THREE.Vector3(), front - 0.25, 0.32, 1)
    const right = new THREE.Vector3().crossVectors(cam.clone().negate(), UP).normalize()
    const dir = cam.clone().addScaledVector(UP, -0.32).addScaledVector(right, 0.12).normalize()
    const local = dir.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(w.tilt, 0, w.tilt * 0.4)).invert())
    return { ...w, spin: 0, heart: local.toArray() }
  }, [agent, front])
  const R = world.radius
  const beam = useRef()
  const pulses = useRef([])
  const heartsRef = useRef()
  const fade = useRef(0)

  // the dish stands on the Core-facing shoulder of the planet, aimed out into the galaxy
  const dish = useMemo(() => {
    const n = around(new THREE.Vector3(), front + 0.15, 0.62, 1)
    const base = P.clone().addScaledVector(n, R * 0.97)
    const q = new THREE.Quaternion().setFromUnitVectors(UP, n)
    const tip = base.clone().addScaledVector(n, 5.3)
    return { n, base, q, tip }
  }, [P, R, front])

  const mats = useMemo(
    () => ({
      metal: new THREE.MeshStandardMaterial({ color: '#f2e9ee', metalness: 0.45, roughness: 0.28, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
      dark: new THREE.MeshStandardMaterial({ color: '#3a2532', metalness: 0.6, roughness: 0.4 }),
      tip: new THREE.MeshBasicMaterial({ color: new THREE.Color(agent.color).multiplyScalar(3), toneMapped: false }),
      pulse: new THREE.MeshBasicMaterial({ color: new THREE.Color(agent.color).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }),
      beam: new THREE.ShaderMaterial({
        vertexShader: beamVert,
        fragmentShader: beamFrag,
        uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uColor: { value: new THREE.Color(agent.color).multiplyScalar(1.5) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
      heart: new THREE.MeshPhysicalMaterial({ color: agent.color, emissive: new THREE.Color(agent.color), emissiveIntensity: 1.2, roughness: 0.3, clearcoat: 1 }),
      gold: new THREE.MeshPhysicalMaterial({ color: '#fbbf24', emissive: new THREE.Color('#f59e0b'), emissiveIntensity: 1.6, roughness: 0.2, clearcoat: 1, metalness: 0.4 }),
      geo: {
        dish: dishGeometry(),
        mast: new THREE.CylinderGeometry(0.35, 0.6, 2.2, 20),
        strut: new THREE.CylinderGeometry(0.04, 0.04, 3.6, 6),
        feed: new THREE.CylinderGeometry(0.12, 0.22, 0.7, 16),
        tip: new THREE.SphereGeometry(0.22, 16, 12),
        pulse: new THREE.TorusGeometry(1, 0.04, 8, 64),
        beam: new THREE.CylinderGeometry(0.22, 0.75, 1, 24, 1, true),
        heart: heartGeometry(),
      },
    }),
    [agent.color],
  )

  const heartData = useMemo(() => {
    const out = []
    for (let k = 0; k < HEARTS; k++) {
      const n = new THREE.Vector3(Math.sin(k * 2.4) * Math.cos(k * 1.3), Math.cos(k * 2.1) * 0.6 + 0.2, Math.cos(k * 2.4) * Math.cos(k * 1.3)).normalize()
      out.push({ n, phase: (k * 0.37) % 1, speed: 0.08 + (k % 4) * 0.02 })
    }
    return out
  }, [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const shot = useCallback(
    (beat, pos, look, ctx) => {
      const id = CHAPTERS[ID].beats[beat]?.id
      if (id === 'transmit') {
        // side-on to the dish, so the beam crosses the frame when it fires
        const side = new THREE.Vector3().crossVectors(UP, dish.n).normalize()
        pos.copy(dish.base).addScaledVector(dish.n, 6).addScaledVector(side, 30).addScaledVector(UP, 3)
        look.copy(dish.base).addScaledVector(dish.n, 9)
        return chapterFrame(ctx, 44)
      }
      if (id === 'channels') {
        around(P, front + 0.75, 0.2, 50, pos)
        look.copy(P).addScaledVector(UP, 2)
        return chapterFrame(ctx, 38)
      }
      if (id === 'outro') {
        // pull far back: the Relay as a crescent, the Core glowing across the galaxy
        const out = P.clone().normalize()
        const side = new THREE.Vector3().crossVectors(out, UP).normalize()
        pos.copy(P).addScaledVector(out, 24).addScaledVector(side, 40).addScaledVector(UP, 22)
        look.copy(P).multiplyScalar(0.6)
        return chapterFrame(ctx, 48)
      }
      around(P, front - 0.25, 0.32, 48, pos)
      look.copy(P).addScaledVector(UP, 2.5)
      return chapterFrame(ctx, 38)
    },
    [P, front, dish],
  )
  useWorld(ID, shot)

  useFrame((state, dt) => {
    const s = useStore.getState()
    const on = s.agent === ID && (s.phase === 'chapter' || s.phase === 'travel')
    fade.current = damp(fade.current, on ? 1 : 0, 2, dt)
    const t = state.clock.elapsedTime
    // relay pings every couple of seconds; louder while transmitting
    pulses.current.forEach((p, k) => {
      if (!p) return
      const ph = (t * 0.5 + k / 3) % 1
      p.scale.setScalar(0.6 + ph * (4.5 + rig.beam * 2))
      p.material = mats.pulse
      mats.pulse.opacity = 0.7 * (1 - ph) * (0.4 + rig.beam)
    })
    if (beam.current) {
      beam.current.visible = rig.beam > 0.005
      mats.beam.uniforms.uPower.value = rig.beam
      mats.beam.uniforms.uTime.value = t
      const len = 420 * Math.min(1, rig.beam * 1.6)
      beam.current.scale.set(0.6 + rig.beam * 0.6, len, 0.6 + rig.beam * 0.6)
      beam.current.position.copy(dish.tip).addScaledVector(dish.n, len / 2)
    }
    const hm = heartsRef.current
    if (hm) {
      hm.visible = fade.current > 0.01
      heartData.forEach((h, k) => {
        const ph = (t * h.speed + h.phase) % 1
        dummy.position.copy(P).addScaledVector(h.n, R + 0.5 + ph * 9)
        dummy.quaternion.setFromUnitVectors(UP, h.n)
        dummy.rotateY(t * 0.8 + k)
        dummy.scale.setScalar(Math.max(0.001, Math.sin(ph * Math.PI) * 2.4 * fade.current))
        dummy.updateMatrix()
        hm.setMatrixAt(k, dummy.matrix)
      })
      hm.instanceMatrix.needsUpdate = true
    }
  })

  const golden = useMemo(() => around(new THREE.Vector3(), front + 1.05, 0.05, R + 7).add(P), [front, R, P])
  const goldenRef = useRef()
  useFrame((state) => {
    if (goldenRef.current) goldenRef.current.rotation.y = state.clock.elapsedTime * 1.4
  })

  return (
    <group>
      <Planet id={ID} world={world} />
      <group position={dish.base} quaternion={dish.q}>
        <mesh geometry={mats.geo.mast} material={mats.dark} position={[0, 1.1, 0]} />
        <group position={[0, 2.4, 0]} rotation={[0.08, 0, 0]}>
          <mesh geometry={mats.geo.dish} material={mats.metal} />
          {[0, 1, 2].map((k) => {
            const a = (k / 3) * Math.PI * 2
            return (
              <mesh
                key={k}
                geometry={mats.geo.strut}
                material={mats.dark}
                position={[Math.cos(a) * 1.55, 1.75, Math.sin(a) * 1.55]}
                rotation={[Math.sin(a) * -0.75, 0, Math.cos(a) * 0.75]}
              />
            )
          })}
          <mesh geometry={mats.geo.feed} material={mats.dark} position={[0, 2.75, 0]} />
          <mesh geometry={mats.geo.tip} material={mats.tip} position={[0, 2.95, 0]} />
          {[0, 1, 2].map((k) => (
            <mesh key={k} ref={(el) => (pulses.current[k] = el)} geometry={mats.geo.pulse} material={mats.pulse} position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]} />
          ))}
        </group>
      </group>
      <mesh ref={beam} geometry={mats.geo.beam} material={mats.beam} quaternion={dish.q} visible={false} renderOrder={9} />
      <instancedMesh ref={heartsRef} args={[mats.geo.heart, mats.heart, HEARTS]} frustumCulled={false} />
      <Signal where={ID} position={golden} size={2.6} color="#fde68a">
        <mesh ref={goldenRef} geometry={mats.geo.heart} material={mats.gold} scale={2.2} />
      </Signal>
    </group>
  )
}
