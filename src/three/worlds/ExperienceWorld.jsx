// Experience: an amber gas giant whose ring hosts a station for every role.
import { useCallback, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { agentById } from '../../agents'
import { ROLES } from '../../content/experience'
import { CHAPTERS } from '../../content/chapters'
import { rig } from '../../lib/rig'
import { damp } from '../../lib/math'
import { goBeatId } from '../../lib/director'
import { useStore } from '../../store'
import Planet from '../Planet'
import Signal from '../secrets/Signal'
import { UP, around, azToCore, chapterFrame, useWorld } from './common'

const ID = 'experience'

function panelTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#0b1230'
  g.fillRect(0, 0, 128, 64)
  g.strokeStyle = '#5b7bd5'
  g.lineWidth = 2
  for (let x = 0; x <= 128; x += 16) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, 64)
    g.stroke()
  }
  for (let y = 0; y <= 64; y += 16) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(128, y)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

let SHARED = null
function shared() {
  if (SHARED) return SHARED
  SHARED = {
    hull: new THREE.MeshStandardMaterial({ color: '#d8dce8', metalness: 0.55, roughness: 0.32, envMapIntensity: 1.1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a3048', metalness: 0.6, roughness: 0.45 }),
    panel: new THREE.MeshStandardMaterial({ map: panelTexture(), metalness: 0.3, roughness: 0.35, emissive: '#1d2f7a', emissiveIntensity: 0.25 }),
    hub: new THREE.CylinderGeometry(0.85, 0.85, 2.4, 32),
    cap: new THREE.SphereGeometry(0.85, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    torus: new THREE.TorusGeometry(2.5, 0.36, 18, 72),
    spoke: new THREE.CylinderGeometry(0.09, 0.09, 2.5, 8),
    wing: new THREE.BoxGeometry(4.2, 0.06, 1.3),
    mast: new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8),
    bulb: new THREE.SphereGeometry(0.14, 16, 12),
    window: new THREE.TorusGeometry(2.5, 0.37, 4, 72, Math.PI * 2),
    bar: new THREE.BoxGeometry(0.55, 1, 0.55),
    cap2: new THREE.BoxGeometry(0.62, 0.12, 0.62),
  }
  return SHARED
}

function Station({ color, index, holder, show }) {
  const S = shared()
  const spin = useRef()
  const blink = useRef()
  const bars = useRef([])
  const caps = useRef([])
  const mats = useMemo(
    () => ({
      strip: new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false }),
      windows: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe8b0').multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.85 }),
      winBase: new THREE.Color('#ffe8b0'),
      light: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6b6b').multiplyScalar(3), toneMapped: false }),
      // dark glass bars with glowing caps: readable against the bright planet behind
      bar: new THREE.MeshBasicMaterial({ color: '#160d02', transparent: true, opacity: 0.8, depthWrite: false }),
      cap: new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(2.6), toneMapped: false }),
    }),
    [color],
  )
  const role = ROLES[index]
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    if (spin.current && !rig.reduce) spin.current.rotation.y += dt * 0.12
    if (blink.current) blink.current.visible = Math.sin(t * 3 + index * 2) > 0.6
    const k = show.current[index]
    mats.windows.color.copy(mats.winBase).multiplyScalar(1.2 + k * 2.2)
    bars.current.forEach((b, j) => {
      if (!b) return
      // bars grow one after another
      const kj = Math.min(1, Math.max(0, k * 1.6 - j * 0.25))
      const h = Math.max(0.001, role.bars[j].value * 4.2 * kj)
      b.scale.set(1, h, 1)
      b.position.y = 3.6 + h / 2
      b.visible = kj > 0.01
      const c = caps.current[j]
      if (c) {
        c.position.y = 3.6 + h
        c.visible = b.visible
      }
    })
    mats.bar.opacity = 0.8 * k
  })
  return (
    <group ref={holder}>
      <group ref={spin}>
        <mesh geometry={S.hub} material={S.hull} />
        <mesh geometry={S.cap} material={S.hull} position={[0, 1.2, 0]} />
        <mesh geometry={S.cap} material={S.hull} position={[0, -1.2, 0]} rotation={[Math.PI, 0, 0]} />
        <mesh geometry={S.torus} material={S.hull} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={S.window} material={mats.windows} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.3]} />
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} geometry={S.spoke} material={S.dark} rotation={[0, (k * Math.PI) / 2, Math.PI / 2]} position={[Math.cos((k * Math.PI) / 2) * 1.25, 0, -Math.sin((k * Math.PI) / 2) * 1.25]} />
        ))}
        <mesh geometry={S.mast} material={S.dark} position={[0, 2.3, 0]} />
        <mesh ref={blink} geometry={S.bulb} material={mats.light} position={[0, 3.4, 0]} />
      </group>
      <mesh geometry={S.wing} material={S.panel} position={[4.6, 0, 0]} />
      <mesh geometry={S.wing} material={S.panel} position={[-4.6, 0, 0]} />
      <mesh geometry={S.spoke} material={S.dark} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} scale={[1, 2.4, 1]} />
      <mesh material={mats.strip} position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.87, 0.04, 8, 48]} />
      </mesh>
      {role.bars.map((b, j) => (
        <group key={b.label}>
          <mesh ref={(el) => (bars.current[j] = el)} geometry={S.bar} material={mats.bar} position={[(j - 1) * 0.95, 3.6, 0]} visible={false} />
          <mesh ref={(el) => (caps.current[j] = el)} geometry={S.cap2} material={mats.cap} position={[(j - 1) * 0.95, 3.6, 0]} visible={false} />
        </group>
      ))}
    </group>
  )
}

