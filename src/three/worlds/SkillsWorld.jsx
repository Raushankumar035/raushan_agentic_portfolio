// Skills: a crystal world wrapped in a sky of constellations, one per domain, one star per skill.
import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { agentById } from '../../agents'
import { SKILL_GROUPS } from '../../content/skills'
import { CHAPTERS } from '../../content/chapters'
import { rig } from '../../lib/rig'
import { damp, rng } from '../../lib/math'
import { sound } from '../../lib/sound'
import { goBeatId } from '../../lib/director'
import { useStore } from '../../store'
import Planet from '../Planet'
import Signal from '../secrets/Signal'
import { UP, around, azToCore, chapterFrame, useWorld } from './common'

const ID = 'skills'
const SHELL = 31
const OFFS = [
  [-1.05, 0.32],
  [-0.5, -0.3],
  [0.05, 0.42],
  [0.55, -0.22],
  [1.08, 0.3],
]

const starVert = /* glsl */ `
attribute float aSize;
attribute float aGroup;
attribute float aOrder;
attribute float aIdx;
attribute vec3 aColor;
uniform float uReveal[5];
uniform float uActive;
uniform float uHover;
uniform float uPixel;
uniform float uTime;
uniform float uStage;
varying vec3 vColor;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  int g = int(aGroup + .5);
  float rev = smoothstep(aOrder, aOrder + .6, uReveal[g] * 9.);
  float act = uActive < -.5 ? .75 : (abs(aGroup - uActive) < .5 ? 1.25 : .35);
  float hov = abs(aIdx - uHover) < .5 ? 1.8 : 1.;
  float tw = .85 + .15 * sin(uTime * 2. + aIdx * 7.3);
  vColor = aColor * act * hov * tw;
  vA = rev * uStage;
  gl_PointSize = clamp(aSize * hov * uPixel * 300. / -mv.z, 2., 90.) * (.6 + .4 * rev);
}
`
const starFrag = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - .5;
  float d = length(c);
  vec2 a = abs(c);
  float core = exp(-d * d * 120.) * 2.2 + exp(-d * d * 18.) * .5;
  float glare = max(exp(-a.x * 40.) * exp(-a.y * 6.), exp(-a.y * 40.) * exp(-a.x * 6.)) * .55;
  float v = (core + glare) * vA;
  if (v < .004) discard;
  gl_FragColor = vec4(vColor * v, 1.);
}
`

function buildSky(P) {
  const front = azToCore(P)
  const groups = SKILL_GROUPS.map((grp, k) => {
    const [off, el] = OFFS[k]
    const dir = around(new THREE.Vector3(), front + off, el, 1)
    const center = P.clone().addScaledVector(dir, SHELL)
    const t1 = new THREE.Vector3().crossVectors(UP, dir).normalize()
    const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize()
    const r = rng(k * 17 + 3)
    // a gentle random walk makes each constellation its own shape
    const n = grp.skills.length
    let x = 0
    let y = (r() - 0.5) * 3
    let ang = (r() - 0.5) * 0.8
    const local = grp.skills.map(() => {
      const p = [x, y]
      ang += (r() - 0.5) * 1.6
      x += 2.5 + r() * 1.0
      y += Math.sin(ang) * 3
      return p
    })
    // fit every constellation into the same box so each one frames well
    const xs = local.map((p) => p[0])
    const ys = local.map((p) => p[1])
    const sx = 17 / Math.max(1e-3, Math.max(...xs) - Math.min(...xs))
    const sy = 9 / Math.max(1e-3, Math.max(...ys) - Math.min(...ys))
    const fit = Math.min(sx, 1.2)
    local.forEach((p) => {
      p[0] *= fit
      p[1] *= Math.min(sy, fit)
    })
    const cx = local.reduce((s, p) => s + p[0], 0) / n
    const cy = local.reduce((s, p) => s + p[1], 0) / n
    const stars = grp.skills.map((s, j) => {
      const [lx, ly] = local[j]
      const pos = center
        .clone()
        .addScaledVector(t1, lx - cx)
        .addScaledVector(t2, ly - cy)
        .addScaledVector(dir, (r() - 0.5) * 3)
      return { ...s, pos, order: j }
    })
    const path = stars.map((s) => s.pos)
    const branch = n > 4 ? [stars[1].pos, stars[n - 2].pos] : null
    return { ...grp, k, dir, center, t1, t2, stars, path, branch }
  })
  return groups
}

// A live voice waveform under the Voice constellation: your mic when you talk, the agent's voice otherwise.
function Waveform({ group, active }) {
  const ref = useRef()
  const N = 72
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.16, 1)
    return g
  }, [])
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#c4b5fd').multiplyScalar(1.7),
        toneMapped: false,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(), [])
  const fade = useRef(0)
  useFrame((state, dt) => {
    const m = ref.current
    if (!m) return
    fade.current = damp(fade.current, active.current ? 1 : 0, 4, dt)
    m.visible = fade.current > 0.01
    if (!m.visible) return
    mat.opacity = fade.current
    const t = state.clock.elapsedTime
    const live = rig.audio.live
    const talk = rig.bots[0].talk
    const W = 15
    // laid out along the screen's horizontal so it always reads as a waveform
    const cam = state.camera
    right.set(1, 0, 0).applyQuaternion(cam.quaternion)
    up.set(0, 1, 0).applyQuaternion(cam.quaternion)
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1)
      const env = Math.pow(Math.sin(Math.PI * u), 0.8)
      // your mic while you talk, the agent's real voice while it answers, a gentle idle otherwise
      const bi = Math.floor(Math.abs(u - 0.5) * 2 * (rig.audio.bins.length - 1))
      const idle = 0.08 + 0.18 * Math.abs(Math.sin(t * 2.2 + k * 0.45) * Math.sin(t * 0.9 + k * 0.13))
      const speak = rig.speech.active ? rig.speech.bins[bi] * 2.6 : talk * (0.5 + 0.5 * Math.abs(Math.sin(t * 17 + k * 0.7))) * 2.2
      const h = (live ? 0.15 + rig.audio.bins[bi] * 4.5 : (idle + speak) * 1.6) * env * fade.current
      dummy.position.copy(group.center).addScaledVector(right, (u - 0.5) * W).addScaledVector(up, -7.2)
      dummy.quaternion.copy(cam.quaternion)
      dummy.scale.set(1, Math.max(0.04, h), 1)
      dummy.updateMatrix()
      m.setMatrixAt(k, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, N]} frustumCulled={false} renderOrder={6} />
}

function StarLabels({ groups }) {
  const beat = useStore((s) => s.beat)
  const live = useStore((s) => s.agent === ID && s.phase === 'chapter')
  if (!live) return null
  const id = CHAPTERS[ID].beats[beat]?.id
  const active = groups.find((g) => g.id === id)
  return (
    <>
      {!active &&
        id !== 'outro' &&
        groups.map((g) => (
          <Html key={g.id} position={g.center.clone().addScaledVector(g.t2, 7)} center zIndexRange={[20, 0]}>
            <button type="button" className="world-label is-group" style={{ '--c': g.hue }} onClick={() => goBeatId(g.id)}>
              {g.name}
            </button>
          </Html>
        ))}
      {active &&
        active.stars.map((s, j) => (
          <Html key={s.id} position={s.pos} zIndexRange={[20, 0]}>
            <div className="star-anchor">
            <button
              type="button"
              className="world-label is-star"
              style={{ '--c': active.hue }}
              onMouseEnter={() => {
                rig.skillHover = active.k * 100 + j
                sound.note(active.k + j)
              }}
              onMouseLeave={() => (rig.skillHover = -1)}
              onFocus={() => (rig.skillHover = active.k * 100 + j)}
              onClick={() => useStore.getState().setDetail({ kind: 'skill', id: s.id })}
            >
              <span>{s.name}</span>
              <i aria-hidden="true">{'●'.repeat(s.level)}</i>
            </button>
            </div>
          </Html>
        ))}
    </>
  )
}

export default function SkillsWorld() {
  const agent = agentById(ID)
  const world = agent.world
  const dpr = useThree((s) => s.viewport.dpr)
  const P = useMemo(() => new THREE.Vector3(...world.pos), [world])
  const groups = useMemo(() => buildSky(P), [P])
  const front = useMemo(() => azToCore(P), [P])
  const lineRefs = useRef([])
  const voiceActive = useRef(false)
  const stageRef = useRef(0)
  const revealRef = useRef({ t: 0 })

  const shot = useCallback(
    (beat, pos, look, ctx) => {
      const id = CHAPTERS[ID].beats[beat]?.id
      const g = groups.find((x) => x.id === id)
      if (g) {
        pos.copy(g.center).addScaledVector(g.dir, 30).addScaledVector(g.t1, -12).addScaledVector(UP, 2)
        look.copy(g.center).addScaledVector(g.t2, -2.5)
        return chapterFrame(ctx, 42)
      }
      if (id === 'outro') {
        around(P, front + 0.5, 0.42, 112, pos)
        look.copy(P)
        return chapterFrame(ctx, 36)
      }
      around(P, front - 0.15, 0.16, 104, pos)
      look.copy(P)
      return chapterFrame(ctx, 36)
    },
    [groups, P, front],
  )
  useWorld(ID, shot)

  const { geo, mat } = useMemo(() => {
    const all = groups.flatMap((g) => g.stars.map((s, j) => ({ ...s, g: g.k, idx: g.k * 100 + j, hue: g.hue })))
    const pos = new Float32Array(all.length * 3)
    const col = new Float32Array(all.length * 3)
    const size = new Float32Array(all.length)
    const grp = new Float32Array(all.length)
    const ord = new Float32Array(all.length)
    const idx = new Float32Array(all.length)
    const c = new THREE.Color()
    all.forEach((s, i) => {
      pos.set([s.pos.x, s.pos.y, s.pos.z], i * 3)
      c.set(s.hue).lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(0.5 + s.level * 0.32)
      col.set([c.r, c.g, c.b], i * 3)
      size[i] = 1.3 + s.level * 0.5
      grp[i] = s.g
      ord[i] = s.order
      idx[i] = s.idx
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aGroup', new THREE.BufferAttribute(grp, 1))
    geo.setAttribute('aOrder', new THREE.BufferAttribute(ord, 1))
    geo.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      uniforms: {
        uReveal: { value: [0, 0, 0, 0, 0] },
        uActive: { value: -1 },
        uHover: { value: -1 },
        uPixel: { value: 1 },
        uTime: { value: 0 },
        uStage: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [groups])

  const lengths = useMemo(
    () =>
      groups.map((g) => {
        let d = 0
        for (let k = 1; k < g.path.length; k++) d += g.path[k].distanceTo(g.path[k - 1])
        return d
      }),
    [groups],
  )

  useFrame((state, dt) => {
    const s = useStore.getState()
    const on = s.agent === ID && (s.phase === 'chapter' || s.phase === 'travel')
    stageRef.current = damp(stageRef.current, on ? 1 : 0, on ? 1.4 : 3, dt)
    const k = stageRef.current
    const id = CHAPTERS[ID].beats[s.beat]?.id
    const activeIdx = on ? groups.findIndex((g) => g.id === id) : -1
    voiceActive.current = on && s.phase === 'chapter' && id === 'voice'
    // constellations ignite one after another once we arrive
    const rv = mat.uniforms.uReveal.value
    const R = revealRef.current
    R.t = on && s.phase === 'chapter' ? R.t + dt : Math.max(0, R.t - dt * 3)
    groups.forEach((g, j) => {
      rv[j] = Math.min(1, Math.max(0, (R.t - j * 0.45) / 1.6))
      const line = lineRefs.current[j]
      if (line) {
        const L = lengths[j]
        line.material.dashOffset = L * (1 - rv[j])
        line.material.opacity = (activeIdx < 0 ? 0.55 : activeIdx === j ? 1 : 0.18) * k
      }
    })
    mat.uniforms.uActive.value = activeIdx
    mat.uniforms.uHover.value = rig.skillHover ?? -1
    mat.uniforms.uPixel.value = dpr
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uStage.value = k
  })

  return (
    <group>
      <Planet id={ID} world={world} />
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />
      {groups.map((g, j) => (
        <Line
          key={g.id}
          ref={(el) => (lineRefs.current[j] = el)}
          points={g.path}
          color={new THREE.Color(g.hue).multiplyScalar(1.6)}
          lineWidth={1.4}
          dashed
          dashSize={lengths[j]}
          gapSize={lengths[j]}
          dashOffset={lengths[j]}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      ))}
      <Waveform group={groups[0]} active={voiceActive} />
      <StarLabels groups={groups} />
      <Signal where={ID} position={around(new THREE.Vector3(), front + 0.28, -0.02, SHELL * 1.18).add(P)} size={2} color="#e9d5ff" />
    </group>
  )
}
