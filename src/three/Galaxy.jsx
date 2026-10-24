// The galaxy itself: five spiral arms (one per agent), a warm bulge, coloured nebula dust,
// all as GPU points in world space so they parallax as you fly. One draw call per layer.
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { AGENTS } from '../agents'
import { rig } from '../lib/rig'
import { rng } from '../lib/math'
import { discFrag, discVert } from './shaders'

export const GALAXY_EULER = new THREE.Euler(0.42, 0, -0.38)
export const GALAXY_NORMAL = new THREE.Vector3(0, 1, 0).applyEuler(GALAXY_EULER)
const RADIUS = 760
const ARMS = AGENTS.length
const TWIST = 0.0062

function gauss(r) {
  return (r() + r() + r() + r() - 2) / 2
}

// "RK", laid out in stars far out on the disc. Only readable from above.
function initials() {
  const strokes = [
    // R: stem, top bar, bowl, leg
    [[0, 0], [0, 120]],
    [[0, 120], [46, 120]],
    [[46, 120], [64, 104]],
    [[64, 104], [64, 84]],
    [[64, 84], [46, 66]],
    [[46, 66], [0, 66]],
    [[26, 66], [66, 0]],
    // K: stem and two arms
    [[104, 0], [104, 120]],
    [[104, 58], [170, 120]],
    [[124, 74], [172, 0]],
  ]
  const pts = []
  strokes.forEach(([[x0, y0], [x1, y1]]) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6))
    for (let k = 0; k <= n; k++) pts.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n])
  })
  return pts
}

function build(tier) {
  const r = rng(42)
  const N = tier > 1 ? 70000 : tier > 0 ? 52000 : 26000
  const kt = initials()
  const total = N + kt.length
  const pos = new Float32Array(total * 3)
  const col = new Float32Array(total * 3)
  const size = new Float32Array(total)
  const seed = new Float32Array(total)
  const armCols = AGENTS.map((a) => new THREE.Color(a.color))
  const white = new THREE.Color('#dbe6ff')
  const warm = new THREE.Color('#ffd7a3')
  const c = new THREE.Color()

  for (let i = 0; i < N; i++) {
    const kind = r()
    let x
    let y
    let z
    let rad
    if (kind < 0.12) {
      // bulge
      rad = 26 + Math.abs(gauss(r)) * 140
      const a = r() * Math.PI * 2
      x = Math.cos(a) * rad
      z = Math.sin(a) * rad
      y = gauss(r) * (30 * Math.exp(-rad / 120) + 6)
      c.copy(warm).lerp(white, Math.min(1, rad / 180))
    } else if (kind < 0.82) {
      // arms
      const arm = i % ARMS
      rad = 40 + Math.pow(r(), 0.75) * RADIUS
      const spread = 0.28 + 0.12 * r()
      const a = (arm / ARMS) * Math.PI * 2 + rad * TWIST + gauss(r) * spread * (1.1 - rad / (RADIUS * 1.6))
      x = Math.cos(a) * rad
      z = Math.sin(a) * rad
      y = gauss(r) * (5 + 22 * Math.exp(-rad / 200))
      c.copy(white).lerp(armCols[arm], 0.18 + 0.2 * r())
      c.lerp(warm, Math.max(0, 0.6 - rad / 300))
    } else {
      // field stars between the arms
      rad = 30 + Math.pow(r(), 0.6) * RADIUS * 1.1
      const a = r() * Math.PI * 2
      x = Math.cos(a) * rad
      z = Math.sin(a) * rad
      y = gauss(r) * (8 + 20 * Math.exp(-rad / 250))
      c.copy(white).lerp(warm, r() * 0.3)
    }
    pos.set([x, y, z], i * 3)
    const bright = r() > 0.985
    size[i] = bright ? 2.2 + r() * 2 : 0.6 + Math.pow(r(), 2.5) * 1.8
    const lum = (bright ? 2.2 : 0.7 + r() * 0.9) * (1.3 - Math.min(1, rad / RADIUS) * 0.55)
    col.set([c.r * lum, c.g * lum, c.b * lum], i * 3)
    seed[i] = r()
  }
  // the initials, warm gold, on the far rim
  const gold = new THREE.Color('#ffe7a8')
  kt.forEach(([px, py], k) => {
    const i = N + k
    pos.set([-520 + px * 1.9, 2, 330 - py * 1.9], i * 3)
    size[i] = 5.5
    col.set([gold.r * 2.6, gold.g * 2.6, gold.b * 2.6], i * 3)
    seed[i] = 0.5
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), RADIUS * 1.3)

  // nebula dust: soft sprites riding just inside each arm, many and faint so they read as gas
  const D = tier > 0 ? 6000 : 2600
  const dpos = new Float32Array(D * 3)
  const dcol = new Float32Array(D * 3)
  const dsize = new Float32Array(D)
  const dseed = new Float32Array(D)
  const indigo = new THREE.Color('#3b3fb5')
  for (let i = 0; i < D; i++) {
    const arm = i % ARMS
    const rad = 50 + Math.pow(r(), 0.8) * RADIUS * 0.98
    const a = (arm / ARMS) * Math.PI * 2 + rad * TWIST - 0.1 + gauss(r) * 0.34
    const jr = rad + gauss(r) * 26
    dpos.set([Math.cos(a) * jr, gauss(r) * 9, Math.sin(a) * jr], i * 3)
    c.copy(armCols[arm]).lerp(indigo, 0.25 + 0.45 * r())
    const k = (0.012 + 0.026 * r()) * (1.15 - rad / (RADIUS * 1.4))
    dcol.set([c.r * k, c.g * k, c.b * k], i * 3)
    dsize[i] = 7 + r() * 16
    dseed[i] = r()
  }
  const dgeo = new THREE.BufferGeometry()
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3))
  dgeo.setAttribute('aColor', new THREE.BufferAttribute(dcol, 3))
  dgeo.setAttribute('aSize', new THREE.BufferAttribute(dsize, 1))
  dgeo.setAttribute('aSeed', new THREE.BufferAttribute(dseed, 1))
  dgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), RADIUS * 1.3)
  return { geo, dgeo }
}

const material = (dust) =>
  new THREE.ShaderMaterial({
    vertexShader: discVert,
    fragmentShader: discFrag,
    uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uIntensity: { value: 0 }, uDust: { value: dust ? 1 : 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

export default function Galaxy() {
  const dpr = useThree((s) => s.viewport.dpr)
  const group = useRef()
  const { geo, dgeo } = useMemo(() => build(rig.tier), [])
  const mats = useMemo(() => [material(false), material(true)], [])

  useFrame((state, dt) => {
    if (!rig.reduce) group.current.rotation.y += dt * 0.0035
    const t = rig.reduce ? 0 : state.clock.elapsedTime
    mats.forEach((m) => {
      m.uniforms.uTime.value = t
      m.uniforms.uPixel.value = dpr
    })
    mats[0].uniforms.uIntensity.value = rig.intro.galaxy
    mats[1].uniforms.uIntensity.value = rig.intro.galaxy
  })

  return (
    <group rotation={GALAXY_EULER}>
      <group ref={group}>
        <points geometry={dgeo} material={mats[1]} renderOrder={-800} />
        <points geometry={geo} material={mats[0]} renderOrder={-700} />
      </group>
    </group>
  )
}
