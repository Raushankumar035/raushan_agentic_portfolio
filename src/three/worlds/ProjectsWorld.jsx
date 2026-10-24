// Projects: an ocean world with a moon for every shipped project, each with a holo screen.
import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { agentById } from '../../agents'
import { ORIGIN, PROJECTS } from '../../content/projects'
import { CHAPTERS } from '../../content/chapters'
import { rig } from '../../lib/rig'
import { damp } from '../../lib/math'
import { goBeatId } from '../../lib/director'
import { sound } from '../../lib/sound'
import { useStore } from '../../store'
import Planet, { atmosphereMaterial, bakePlanet, planetMaterial } from '../Planet'
import Signal from '../secrets/Signal'
import { screenTexture } from '../textures'
import { UP, around, azToCore, chapterFrame, useWorld } from './common'

const ID = 'projects'
const MOON_WORLD = { style: 5, colors: ['#2b3346', '#7b8798', '#e8eef7', '#9cc3ff'], atmosphere: '#7dd3fc' }

// orbit radius, inclination, node, phase, angular speed, size
const ORBITS = [
  [21, 0.18, 0.4, 0.3, 0.07, 1.7],
  [26, -0.24, 1.6, 2.1, 0.055, 2.1],
  [31, 0.32, 2.7, 4.0, 0.048, 1.9],
  [36, -0.12, 0.9, 5.3, 0.04, 2.4],
  [41, 0.26, 3.6, 1.2, 0.034, 1.8],
  [47, -0.3, 5.0, 3.1, 0.029, 2.2],
  [52.5, 0.2, 4.3, 0.9, 0.026, 1.9],
  [58, -0.2, 0.2, 2.6, 0.023, 2.0],
]
const ORIGIN_ORBIT = [70, 0.95, 2.2, 0.6, 0.02, 0.85]

function orbitPos(o, ang, out) {
  const [r, inc, node] = o
  out.set(Math.cos(ang) * r, 0, Math.sin(ang) * r)
  out.applyAxisAngle(new THREE.Vector3(1, 0, 0), inc)
  out.applyAxisAngle(UP, node)
  return out
}

const _p = new THREE.Vector3()
const _toCam = new THREE.Vector3()
const _right = new THREE.Vector3()

