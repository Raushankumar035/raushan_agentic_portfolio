// Shared parts for the agent robots: geometry, materials, rigs and gestures.
import * as THREE from 'three'
import { TAU } from '../lib/math'
import { glowTexture, hatTexture, iconTexture, padTexture, panelTexture } from './textures'
import { fresnelFrag, fresnelVert } from './shaders'

export const DEG = Math.PI / 180

// Per-agent rig: arm raise/forward (deg, L then R), body attitude and props.
export const RIGS = {
  skills: {
    arms: [32, 128, -18, -36],
    yaw: 0.28,
    pitch: 0.02,
    roll: 0.05,
    knob: false,
    halo: true,
    panels: [
      { kind: 'chart', pos: [-1.1, 0.78, 0.02], rot: [0, 0.6, 0.05], w: 0.96 },
      { kind: 'code', pos: [1.1, 0.92, -0.02], rot: [0, -0.62, -0.05], w: 0.86 },
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
    panels: [{ kind: 'map', pos: [1.21, 0.62, 0.0], rot: [0, -0.62, 0.02], w: 1.09 }],
  },
  connect: {
    arms: [122, 44, -34, -14],
    yaw: 0.22,
    pitch: 0.04,
    roll: 0.06,
    knob: true,
    hearts: true,
    panels: [{ kind: 'contact', pos: [-1.16, 0.5, 0.08], rot: [0, 0.58, -0.03], w: 0.96 }],
  },
  experience: {
    arms: [84, 84, -12, -12],
    yaw: 0.3,
    pitch: 0.03,
    roll: 0.0,
    knob: true,
    disc: true,
    panels: [{ kind: 'bars', pos: [-1.1, 1.02, -0.08], rot: [0, 0.58, 0.04], w: 0.91 }],
  },
  404: {
    arms: [24, 24, -10, -10],
    yaw: 0,
    pitch: 0,
    roll: 0,
    knob: true,
    panels: [],
  },
}

export const HABITS = {
  skills: ['nod', 'wave', 'spin'],
  projects: ['hop', 'spin', 'wave'],
  journey: ['wave', 'hop', 'nod'],
  connect: ['wave', 'hop', 'nod'],
  experience: ['spin', 'nod', 'hop'],
}
export const GESTURE_SECONDS = { wave: 1.6, hop: 0.85, spin: 1.3, nod: 0.9, celebrate: 1.3 }

// ---------- shared geometry ----------

export const HEAD_R = [0.59, 0.5, 0.51]
export const VISOR_R = [0.55, 0.47, 0.47]
export const VISOR_Z = 0.07

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

export function heartGeometry() {
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
export function robotGeometry() {
  if (G) return G
  const arm = new THREE.CapsuleGeometry(0.1, 0.18, 6, 18)
  arm.translate(0, -0.15, 0)
  const hat = new THREE.ConeGeometry(0.2, 0.46, 32, 1, true)
  hat.translate(0, 0.23, 0)
  G = {
    head: new THREE.SphereGeometry(0.5, 56, 40),
    visor: new THREE.SphereGeometry(0.5, 56, 40),
    rim: new THREE.TubeGeometry(visorRimCurve(), 160, 0.016, 8, true),
    ear: new THREE.CylinderGeometry(0.16, 0.16, 0.14, 40),
    earRing: new THREE.TorusGeometry(0.1, 0.017, 10, 48),
    earCap: new THREE.CircleGeometry(0.1, 40),
    knob: new THREE.SphereGeometry(0.075, 24, 18),
    stem: new THREE.CylinderGeometry(0.026, 0.036, 0.1, 12),
    body: new THREE.SphereGeometry(0.32, 44, 32),
    chestRing: new THREE.TorusGeometry(0.085, 0.017, 10, 40),
    chestCore: new THREE.CircleGeometry(0.068, 32),
    arm,
    hand: new THREE.SphereGeometry(0.125, 24, 18),
    leg: new THREE.CapsuleGeometry(0.1, 0.1, 6, 18),
    foot: new THREE.SphereGeometry(0.13, 24, 18),
    padRing: new THREE.TorusGeometry(0.46, 0.012, 8, 96),
    padDisc: new THREE.CircleGeometry(0.62, 48),
    icon: new THREE.PlaneGeometry(0.4, 0.4),
    halo: new THREE.TorusGeometry(0.3, 0.022, 12, 72),
    disc: new THREE.TorusGeometry(0.98, 0.016, 10, 160),
    panel: new THREE.PlaneGeometry(1, 352 / 512),
    sprite: new THREE.PlaneGeometry(1, 1),
    burst: new THREE.RingGeometry(0.46, 0.5, 80),
    hit: new THREE.SphereGeometry(0.9, 12, 10),
    heart: heartGeometry(),
    hat,
    pom: new THREE.SphereGeometry(0.06, 16, 12),
    flame: new THREE.ConeGeometry(0.07, 0.5, 16, 1, true),
  }
  return G
}

// ---------- materials ----------

const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k)
export const ADDITIVE = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }

export function robotMaterials(agent) {
  const rig = RIGS[agent.id]
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
  const icon = new THREE.MeshBasicMaterial({ map: iconTexture(agent.icon), color: hdr(agent.color, 3.4), ...ADDITIVE })
  const glow = new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(agent.color), opacity: 0.3, ...ADDITIVE })
  const pad = new THREE.MeshBasicMaterial({ map: padTexture(), color: hdr(agent.color, 1.3), opacity: 0.55, ...ADDITIVE })
  const burst = new THREE.MeshBasicMaterial({ color: hdr(agent.color, 3), opacity: 0, side: THREE.DoubleSide, ...ADDITIVE })
  const flame = new THREE.MeshBasicMaterial({ color: hdr(agent.color, 2.2), opacity: 0, side: THREE.DoubleSide, ...ADDITIVE })
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
    ...ADDITIVE,
  })
  const panels = {}
  rig.panels.forEach((p) => {
    panels[p.kind] = new THREE.MeshBasicMaterial({
      map: panelTexture(p.kind),
      color: hdr(agent.color, 1.7),
      opacity: 0.9,
      side: THREE.DoubleSide,
      ...ADDITIVE,
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
  const hat = new THREE.MeshStandardMaterial({ map: hatTexture(agent.color), roughness: 0.5, side: THREE.DoubleSide })
  const pom = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 1.6), toneMapped: false })
  const dimmable = [shell, accent, neon, icon, glow, pad, ...hearts, ...Object.values(panels)].map((m) => ({
    m,
    color: m.color.clone(),
    emissive: m.emissive ? m.emissive.clone() : null,
  }))
  const pulse = neon.clone()
  return { shell, accent, glass, dark, neon, pulse, pulseBase: neon.color.clone(), iconBase: icon.color.clone(), icon, glow, pad, burst, flame, rim, panels, hearts, hat, pom, dimmable }
}

// ---------- gestures ----------

export const bellp = (p) => Math.sin(Math.PI * Math.min(1, Math.max(0, p)))
const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// Offsets a gesture adds at progress p (0..1). Everything a gesture touches is additive.
export function gestureOffsets(type, p, o) {
  const b = bellp(p)
  switch (type) {
    case 'wave':
      o.wave = b
      o.tilt = 0.12 * b
      break
    case 'hop': {
      const air = clamp((p - 0.18) / 0.64, 0, 1)
      o.y = 0.32 * bellp(air)
      o.squash = p < 0.18 ? -0.12 * bellp(p / 0.18) : p > 0.82 ? -0.1 * bellp((p - 0.82) / 0.18) : 0.06 * bellp(air)
      o.arms = 0.5 * bellp(air)
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
      o.y = 0.42 * bellp(air)
      o.squash = p < 0.12 ? -0.14 * bellp(p / 0.12) : 0.05 * bellp(air)
      o.spin = inOut(air) * Math.PI * 2
      o.arms = 0.9 * bellp(air)
      break
    }
  }
  return o
}