export default function ExperienceWorld() {
  const agent = agentById(ID)
  const world = agent.world
  const P = useMemo(() => new THREE.Vector3(...world.pos), [world])
  const front = useMemo(() => azToCore(P), [P])
  const tiltQ = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(world.tilt, 0, world.tilt * 0.4)), [world])
  const show = useRef(ROLES.map(() => 0))
  const holders = useRef([])

  // stations sit just outside the ring, spread around the side that faces the Core
  const stations = useMemo(() => {
    const toCore = P.clone().negate().normalize().applyQuaternion(tiltQ.clone().invert())
    const a0 = Math.atan2(toCore.z, toCore.x)
    return ROLES.map((r, k) => {
      const a = a0 + (k - 1) * 0.62
      const local = new THREE.Vector3(Math.cos(a) * 34, 1.2, Math.sin(a) * 34)
      const worldP = local.clone().applyQuaternion(tiltQ).add(P)
      return { local, world: worldP, a }
    })
  }, [P, tiltQ])

  const gap = useMemo(() => {
    const a = stations[0].a + 0.35
    const R = world.radius
    const r = R * (1.35 + 0.58 * 1.0)
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).applyQuaternion(tiltQ).add(P)
  }, [stations, tiltQ, P, world])

  const shot = useCallback(
    (beat, pos, look, ctx) => {
      const b = CHAPTERS[ID].beats[beat]
      if (b?.role != null) {
        const s = stations[b.role].world
        const out = s.clone().sub(P).normalize()
        const side = new THREE.Vector3().crossVectors(UP, out).normalize()
        pos.copy(s).addScaledVector(out, 30).addScaledVector(UP, 8).addScaledVector(side, -6)
        look.copy(s).addScaledVector(UP, 3.4)
        return chapterFrame(ctx, 40)
      }
      if (b?.id === 'principles') {
        around(P, front + 0.45, -0.32, 92, pos)
        look.copy(P)
        return chapterFrame(ctx, 40)
      }
      if (b?.id === 'outro') {
        around(P, front + 0.85, 0.5, 128, pos)
        look.copy(P)
        return chapterFrame(ctx, 40)
      }
      around(P, front - 0.3, 0.34, 118, pos)
      look.copy(P)
      return chapterFrame(ctx, 40)
    },
    [stations, P, front],
  )
  useWorld(ID, shot)

  useFrame((_, dt) => {
    const s = useStore.getState()
    const on = s.agent === ID && s.phase === 'chapter'
    const focus = on ? CHAPTERS[ID].beats[s.beat]?.role : null
    show.current.forEach((v, k) => (show.current[k] = damp(v, focus === k ? 1 : on && focus == null && CHAPTERS[ID].beats[s.beat]?.id === 'intro' ? 0.35 : 0, 2.6, dt)))
    holders.current.forEach((h, k) => {
      if (!h) return
      h.position.copy(stations[k].world)
      // stations ride the ring plane, hub axis along the planet's pole
      h.quaternion.copy(tiltQ)
    })
  })

  return (
    <group>
      <Planet id={ID} world={world} />
      {ROLES.map((r, k) => (
        <Station key={r.id} color={agent.color} index={k} holder={(el) => (holders.current[k] = el)} show={show} />
      ))}
      <StationLabels stations={stations} up={new THREE.Vector3(0, 1, 0).applyQuaternion(tiltQ)} />
      <Signal where={ID} position={gap} size={1.9} color="#fde68a" />
    </group>
  )
}

function StationLabels({ stations, up }) {
  const beat = useStore((s) => s.beat)
  const live = useStore((s) => s.agent === ID && s.phase === 'chapter')
  if (!live) return null
  const b = CHAPTERS[ID].beats[beat]
  return ROLES.map((r, k) => {
    const focused = b?.role === k
    return (
      <Html key={r.id} position={stations[k].world.clone().addScaledVector(up, focused ? 9.6 : 5)} center zIndexRange={[20, 0]}>
        {focused ? (
          <div className="world-bars" style={{ '--c': agentById(ID).color }}>
            {r.bars.map((x) => (
              <span key={x.label}>
                <b>{x.text}</b>
                {x.label}
              </span>
            ))}
          </div>
        ) : (
          <button type="button" className={`world-label is-station${b?.role != null ? ' is-quiet' : ''}`} style={{ '--c': agentById(ID).color }} onClick={() => goBeatId(r.id)}>
            <span>{r.title}</span>
            <i>{r.when}</i>
          </button>
        )}
      </Html>
    )
  })
}