export default function ProjectsWorld() {
  const agent = agentById(ID)
  const world = agent.world
  const gl = useThree((s) => s.gl)
  const P = useMemo(() => new THREE.Vector3(...world.pos), [world])
  const front = useMemo(() => azToCore(P), [P])
  const moonRefs = useRef([])
  const screenRefs = useRef([])
  const originRef = useRef()
  // per moon: current angle, speed multiplier, screen reveal
  const state = useRef(ORBITS.map((o) => ({ ang: o[3], k: 1, show: 0 })))
  const origin = useRef({ ang: ORIGIN_ORBIT[3] })
  const worldPos = useMemo(() => ORBITS.map(() => new THREE.Vector3()), [])

  const moonMaps = useMemo(() => bakePlanet(gl, 'moon', MOON_WORLD), [gl])
  const moonMats = useMemo(
    () =>
      PROJECTS.map((p) =>
        planetMaterial(moonMaps, { atmosphere: p.color }, { spec: 0.05, emit: 0 }),
      ),
    [moonMaps],
  )
  const moonAtmo = useMemo(() => PROJECTS.map((p) => atmosphereMaterial(p.color, 0.7)), [])
  const originMat = useMemo(() => planetMaterial(moonMaps, { atmosphere: ORIGIN.color }, { spec: 0.05, emit: 0 }), [moonMaps])
  const originAtmo = useMemo(() => atmosphereMaterial(ORIGIN.color, 1.2), [])
  const screenMats = useMemo(
    () =>
      PROJECTS.map(
        (p) =>
          new THREE.MeshBasicMaterial({
            map: screenTexture(p.screen),
            color: new THREE.Color(p.color).lerp(new THREE.Color('#ffffff'), 0.25).multiplyScalar(1.5),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
      ),
    [],
  )
  const geo = useMemo(() => ({ moon: new THREE.SphereGeometry(1, 48, 32), screen: new THREE.PlaneGeometry(1.6, 1) }), [])
  // dark glass behind each holo screen, so it reads against a bright planet
  const backMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#030817', transparent: true, opacity: 0, depthWrite: false }), [])

  // camera framing for a moon: outside its orbit, looking in, screen to its right
  const moonShot = (k, pos, look) => {
    const m = worldPos[k]
    _toCam.copy(m).sub(P).normalize()
    _toCam.y += 0.3
    _toCam.normalize()
    _right.crossVectors(UP, _toCam).normalize()
    pos.copy(m).addScaledVector(_toCam, 25).addScaledVector(_right, 3)
    look.copy(m).addScaledVector(_right, 4.6).addScaledVector(UP, 0.4)
  }

  const shot = useCallback(
    (beat, pos, look, ctx) => {
      const b = CHAPTERS[ID].beats[beat]
      if (b?.project != null) {
        moonShot(b.project, pos, look)
        return chapterFrame(ctx, 38)
      }
      if (b?.id === 'outro') {
        around(P, front + 0.9, 0.62, 118, pos)
        look.copy(P)
        return chapterFrame(ctx, 42)
      }
      around(P, front - 0.25, 0.42, 96, pos)
      look.copy(P)
      return chapterFrame(ctx, 42)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [P, front],
  )
  useWorld(ID, shot)

  useFrame((st, dt) => {
    const s = useStore.getState()
    const on = s.agent === ID && (s.phase === 'chapter' || s.phase === 'travel')
    const focus = on ? CHAPTERS[ID].beats[s.beat]?.project : null
    const cam = st.camera
    state.current.forEach((m, k) => {
      const o = ORBITS[k]
      // the focused moon slows to a halt so the camera can hold on it
      m.k = damp(m.k, focus === k ? 0 : 1, 1.6, dt)
      if (!rig.reduce) m.ang += o[4] * m.k * dt
      orbitPos(o, m.ang, _p)
      worldPos[k].copy(_p).add(P)
      const g = moonRefs.current[k]
      if (g) {
        g.position.copy(_p)
        g.children[0].rotation.y += dt * 0.1
      }
      m.show = damp(m.show, focus === k && s.phase === 'chapter' ? 1 : 0, 3.2, dt)
      const sc = screenRefs.current[k]
      if (sc) {
        sc.visible = m.show > 0.01
        if (sc.visible) {
          _toCam.copy(cam.position).sub(worldPos[k]).normalize()
          _right.crossVectors(UP, _toCam).normalize()
          sc.position.copy(_p).addScaledVector(_right, ORBITS[k][5] + 5.4 - (1 - m.show) * 1.5).addScaledVector(UP, 0.5)
          sc.quaternion.copy(cam.quaternion)
          sc.scale.setScalar(4.6 * (0.8 + 0.2 * m.show))
          screenMats[k].opacity = m.show * (0.92 + 0.08 * Math.sin(st.clock.elapsedTime * 7 + k))
          backMat.opacity = m.show * 0.78
        }
      }
    })
    if (!rig.reduce) origin.current.ang += ORIGIN_ORBIT[4] * dt
    if (originRef.current) originRef.current.position.copy(orbitPos(ORIGIN_ORBIT, origin.current.ang, _p))
  })

  const onOrigin = (e) => {
    e.stopPropagation()
    if (e.delta > 6) return
    sound.collect()
    useStore.getState().setDetail({ kind: 'origin' })
    useStore.getState().award('origin')
  }

  return (
    <group>
      <Planet id={ID} world={world} />
      <group position={P}>
        {PROJECTS.map((p, k) => (
          <group key={p.id} ref={(el) => (moonRefs.current[k] = el)}>
            <mesh
              geometry={geo.moon}
              material={moonMats[k]}
              scale={ORBITS[k][5]}
              onClick={(e) => {
                e.stopPropagation()
                if (e.delta <= 6 && useStore.getState().phase === 'chapter' && useStore.getState().agent === ID) goBeatId(p.id)
              }}
              onPointerOver={() => useStore.getState().agent === ID && (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = '')}
            />
            <mesh geometry={geo.moon} material={moonAtmo[k]} scale={ORBITS[k][5] * 1.18} />
          </group>
        ))}
        {PROJECTS.map((p, k) => (
          <group key={`s${p.id}`} ref={(el) => (screenRefs.current[k] = el)} visible={false}>
            <mesh geometry={geo.screen} material={backMat} renderOrder={7} position={[0, 0, -0.02]} scale={0.985} />
            <mesh geometry={geo.screen} material={screenMats[k]} renderOrder={8} />
          </group>
        ))}
        <group ref={originRef}>
          <mesh
            geometry={geo.moon}
            material={originMat}
            scale={ORIGIN_ORBIT[5]}
            onClick={onOrigin}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          />
          <mesh geometry={geo.moon} material={originAtmo} scale={ORIGIN_ORBIT[5] * 1.3} />
          {/* generous invisible target: it's tiny */}
          <mesh scale={3.2} onClick={onOrigin}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      </group>
      <MoonLabels moonRefs={moonRefs} />
      <Signal where={ID} position={around(new THREE.Vector3(), front + Math.PI * 0.82, -0.18, 24).add(P)} size={2.2} color="#bae6fd" />
    </group>
  )
}

function MoonLabels({ moonRefs }) {
  const beat = useStore((s) => s.beat)
  const live = useStore((s) => s.agent === ID && s.phase === 'chapter')
  if (!live) return null
  const b = CHAPTERS[ID].beats[beat]
  if (b?.project != null) return null
  return PROJECTS.map((p, k) =>
    b?.project === k ? null : (
      <TrackedLabel key={p.id} target={moonRefs} index={k} offset={ORBITS[k][5] + 1.6}>
        <button type="button" className={`world-label is-moon${b?.project != null ? ' is-quiet' : ''}`} style={{ '--c': p.color }} onClick={() => goBeatId(p.id)}>
          {p.name}
        </button>
      </TrackedLabel>
    ),
  )
}

// Html that follows a moving object (moons orbit, so a static position won't do).
function TrackedLabel({ target, index, offset, children }) {
  const ref = useRef()
  useFrame(() => {
    const m = target.current[index]
    if (m && ref.current) {
      ref.current.position.copy(m.position)
      ref.current.position.y += offset
    }
  })
  return (
    <group position={agentById(ID).world.pos}>
      <group ref={ref}>
        <Html center zIndexRange={[20, 0]}>
          {children}
        </Html>
      </group>
    </group>
  )
}
