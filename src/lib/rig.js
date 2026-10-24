import { Quaternion, Vector3 } from 'three'
import { AGENTS } from '../agents'
import { DEG, TAU } from './math'

// ---------- hub composition (the Core with its five agents in orbit) ----------

export const HUB_FOV = 18
const HALF_H = 5.4
// Distance at which the hub frame is HALF_H tall at the Core.
export const HUB_DIST = HALF_H / Math.tan((HUB_FOV / 2) * DEG)
// Orbital slot of each agent at rest (deg): skills, projects, journey, connect, experience.
export const SLOTS = [236, 306, 12, 70, 160].map((d) => d * DEG)
export const TILT = -6 * DEG
export const RINGS = [0.52, 1, 1.3]
export const BOB_PERIODS = [2.6, 2.9, 3.3, 2.75, 3.1]

export function layout(w, h) {
  const aspect = w / h
  const narrow = aspect < 0.85
  const W = HALF_H * aspect
  const elev = (narrow ? 30 : 21) * DEG
  const rx = narrow ? 0.66 * W : Math.min(0.62 * W, 6.4)
  const rz = ((narrow ? 0.4 : 0.36) * HALF_H) / Math.sin(elev)
  return {
    w,
    h,
    aspect,
    k: narrow ? 0.62 : Math.max(0.55, Math.min(w / 1560, h / 920, 1.15)),
    narrow,
    elev,
    rx,
    rz,
    // where the Core sits on screen, 0 = top, 1 = bottom
    centerY: narrow ? 0.42 : 0.385,
    robotScale: narrow ? 0.78 : 1.12,
    portraitR: narrow ? Math.min(0.5 * W, 1.5) : 0.35 * HALF_H,
  }
}

// The orbit is a flat ellipse in the XZ plane, rolled about the default view axis so it reads
// tilted on screen while the bots themselves stay upright.
const _q = new Quaternion()
const _axis = new Vector3()
export function orbitPoint(L, ang, s = 1, out = new Vector3()) {
  out.set(Math.cos(ang) * L.rx * s, 0, Math.sin(ang) * L.rz * s)
  _axis.set(0, Math.sin(L.elev), Math.cos(L.elev)).normalize()
  _q.setFromAxisAngle(_axis, TILT)
  return out.applyQuaternion(_q)
}

// ---------- the rig: every value the render loop reads, mutated by GSAP and input ----------

const bot = () => ({
  enter: 0, // flip-in at the intro / beam-in on handoff
  props: 0, // holo panels, halo, hearts
  hover: 0,
  press: 1,
  burst: 0,
  dim: 0,
  attach: 0, // 0 = orbiting the Core, 1 = riding with the camera
  anchor: { x: 0, y: -0.2, z: 9 }, // camera-space placement while attached (x, y in NDC, z depth)
  fly: 0, // superhero pose while leading a flight
  face: 0, // 0 = face the travel direction, 1 = face the camera
  scale: 1,
  talk: 0, // visor pulse while speaking
  wave: 0, // set to a timestamp to trigger a wave
  hop: 0,
  spin: 0,
  lookX: 0,
  lookY: 0,
})

export const rig = {
  L: layout(1280, 800),
  reduce: false,
  tier: 1, // 0 = low (phones), 1 = default, 2 = strong GPU
  hum: 0, // proximity to the nearest uncollected signal, 0..1
  camVel: new Vector3(),
  time: 0,
  phase: 'loading',
  camMode: 'hub',
  // desired camera, written by the director, the hub controls and the worlds
  want: { pos: new Vector3(0, 400, 900), look: new Vector3(), fov: 45, fx: 0, fy: 0 },
  // actual (smoothed) camera
  cam: {
    pos: new Vector3(0, 400, 900),
    look: new Vector3(),
    vel: new Vector3(),
    lookVel: new Vector3(),
    fov: 45,
    fx: 0,
    fy: 0,
    omega: 2.4,
    shake: 0,
  },
  hub: {
    az: 0,
    el: 21 * DEG,
    dist: HUB_DIST,
    taz: 0,
    tel: 21 * DEG,
    tdist: HUB_DIST,
    px: 0,
    py: 0,
    sx: 0,
    sy: 0,
    dragging: false,
    lastInput: 0,
  },
  travel: { t: 0, curve: null, look0: new Vector3(), look1: new Vector3(), fov0: 18, fov1: 32, fx0: 0, fy0: 0, fx1: 0, fy1: 0, peak: 52 },
  chapter: { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0, dragging: false },
  orbit: { base: 0, speed: 0 },
  intro: {
    stars: 0,
    portrait: 0,
    portraitRing: 0,
    glow: 0,
    rings: { 0: 0, 1: 0, 2: 0 },
    galaxy: 0,
  },
  bots: AGENTS.map(bot),
  world: AGENTS.map(() => new Vector3()),
  screen: AGENTS.map(() => ({ x: 0, y: 0, occ: 1, vis: 1 })),
  cards: [],
  worlds: {},
  warp: 0,
  pointer: { x: 0, y: 0, nx: 0, ny: 0, active: false, at: 0 },
  audio: { level: 0, bins: new Float32Array(48), live: false },
  party: 0,
  partyOn: false,
  wakeAll: 0,
  beam: 0,
}

export const TWO_PI = TAU
