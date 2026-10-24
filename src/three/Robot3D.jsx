import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOB_PERIODS, SLOTS, TAU, orbitPoint } from './stage'
import { glowTexture, iconTexture, padTexture, panelTexture } from './textures'
import { fresnelFrag, fresnelVert } from './shaders'

const DEG = Math.PI / 180

// Per-agent rig: arm raise/forward (deg, L then R), body attitude and props.
const RIGS = {
  skills: {
    arms: [32, 128, -18, -36],
    yaw: 0.28,
    pitch: 0.02,
    roll: 0.05,
    knob: false,
    halo: true,
    panels: [
      { kind: 'chart', pos: [-1.10, 0.78, 0.02], rot: [0, 0.6, 0.05], w: 0.96 },
      { kind: 'code', pos: [1.10, 0.92, -0.02], rot: [0, -0.62, -0.05], w: 0.86 },
    ],
  },
  projects: {
    arms: [62, 74, -58, -40],
    yaw: -0.32,
    pitch: 0.2,
    roll: -0.12,
    knob: true,
    panels: [
      { kind: 'image', pos: [-1.12, 0.74, -0.04], rot: [0, 0.62, 0], w: 1.01 },
      { kind: 'profile', pos: [1.14, 0.52, 0.02], rot: [0, -0.62, 0], w: 0.94 },
    ],
  },
  journey: {
    arms: [28, 140, -8, -32],
    yaw: -0.36,
    pitch: 0.04,
    roll: -0.04,
    knob: true,
    panels: [{ kind: 'map', pos: [1.21, 0.62, 0.00], rot: [0, -0.62, 0.02], w: 1.09 }],
  },
  connect: {
    arms: [122, 44, -34, -14],
    yaw: 0.22,
    pitch: 0.04,
    roll: 0.06,
    knob: true,
    hearts: true,
    panels: [{ kind: 'contact', pos: [-1.16, 0.50, 0.08], rot: [0, 0.58, -0.03], w: 0.96 }],
  },
  experience: {
    arms: [84, 84, -12, -12],
    yaw: 0.3,
    pitch: 0.03,
    roll: 0.0,
    knob: true,
    disc: true,
    panels: [{ kind: 'bars', pos: [-1.10, 1.02, -0.08], rot: [0, 0.58, 0.04], w: 0.91 }],
  },
}

// ---------- shared geometry ----------

const HEAD_R = [0.59, 0.5, 0.51]
const VISOR_R = [0.55, 0.47, 0.47]
const VISOR_Z = 0.07

// The glowing edge of the visor: where the visor ellipsoid breaks the helmet surface.
function visorRimCurve() {
  const pts = []
  for (let k = 0; k < 96; k++) {
    const t = (k / 96) * TAU
    const c = Math.cos(t)
    const s = Math.sin(t)
    const rmax = 1 / Math.sqrt((c / VISOR_R[0]) ** 2 + (s / VISOR_R[1]) ** 2)
    const at = (r) => {
      const x = r * c
      const y = r * s
      const z = VISOR_Z + VISOR_R[2] * Math.sqrt(Math.max(0, 1 - (x / VISOR_R[0]) ** 2 - (y / VISOR_R[1]) ** 2))
      return [x, y, z]
    }
    let lo = 0
    let hi = rmax * 0.999
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2
      const [x, y, z] = at(mid)
      const g = (x / HEAD_R[0]) ** 2 + (y / HEAD_R[1]) ** 2 + (z / HEAD_R[2]) ** 2 - 1
      if (g > 0) lo = mid
      else hi = mid
    }
    pts.push(new THREE.Vector3(...at(lo)))
  }
  return new THREE.CatmullRomCurve3(pts, true)
}

function heartGeometry() {
  const s = new THREE.Shape()
  s.moveTo(5, 5)
  s.bezierCurveTo(5, 5, 4, 0, 0, 0)
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7)
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19)
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7)
  s.bezierCurveTo(16, 7, 16, 0, 10, 0)
  s.bezierCurveTo(7, 0, 5, 5, 5, 5)
  const g = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelSize: 1.6, bevelThickness: 1.6, bevelSegments: 4, curveSegments: 18 })
  g.center()
  g.rotateZ(Math.PI)
  g.scale(0.011, 0.011, 0.011)
  return g
}

