// Journey: a living world with a glowing flight path spiralling out of it, a beacon per milestone.
// The camera rides the path itself from beacon to beacon.
import { useCallback, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { agentById } from '../../agents'
import { MILESTONES } from '../../content/journey'
import { CHAPTERS } from '../../content/chapters'
import { rig } from '../../lib/rig'
import { damp } from '../../lib/math'
import { goBeatId } from '../../lib/director'
import { useStore } from '../../store'
import Planet from '../Planet'
import Signal from '../secrets/Signal'
import { trailFrag, trailVert } from '../shaders'
import { UP, azToCore, chapterFrame, useWorld } from './common'

const ID = 'journey'
const TS = MILESTONES.map((_, i) => 0.035 + (i / (MILESTONES.length - 1)) * 0.85)
const T_NEXT = 0.985

function paperPlane() {
  // nose at +z, wings folded down from a centre keel
  const v = [
    0, 0, 1.6, -1.1, 0.05, -0.9, 0, 0.18, -0.7,
    0, 0, 1.6, 0, 0.18, -0.7, 1.1, 0.05, -0.9,
    0, 0, 1.6, 0, 0.18, -0.7, 0, -0.35, -0.8,
  ]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
}

const _p = new THREE.Vector3()
const _t = new THREE.Vector3()
const _s = new THREE.Vector3()

export default function JourneyWorld() {
  const agent = agentById(ID)
  const world = agent.world
  const P = useMemo(() => new THREE.Vector3(...world.pos), [world])
  const front = useMemo(() => azToCore(P), [P])
  const cursor = useRef({ t: TS[0], reveal: 0, plane: TS[0] })
  const beaconRefs = useRef([])
  const plane = useRef()

  const curve = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 15; i++) {
      const a = front + 1.15 - i * 0.43
      const r = 11.5 + i * 7.2
      const y = Math.sin(i * 0.55) * 7 + i * 1.3
      pts.push(new THREE.Vector3(P.x + Math.sin(a) * r, P.y + y, P.z + Math.cos(a) * r))
    }
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  }, [P, front])

  const tube = useMemo(() => new THREE.TubeGeometry(curve, 700, 0.3, 8, false), [curve])
  const trailMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: trailVert,
        fragmentShader: trailFrag,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uReveal: { value: 0 },
          uColor: { value: new THREE.Color(agent.color).multiplyScalar(1.4) },
          uLen: { value: curve.getLength() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [curve, agent.color],
  )
  const beacons = useMemo(() => TS.map((t) => curve.getPointAt(t)), [curve])
  const detour = useMemo(() => {
    const t = TS[4]
    const p = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize()
    return p.addScaledVector(side, -21).addScaledVector(UP, 9)
  }, [curve])
  const mats = useMemo(
    () => ({
      beam: new THREE.MeshBasicMaterial({ color: new THREE.Color(agent.color).multiplyScalar(1.6), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      orb: new THREE.MeshBasicMaterial({ color: new THREE.Color('#d1fae5').multiplyScalar(2.4), toneMapped: false }),
      ring: new THREE.MeshBasicMaterial({ color: new THREE.Color(agent.color).multiplyScalar(2), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }),
      plane: new THREE.MeshStandardMaterial({ color: '#f8fffb', emissive: new THREE.Color(agent.color), emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.6 }),
      geo: {
        beam: new THREE.CylinderGeometry(0.06, 0.06, 6, 8, 1, true),
        orb: new THREE.SphereGeometry(0.42, 20, 14),
        ring: new THREE.RingGeometry(1.1, 1.22, 48),
        plane: paperPlane(),
      },
    }),
    [agent.color],
  )

  const shotAt = (t, pos, look) => {
    curve.getPointAt(t, _p)
    curve.getTangentAt(t, _t)
    _s.crossVectors(_t, UP).normalize()
    pos.copy(_p).addScaledVector(_t, -21).addScaledVector(UP, 7.5).addScaledVector(_s, 9)
    look.copy(_p).addScaledVector(_t, 4).addScaledVector(UP, 3.6)
  }

  const shot = useCallback(
    (beat, pos, look, ctx) => {
      const b = CHAPTERS[ID].beats[beat]
      const s = useStore.getState()
      const riding = s.agent === ID && s.phase === 'chapter'
      if (b?.milestone != null) {
        shotAt(riding ? cursor.current.t : TS[b.milestone], pos, look)
        return chapterFrame(ctx, 42)
      }
      // the end of the trail: look back at the whole route
      const end = curve.getPointAt(1)
      const out = end.clone().sub(P).normalize()
      pos.copy(end).addScaledVector(out, 34).addScaledVector(UP, 46)
      look.copy(P).lerp(end, 0.45)
      return chapterFrame(ctx, 46)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curve, P],
  )
  useWorld(ID, shot)

  useFrame((state, dt) => {
    const s = useStore.getState()
    const on = s.agent === ID && (s.phase === 'chapter' || s.phase === 'travel')
    const b = CHAPTERS[ID].beats[s.beat]
    const target = b?.milestone != null ? TS[b.milestone] : T_NEXT
    const c = cursor.current
    if (!on || s.phase === 'travel') c.t = target
    else c.t = damp(c.t, target, rig.reduce ? 30 : 1.25, dt)
    c.reveal = damp(c.reveal, on ? 1 : 0, on ? 0.9 : 3, dt)
    // the paper plane leads a little ahead of the camera
    c.plane = damp(c.plane, Math.min(1, c.t + 0.02), 2.4, dt)
    const u = trailMat.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uProgress.value = c.t
    u.uReveal.value = 0.02 + c.reveal * 0.98
    const t = state.clock.elapsedTime
    beaconRefs.current.forEach((g, i) => {
      if (!g) return
      const lit = c.t >= TS[i] - 0.01
      const cur = b?.milestone === i
      g.scale.setScalar(cur ? 1.25 + 0.06 * Math.sin(t * 4) : lit ? 1 : 0.7)
      g.children[2].scale.setScalar(1 + ((t * 0.8 + i * 0.13) % 1) * (cur ? 2.4 : 1.2))
      g.children[2].material.opacity = cur ? 0.8 * (1 - ((t * 0.8 + i * 0.13) % 1)) : 0.25
      g.visible = c.reveal > 0.05 && TS[i] <= u.uReveal.value + 0.01
    })
    if (plane.current) {
      const pt = Math.min(0.999, c.plane)
      curve.getPointAt(pt, _p)
      curve.getTangentAt(pt, _t)
      plane.current.position.copy(_p).addScaledVector(UP, 1.4 + Math.sin(t * 2.2) * 0.25)
      plane.current.lookAt(_p.add(_t))
      plane.current.rotateZ(Math.sin(t * 1.6) * 0.3)
      plane.current.visible = c.reveal > 0.2
    }
  })

  return (
    <group>
      <Planet id={ID} world={world} />
      <mesh geometry={tube} material={trailMat} renderOrder={4} />
      {beacons.map((p, i) => (
        <group key={i} ref={(el) => (beaconRefs.current[i] = el)} position={p}>
          <mesh geometry={mats.geo.beam} material={mats.beam} position={[0, 3, 0]} />
          <mesh geometry={mats.geo.orb} material={mats.orb} position={[0, 6, 0]} />
          <mesh geometry={mats.geo.ring} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} />
        </group>
      ))}
      <mesh ref={plane} geometry={mats.geo.plane} material={mats.plane} scale={0.8} />
      <BeaconLabels beacons={beacons} />
      <Signal where={ID} position={detour} size={2.1} color="#a7f3d0" />
    </group>
  )
}

function BeaconLabels({ beacons }) {
  const beat = useStore((s) => s.beat)
  const live = useStore((s) => s.agent === ID && s.phase === 'chapter')
  if (!live) return null
  const b = CHAPTERS[ID].beats[beat]
  return MILESTONES.map((m, i) => (
    <Html key={m.id} position={beacons[i].clone().add(new THREE.Vector3(0, 8.2, 0))} center zIndexRange={[20, 0]}>
      <button
        type="button"
        className={`world-label is-beacon${b?.milestone === i ? ' is-current' : ''}`}
        style={{ '--c': agentById(ID).color }}
        onClick={() => goBeatId(m.id)}
      >
        <b>{m.year}</b>
        {b?.milestone === i && <span>{m.title}</span>}
      </button>
    </Html>
  ))
}