let G = null
function geometry() {
  if (G) return G
  const arm = new THREE.CapsuleGeometry(0.1, 0.18, 8, 24)
  arm.translate(0, -0.15, 0)
  G = {
    head: new THREE.SphereGeometry(0.5, 72, 54),
    visor: new THREE.SphereGeometry(0.5, 72, 54),
    rim: new THREE.TubeGeometry(visorRimCurve(), 192, 0.016, 10, true),
    ear: new THREE.CylinderGeometry(0.16, 0.16, 0.14, 48),
    earRing: new THREE.TorusGeometry(0.1, 0.017, 12, 64),
    earCap: new THREE.CircleGeometry(0.1, 48),
    knob: new THREE.SphereGeometry(0.075, 32, 24),
    stem: new THREE.CylinderGeometry(0.026, 0.036, 0.1, 16),
    body: new THREE.SphereGeometry(0.32, 56, 40),
    chestRing: new THREE.TorusGeometry(0.085, 0.017, 12, 48),
    chestCore: new THREE.CircleGeometry(0.068, 40),
    arm,
    hand: new THREE.SphereGeometry(0.125, 32, 24),
    leg: new THREE.CapsuleGeometry(0.1, 0.1, 8, 24),
    foot: new THREE.SphereGeometry(0.13, 32, 24),
    padRing: new THREE.TorusGeometry(0.46, 0.012, 8, 128),
    padDisc: new THREE.CircleGeometry(0.62, 64),
    icon: new THREE.PlaneGeometry(0.4, 0.4),
    halo: new THREE.TorusGeometry(0.3, 0.022, 16, 96),
    disc: new THREE.TorusGeometry(0.98, 0.016, 12, 200),
    panel: new THREE.PlaneGeometry(1, 352 / 512),
    sprite: new THREE.PlaneGeometry(1, 1),
    burst: new THREE.RingGeometry(0.46, 0.5, 96),
    hit: new THREE.SphereGeometry(0.9, 16, 12),
    heart: heartGeometry(),
  }
  return G
}

// ---------- materials ----------

const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k)

function makeMaterials(agent) {
  const base = new THREE.Color(agent.color).lerp(new THREE.Color(agent.deep), 0.32)
  const light = new THREE.Color(agent.color).lerp(new THREE.Color('#ffffff'), 0.5)
  const shell = new THREE.MeshPhysicalMaterial({
    color: base,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.6,
    sheenColor: light,
    sheenRoughness: 0.45,
    emissive: new THREE.Color(agent.color),
    emissiveIntensity: 0.05,
    envMapIntensity: 1.25,
  })
  const accent = shell.clone()
  accent.color = new THREE.Color(agent.color).lerp(new THREE.Color('#ffffff'), 0.3)
  accent.emissiveIntensity = 0.03
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#04050b',
    roughness: 0.07,
    metalness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.7,
  })
  const dark = new THREE.MeshStandardMaterial({ color: '#0a0d1c', roughness: 0.35, metalness: 0.2 })
  const neon = new THREE.MeshBasicMaterial({ color: hdr(agent.color, 2.6), toneMapped: false })
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }
  const icon = new THREE.MeshBasicMaterial({ map: iconTexture(agent.icon), color: hdr(agent.color, 3.4), ...additive })
  const glow = new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(agent.color), opacity: 0.3, ...additive })
  const pad = new THREE.MeshBasicMaterial({ map: padTexture(), color: hdr(agent.color, 1.3), opacity: 0.55, ...additive })
  const burst = new THREE.MeshBasicMaterial({ color: hdr(agent.color, 3), opacity: 0, side: THREE.DoubleSide, ...additive })
  const rim = new THREE.ShaderMaterial({
    vertexShader: fresnelVert,
    fragmentShader: fresnelFrag,
    uniforms: {
      uColor: { value: new THREE.Color(agent.color) },
      uPower: { value: 1.6 },
      uStrength: { value: 1 },
      uBias: { value: 0 },
      uSign: { value: -2.6 },
    },
    side: THREE.BackSide,
    ...additive,
  })
  const panels = {}
  RIGS[agent.id].panels.forEach((p) => {
    panels[p.kind] = new THREE.MeshBasicMaterial({
      map: panelTexture(p.kind),
      color: hdr(agent.color, 1.7),
      opacity: 0.9,
      side: THREE.DoubleSide,
      ...additive,
    })
  })
  const heart = new THREE.MeshPhysicalMaterial({
    color: agent.color,
    emissive: new THREE.Color(agent.color),
    emissiveIntensity: 1.4,
    roughness: 0.25,
    clearcoat: 1,
    transparent: true,
  })
  const hearts = [heart, heart.clone(), heart.clone()]
  // What "dim" scales during a tour, with the values to scale from.
  const dimmable = [shell, accent, neon, icon, glow, pad, ...hearts, ...Object.values(panels)].map((m) => ({
    m,
    color: m.color.clone(),
    emissive: m.emissive ? m.emissive.clone() : null,
  }))
  const pulse = neon.clone()
  return { shell, accent, glass, dark, neon, pulse, pulseBase: neon.color.clone(), icon, glow, pad, burst, rim, panels, hearts, dimmable, rimBase: 1 }
}

// ---------- component ----------

const _cam = new THREE.Vector3()
const _v = new THREE.Vector3()

// ---------- life: gestures, gaze, blinks ----------

// What each agent does on its own, every 5-12 s: a small cast of habits per personality.
const HABITS = {
  skills: ['nod', 'wave', 'spin'],
  projects: ['hop', 'spin', 'wave'],
  journey: ['wave', 'hop', 'nod'],
  connect: ['wave', 'hop', 'nod'],
  experience: ['spin', 'nod', 'hop'],
}
const GESTURE_SECONDS = { wave: 1.6, hop: 0.85, spin: 1.3, nod: 0.9, celebrate: 1.3 }

const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const bell = (p) => Math.sin(Math.PI * Math.min(1, Math.max(0, p)))
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const follow = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt))

function rng(seed) {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// Offsets a gesture adds at progress p (0..1). Everything a gesture touches is additive.
function gestureOffsets(type, p, o) {
  const b = bell(p)
  switch (type) {
    case 'wave':
      o.wave = b
      o.tilt = 0.12 * b
      break
    case 'hop': {
      const air = clamp((p - 0.18) / 0.64, 0, 1)
      o.y = 0.32 * bell(air)
      // squash before take-off and on landing, stretch in the air
      o.squash = p < 0.18 ? -0.12 * bell(p / 0.18) : p > 0.82 ? -0.1 * bell((p - 0.82) / 0.18) : 0.06 * bell(air)
      o.arms = 0.5 * bell(air)
      break
    }
    case 'spin':
      o.spin = inOut(p) * Math.PI * 2
      o.y = 0.08 * b
      break
    case 'nod':
      o.nod = Math.sin(p * Math.PI * 4) * 0.22 * b
      break
    case 'celebrate': {
      const air = clamp((p - 0.12) / 0.7, 0, 1)
      o.y = 0.42 * bell(air)
      o.squash = p < 0.12 ? -0.14 * bell(p / 0.12) : 0.05 * bell(air)
      o.spin = inOut(air) * Math.PI * 2
      o.arms = 0.9 * bell(air)
      break
    }
  }
  return o
}

const Arm = ({ side, raise, fwd, mat, armRef }) => (
  <group ref={armRef} position={[side * 0.27, 0.03, 0]} rotation={[fwd * DEG, 0, side * raise * DEG]}>
    <mesh geometry={G.arm} material={mat} />
    <mesh geometry={G.hand} material={mat} position={[0, -0.34, 0]} />
  </group>
)

export default function Robot3D({ agent, index, stage, L, onHover, onSelect, onLook }) {
  const g = geometry()
  const rig = RIGS[agent.id]
  const m = useMemo(() => makeMaterials(agent), [agent])
  const root = useRef()
  const body = useRef()
  const torso = useRef()
  const head = useRef()
  const icon = useRef()
  const knob = useRef()
  const armL = useRef()
  const armR = useRef()
  const panelRefs = useRef([])
  const heartRefs = useRef([])
  const halo = useRef()
  const disc = useRef()
  const burst = useRef()
  const glow = useRef()
  const lastDim = useRef(-1)

  // per-bot mutable life state (never React state: it changes every frame)
  const life = useRef(null)
  if (!life.current) {
    const r = rng(index + 11)
    life.current = {
      r,
      yaw: 0,
      pitch: 0,
      body: 0,
      gesture: null,
      nextGesture: 3.5 + index * 1.7 + r() * 3,
      nextBlink: 1 + r() * 3,
      blinkAt: -1,
      idleTarget: { yaw: 0, pitch: 0, until: 0 },
      knob: { a: 0, v: 0 },
      prevYaw: 0,
      wasHover: 0,
      wasBurst: 0,
      happy: 0,
    }
  }
  const o = useMemo(() => ({}), [])
  const waveSide = rig.arms[1] >= rig.arms[0] ? 1 : -1
  const [rl, rr, fl, fr] = rig.arms

  const start = (lf, type, t) => {
    lf.gesture = { type, t0: t, dur: GESTURE_SECONDS[type] }
  }

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05)
    const b = stage.bots[index]
    const lf = life.current
    const t = state.clock.elapsedTime
    const s = L.robotScale
    const calm = stage.reduce
    const focusIdx = stage.cam.focus
    const isFocus = focusIdx === index
    const touring = focusIdx >= 0

    // ---- reactions: hover waves hello, a click makes it jump and spin ----
    if (!calm && b.enter > 0.98) {
      if (b.hover > 0.5 && lf.wasHover <= 0.5 && !touring) {
        start(lf, 'wave', t)
        lf.happy = 1
      }
      if (b.burst > 0.02 && lf.wasBurst <= 0.02) start(lf, 'celebrate', t)
      // idle habits, never while someone is pointing at it or a tour is open
      if (!lf.gesture && t > lf.nextGesture && b.hover < 0.1 && !touring) {
        const list = HABITS[agent.id]
        start(lf, list[Math.floor(lf.r() * list.length)], t)
      }
    }
    lf.wasHover = b.hover
    lf.wasBurst = b.burst
    for (const k in o) o[k] = 0
    if (lf.gesture) {
      const p = (t - lf.gesture.t0) / lf.gesture.dur
      if (p >= 1) {
        lf.gesture = null
        lf.nextGesture = t + 5 + lf.r() * 7
      } else gestureOffsets(lf.gesture.type, p, o)
    }
    lf.happy = follow(lf.happy, 0, 2.2, dt)

    // ---- orbit placement ----
    const ang = stage.orbit.base + SLOTS[index]
    const p = orbitPoint(L, ang, 1, _v)
    p.y += 0.28 * s
    stage.world[index].copy(p)
    const e = b.enter
    const bob = calm ? 0 : Math.sin((t * TAU) / BOB_PERIODS[index]) * 0.05 * s
    root.current.position.set(p.x, p.y + bob + (b.hover * 0.1 + (o.y || 0)) * s, p.z)

    _cam.copy(state.camera.position)
    const toCam = Math.atan2(_cam.x - p.x, _cam.z - p.z)
    root.current.rotation.order = 'YXZ'
    root.current.rotation.set(
      rig.pitch * (1 - 0.6 * b.hover) - L.elev * 0.85 - (1 - e) * 1.25,
      toCam + rig.yaw * (1 - 0.7 * b.hover) + (1 - e) * 1.0,
      rig.roll * (1 - b.hover) + (o.tilt || 0) * -waveSide,
    )
    root.current.scale.setScalar(Math.max(0.0001, s * e * (1 + 0.12 * b.hover) * b.press))

    // ---- gaze: what the head looks at ----
    const me = stage.screen[index]
    const ptr = stage.pointer
    const ptrLive = ptr.active && performance.now() - ptr.at < 4000
    let ty = 0
    let tp = 0
    if (isFocus) {
      // in its own tour it looks at you, with a little curiosity
      ty = Math.sin(t * 0.7) * 0.08
      tp = Math.sin(t * 0.9) * 0.05
    } else {
      const hot = stage.bots.findIndex((x, j) => j !== index && x.hover > 0.5)
      const target = hot >= 0 && !touring ? stage.screen[hot] : ptrLive ? ptr : null
      if (target) {
        const dx = target.x - me.x
        const dy = target.y - me.y
        // nearer cursor = stronger interest
        const w = target === ptr ? clamp(1.25 - Math.hypot(dx, dy) / 700, 0.35, 1) : 0.85
        ty = clamp(dx / 320, -1, 1) * 0.7 * w
        tp = clamp(dy / 320, -1, 1) * 0.38 * w
      } else if (!calm) {
        // nobody around: look about on its own
        if (t > lf.idleTarget.until) {
          lf.idleTarget = { yaw: (lf.r() - 0.5) * 1.1, pitch: (lf.r() - 0.55) * 0.5, until: t + 1.8 + lf.r() * 2.6 }
        }
        ty = lf.idleTarget.yaw
        tp = lf.idleTarget.pitch
      }
    }
    lf.yaw = follow(lf.yaw, ty, 6, dt)
    lf.pitch = follow(lf.pitch, tp, 6, dt)
    lf.body = follow(lf.body, lf.yaw * 0.3, 3, dt)

    head.current.rotation.set(lf.pitch + (o.nod || 0), lf.yaw, -lf.yaw * 0.12)
    body.current.rotation.y = lf.body + (o.spin || 0)
    // breathing + squash and stretch (volume kept: wider as it squashes)
    const breath = calm ? 0 : Math.sin(t * 1.9 + index) * 0.012
    const sq = o.squash || 0
    body.current.scale.set(1 - sq * 0.6, 1 + sq, 1 - sq * 0.6)
    torso.current.scale.set(1, 0.95 * (1 + breath), 0.88 * (1 - breath * 0.5))

    // eyes: the visor icon drifts toward what it looks at, and blinks
    if (!calm && t > lf.nextBlink) {
      lf.blinkAt = t
      lf.nextBlink = t + (lf.r() < 0.2 ? 0.25 : 2.2 + lf.r() * 3.8)
    }
    const blink = lf.blinkAt >= 0 ? clamp(1 - bell((t - lf.blinkAt) / 0.16), 0.08, 1) : 1
    const joy = 1 + 0.18 * bell(1 - lf.happy) * (lf.happy > 0.01 ? 1 : 0)
    icon.current.position.set(lf.yaw * 0.07, 0.02 - lf.pitch * 0.07, 0.555)
    icon.current.scale.set(joy, blink * joy, 1)

    // antenna: a damped spring kicked by head turns and hops
    if (knob.current) {
      const kn = lf.knob
      const yawVel = (lf.yaw - lf.prevYaw) / Math.max(dt, 1e-3)
      kn.v += (-70 * kn.a - 7 * kn.v) * dt - yawVel * 0.9 * dt * 10 - (o.squash || 0) * 4 * dt * 10
      kn.a = clamp(kn.a + kn.v * dt, -0.6, 0.6)
      knob.current.rotation.z = kn.a
    }
    lf.prevYaw = lf.yaw

    // arms: idle sway, the wave, and arms up in the air on a hop
    const sway = calm ? 0 : Math.sin(t * 1.3 + index * 2) * 4
    const up = (o.arms || 0) * 50
    const wv = o.wave || 0
    const waveAngle = 150 + Math.sin(t * 13) * 22
    const raiseL = rl + sway + up + (waveSide < 0 ? (waveAngle - rl) * wv : 0)
    const raiseR = rr - sway + up + (waveSide > 0 ? (waveAngle - rr) * wv : 0)
    armL.current.rotation.set(fl * DEG, 0, -raiseL * DEG)
    armR.current.rotation.set(fr * DEG, 0, raiseR * DEG)

    // ---- props ----
    const pr = b.props
    const spread = 1 + 0.2 * b.hover
    rig.panels.forEach((pd, k) => {
      const el = panelRefs.current[k]
      if (!el) return
      const fl2 = calm ? 0 : Math.sin(t * (1.1 + k * 0.23) + index * 1.7 + k) * 0.035
      el.position.set(pd.pos[0] * spread, pd.pos[1] + fl2 + b.hover * 0.05, pd.pos[2])
      el.rotation.set(pd.rot[0] + lf.pitch * 0.2, pd.rot[1] + lf.yaw * 0.25, pd.rot[2])
      el.scale.setScalar(Math.max(0.0001, pd.w * (0.3 + 0.7 * pr)))
      el.material.opacity = 0.9 * pr
    })
    if (halo.current) {
      halo.current.position.y = 1.24 + (calm ? 0 : Math.sin(t * 1.6 + index) * 0.03) + (o.y || 0) * 0.3
      halo.current.rotation.z = Math.sin(t * 0.7) * 0.12 + lf.yaw * 0.3
      halo.current.scale.setScalar(Math.max(0.0001, pr))
    }
    if (disc.current) {
      disc.current.rotation.set(1.32 + Math.sin(t * 0.9) * 0.06, 0, calm ? 0 : t * (0.25 + b.hover * 1.2))
      disc.current.scale.setScalar(Math.max(0.0001, (0.6 + 0.4 * pr) * spread))
      disc.current.visible = pr > 0.01
    }
    heartRefs.current.forEach((h, k) => {
      if (!h) return
      // hearts rise faster while you point at it
      const ph = calm ? 0.4 : (t * (0.32 + b.hover * 0.4) + k * 0.33) % 1
      h.position.set([-0.55, 0.6, 0.78][k] * spread, 0.95 + ph * 0.55, 0.1)
      h.rotation.y = Math.sin(t * 1.4 + k) * 0.5
      h.scale.setScalar(Math.max(0.0001, (0.7 + 0.5 * Math.sin(ph * Math.PI)) * pr))
      h.material.opacity = Math.sin(ph * Math.PI) * pr
    })

    if (burst.current) {
      burst.current.visible = b.burst > 0.001 && b.burst < 0.999
      burst.current.scale.setScalar(0.4 + b.burst * 2.4)
      m.burst.opacity = 0.8 * (1 - b.burst)
      burst.current.quaternion.copy(state.camera.quaternion)
    }
    if (glow.current) {
      glow.current.quaternion.copy(state.camera.quaternion)
      m.glow.opacity = (0.22 + 0.2 * b.hover) * (1 - 0.6 * b.dim)
    }
    m.rim.uniforms.uStrength.value = (m.rimBase + b.hover * 0.9) * (1 - 0.7 * b.dim)

    // heartbeat in the chest light and ear rings
    const beat = calm ? 0.3 : Math.pow(Math.max(0, Math.sin(t * 2.4 + index)), 12) + 0.5 * Math.pow(Math.max(0, Math.sin(t * 2.4 + index - 0.5)), 12)
    m.pulse.color.copy(m.pulseBase).multiplyScalar((0.75 + 0.6 * beat + 0.5 * b.hover) * (1 - 0.62 * b.dim))

    if (lastDim.current !== b.dim) {
      lastDim.current = b.dim
      const k = 1 - 0.62 * b.dim
      m.dimmable.forEach((d) => {
        d.m.color.copy(d.color).multiplyScalar(k)
        if (d.emissive) d.m.emissive.copy(d.emissive).multiplyScalar(k)
      })
    }
  })

  return (
    <group ref={root}>
      <mesh ref={glow} geometry={g.sprite} material={m.glow} position={[0, 0.25, -0.6]} scale={3.2} renderOrder={-1} />
      <group position={[0, -0.74, 0]}>
        <mesh geometry={g.padRing} material={m.neon} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={g.padDisc} material={m.pad} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} />
      </group>

      {/* body pivots at the feet so squash and stretch read as weight */}
      <group position={[0, -0.68, 0]}>
        <group ref={body}>
          <group position={[0, 0.68, 0]}>
            {[-1, 1].map((sd) => (
              <group key={sd}>
                <mesh geometry={g.leg} material={m.accent} position={[sd * 0.13, -0.42, 0]} />
                <mesh geometry={g.foot} material={m.shell} position={[sd * 0.14, -0.6, 0.05]} scale={[1, 0.62, 1.3]} />
              </group>
            ))}
            <Arm side={-1} raise={rl} fwd={fl} mat={m.accent} armRef={armL} />
            <Arm side={1} raise={rr} fwd={fr} mat={m.accent} armRef={armR} />

            <mesh ref={torso} geometry={g.body} material={m.shell} position={[0, -0.12, 0]} scale={[1, 0.95, 0.88]} />
            <group position={[0, -0.08, 0.288]} rotation={[-0.2, 0, 0]}>
              <mesh geometry={g.chestCore} material={m.glass} />
              <mesh geometry={g.chestRing} material={m.pulse} />
            </group>

            {/* head pivots at the neck */}
            <group position={[0, 0.16, 0]}>
              <group ref={head}>
                <group position={[0, 0.46, 0]}>
                  <mesh geometry={g.head} material={m.shell} scale={[1.18, 1, 1.02]} />
                  <mesh geometry={g.head} material={m.rim} scale={[1.18 * 1.07, 1.07, 1.02 * 1.07]} />
                  <mesh geometry={g.visor} material={m.glass} position={[0, 0, VISOR_Z]} scale={[VISOR_R[0] * 2, VISOR_R[1] * 2, VISOR_R[2] * 2]} />
                  <mesh geometry={g.rim} material={m.neon} />
                  <mesh ref={icon} geometry={g.icon} material={m.icon} position={[0, 0.02, 0.555]} />
                  {[-1, 1].map((sd) => (
                    <group key={sd} position={[sd * 0.6, 0, 0]}>
                      <mesh geometry={g.ear} material={m.accent} rotation={[0, 0, Math.PI / 2]} />
                      <mesh geometry={g.earCap} material={m.dark} position={[sd * 0.071, 0, 0]} rotation={[0, (sd * Math.PI) / 2, 0]} />
                      <mesh geometry={g.earRing} material={m.pulse} position={[sd * 0.072, 0, 0]} rotation={[0, (sd * Math.PI) / 2, 0]} />
                    </group>
                  ))}
                  {rig.knob && (
                    <group position={[0, 0.48, 0]}>
                      <group ref={knob}>
                        <mesh geometry={g.stem} material={m.accent} position={[0, 0.04, 0]} />
                        <mesh geometry={g.knob} material={m.shell} position={[0, 0.12, 0]} />
                      </group>
                    </group>
                  )}
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      <group>
        {rig.panels.map((pd, k) => (
          <mesh key={pd.kind} ref={(el) => (panelRefs.current[k] = el)} geometry={g.panel} material={m.panels[pd.kind]} rotation={pd.rot} renderOrder={2} />
        ))}
        {rig.halo && <mesh ref={halo} geometry={g.halo} material={m.neon} rotation={[1.36, 0, 0]} />}
        {rig.disc && <mesh ref={disc} geometry={g.disc} material={m.neon} position={[0, -0.1, 0]} />}
        {rig.hearts && [0, 1, 2].map((k) => <mesh key={k} ref={(el) => (heartRefs.current[k] = el)} geometry={g.heart} material={m.hearts[k]} />)}
      </group>

      <mesh ref={burst} geometry={g.burst} material={m.burst} position={[0, 0.3, 0]} visible={false} />

      {/* generous invisible hit area so the bot is easy to point at */}
      <mesh
        geometry={g.hit}
        position={[0, 0.25, 0]}
        scale={[1.15, 1.2, 1]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(index, true)
        }}
        onPointerOut={() => onHover(index, false)}
        onPointerMove={(e) => onLook(index, e)}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(index)
        }}
      >
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}
