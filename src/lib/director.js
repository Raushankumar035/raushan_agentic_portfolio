// The director: every scripted move in the galaxy (intro, flights, beats, hand-offs) lives here.
// UI calls these; the render loop only reads `rig`.
import gsap from 'gsap'
import { CatmullRomCurve3, Vector3 } from 'three'
import { HUB_DIST, rig } from './rig'
import { clamp, smooth } from './math'
import { useStore } from '../store'
import { AGENTS, AGENT_INDEX, agentById } from '../agents'
import { CHAPTERS } from '../content/chapters'
import { POKES } from '../content/secrets'
import { sound } from './sound'
import { voice } from './voice'
import { voices } from './api'

const S = () => useStore.getState()
const UP = new Vector3(0, 1, 0)
let busy = false
let travelTween = null

// ---------- framing ----------

// Where the guide rides in camera space: x, y in frame NDC, z = depth.
export function anchors(L = rig.L) {
  if (L.narrow) return { lead: { x: 0.05, y: -0.12, z: 11 }, narrator: { x: -0.62, y: 0.48, z: 10 }, scale: 0.62 }
  return { lead: { x: 0.02, y: -0.28, z: 11.5 }, narrator: { x: -0.8, y: -0.5, z: 9 }, scale: 0.8 }
}

export const shotCtx = () => ({ L: rig.L, narrow: rig.L.narrow, aspect: rig.L.aspect, time: rig.time })

// The Core, seen from the hub controls (azimuth, elevation, distance).
export function hubShot(pos, look, h = rig.hub) {
  const d = h.dist
  pos.set(Math.sin(h.az) * Math.cos(h.el) * d, Math.sin(h.el) * d, Math.cos(h.az) * Math.cos(h.el) * d)
  look.set(0, 0, 0)
  const far = smooth(HUB_DIST * 1.6, 520, d)
  return { fov: 18 + far * 30, fx: 0, fy: (1 - 2 * rig.L.centerY) * (1 - far) }
}

function beatIndex(id, beat) {
  const beats = CHAPTERS[id].beats
  if (typeof beat === 'number') return clamp(beat, 0, beats.length - 1)
  const k = beats.findIndex((b) => b.id === beat)
  return k < 0 ? 0 : k
}

// ---------- speech ----------

// The guide speaks a line: pre-rendered Sarvam voice, live Sarvam, or the browser, in that order.
// A non-English narration track only applies when that line was pre-rendered (scripts/voices.mjs).
export function say(agentId, text) {
  const s = S()
  const lang = s.lang !== 'en-IN' && voices()[s.lang]?.[`${agentId}|${text}`] ? s.lang : 'en-IN'
  s.setLine(voice.localise(text, agentId, lang))
  if (s.sound && s.voice && voice.canSpeak) voice.speak(text, agentId, { lang })
  else if (s.sound) sound.chirp(agentById(agentId)?.voice.pitch ?? 1, 3 + Math.floor(Math.random() * 3))
}

// ---------- flights ----------

const _a = new Vector3()
const _b = new Vector3()

function flight(toPos, toLook, toFrame, { dur, lift = 1 } = {}) {
  const from = rig.cam.pos.clone()
  const fromLook = rig.cam.look.clone()
  const dir = _a.copy(toPos).sub(from)
  const dist = dir.length()
  const back = _b.copy(from).sub(fromLook).normalize()
  const side = new Vector3().crossVectors(dir, UP).normalize()
  const p1 = from.clone().addScaledVector(back, Math.min(26, dist * 0.1)).addScaledVector(UP, Math.min(16, dist * 0.06) * lift)
  const mid = from.clone().lerp(toPos, 0.5).addScaledVector(UP, dist * 0.1 * lift).addScaledVector(side, dist * 0.08)
  const approach = toPos.clone().sub(toLook).normalize()
  const p3 = toPos.clone().addScaledVector(approach, Math.min(55, dist * 0.22))
  const T = rig.travel
  T.curve = new CatmullRomCurve3([from, p1, mid, p3, toPos.clone()], false, 'centripetal')
  T.look0.copy(fromLook)
  T.look1.copy(toLook)
  T.fov0 = rig.cam.fov
  T.fov1 = toFrame.fov
  T.fx0 = rig.cam.fx
  T.fy0 = rig.cam.fy
  T.fx1 = toFrame.fx
  T.fy1 = toFrame.fy
  T.peak = Math.max(T.fov0, T.fov1) + clamp(dist / 9, 6, 26)
  T.t = 0
  rig.camMode = 'travel'
  const d = rig.reduce ? 0.01 : dur ?? clamp(1.7 + dist / 170, 2.2, 3.5)
  travelTween?.kill()
  return { dur: d, dist }
}

function runFlight(dur, onDone) {
  travelTween = gsap.to(rig.travel, { t: 1, duration: dur, ease: 'power2.inOut', onComplete: onDone })
  if (dur > 0.5) sound.whoosh(dur)
}

// ---------- intro: from outside the galaxy down to the Core ----------

const ESTABLISH = [new Vector3(-140, 760, 980), new Vector3(-260, 380, 520), new Vector3(-120, 120, 190), new Vector3(-18, 30, 70)]

// The gate shows the whole galaxy; the dive starts when the visitor enters.
export function prepareIntro() {
  rig.hub.az = rig.hub.taz = 0
  rig.hub.el = rig.hub.tel = rig.L.elev
  rig.hub.dist = rig.hub.tdist = HUB_DIST
  const pos = new Vector3()
  const look = new Vector3()
  const frame = hubShot(pos, look)
  rig.cam.pos.copy(ESTABLISH[0])
  rig.cam.look.set(0, 0, 0)
  rig.cam.fov = 46
  rig.cam.vel.set(0, 0, 0)
  rig.cam.lookVel.set(0, 0, 0)
  const T = rig.travel
  T.curve = new CatmullRomCurve3([...ESTABLISH.map((v) => v.clone()), pos.clone()], false, 'centripetal')
  T.look0.set(0, 0, 0)
  T.look1.copy(look)
  T.fov0 = 46
  T.fov1 = frame.fov
  T.peak = 46
  T.fx0 = T.fx1 = 0
  T.fy0 = 0
  T.fy1 = frame.fy
  T.t = 0
  rig.camMode = 'travel'
  gsap.to(rig.intro, { galaxy: 1, stars: 1, duration: 2.6, ease: 'sine.out' })
}

export function startIntro() {
  const reduce = rig.reduce
  useStore.setState({ phase: 'intro' })
  rig.phase = 'intro'
  const I = rig.intro
  const tl = gsap.timeline()
  const pos = new Vector3()
  const look = new Vector3()
  const frame = hubShot(pos, look)

  if (reduce) {
    Object.assign(I, { stars: 1, galaxy: 1, portrait: 1, portraitRing: 1, glow: 1 })
    Object.assign(I.rings, { 0: 1, 1: 1, 2: 1 })
    rig.bots.forEach((b) => Object.assign(b, { enter: 1, props: 1 }))
    rig.cam.pos.copy(pos)
    rig.cam.look.copy(look)
    rig.cam.fov = frame.fov
    rig.cam.fy = frame.fy
    rig.camMode = 'hub'
    rig.orbit.speed = 0
    useStore.setState({ phase: 'hub' })
    rig.phase = 'hub'
    return tl
  }

  // the dive: from the whole galaxy down to its heart
  const T = rig.travel
  if (!T.curve) prepareIntro()
  tl.to(I, { galaxy: 1, stars: 1, duration: 0.8 }, 0)
  tl.fromTo(T, { t: 0 }, { t: 1, duration: 5, ease: 'power3.inOut' }, 0.1)
  tl.add(() => sound.whoosh(4.2), 0.5)
  tl.fromTo(I, { glow: 0 }, { glow: 1, duration: 1.4, ease: 'power2.out' }, 3.2)
  tl.fromTo(I, { portrait: 0 }, { portrait: 1, duration: 1.4, ease: 'expo.out' }, 3.4)
  tl.fromTo(I, { portraitRing: 0 }, { portraitRing: 1, duration: 1.5, ease: 'power2.inOut' }, 3.55)
  ;[0, 1, 2].forEach((k) => tl.fromTo(I.rings, { [k]: 0 }, { [k]: 1, duration: 1.6 - k * 0.15, ease: 'sine.inOut' }, 3.7 + k * 0.3))
  AGENTS.forEach((a, i) => {
    const at = 4.2 + i * 0.09
    const b = rig.bots[i]
    tl.fromTo(b, { enter: 0 }, { enter: 1, duration: 0.95, ease: 'back.out(1.35)' }, at)
    tl.fromTo(b, { props: 0 }, { props: 1, duration: 0.7, ease: 'expo.out' }, at + 0.5)
  })
  tl.add(() => {
    rig.camMode = 'hub'
    useStore.setState({ phase: 'hub' })
    rig.phase = 'hub'
    sound.arrive()
  }, 5.15)
  tl.fromTo(rig.orbit, { speed: 0 }, { speed: 1, duration: 2.2, ease: 'sine.inOut' }, 5.2)
  return tl
}

// ---------- open an agent's world ----------

export function openAgent(id, { beat = 0 } = {}) {
  const s = S()
  if (!(id in AGENT_INDEX)) return
  if (s.phase === 'chapter' && s.agent === id) {
    goBeat(beatIndex(id, beat))
    return
  }
  if (busy || !['hub', 'chapter', 'intro'].includes(s.phase)) return
  const world = rig.worlds[id]
  if (!world) return
  busy = true
  voice.cancel()
  const i = AGENT_INDEX[id]
  const b = rig.bots[i]
  const prev = s.phase === 'chapter' ? s.agent : null
  const n = beatIndex(id, beat)
  const A = anchors()
  sound.select(i)

  useStore.setState({ phase: 'travel', agent: id, beat: n, detail: null, bubble: null, line: '', pokes: 0 })
  rig.phase = 'travel'
  rig.chapter.tyaw = rig.chapter.tpitch = 0

  const tl = gsap.timeline()
  let startAt
  if (!prev) {
    // a happy jump, then the guide rises off its orbit and leads the way
    tl.to(b, { press: 0.9, duration: 0.12, ease: 'power2.in' }, 0).to(b, { press: 1.04, duration: 0.5, ease: 'back.out(2)' })
    tl.fromTo(b, { burst: 0 }, { burst: 1, duration: 0.75, ease: 'power2.out' }, 0)
    rig.bots.forEach((o, j) => j !== i && tl.to(o, { dim: 1, duration: 0.6, ease: 'power2.inOut' }, 0))
    tl.set(b, { anchor: { ...A.lead }, face: 0, scale: A.scale }, 0)
    tl.to(b, { attach: 1, duration: 1.1, ease: 'power2.inOut' }, 0.42)
    tl.to(b, { fly: 1, duration: 0.8, ease: 'power2.out' }, 0.5)
    startAt = 0.5
  } else {
    // the last guide beams out; the next beams in right beside you
    const pb = rig.bots[AGENT_INDEX[prev]]
    tl.to(pb, { enter: 0, duration: 0.42, ease: 'back.in(2)' }, 0)
    tl.set(pb, { attach: 0, fly: 0, face: 0 }, 0.45)
    tl.set(pb, { enter: 1 }, 1.2)
    tl.set(b, { attach: 1, anchor: { ...A.lead }, enter: 0, fly: 1, face: 0, dim: 0, scale: A.scale }, 0.3)
    tl.to(b, { enter: 1, duration: 0.6, ease: 'back.out(1.6)' }, 0.32)
    tl.fromTo(b, { burst: 0 }, { burst: 1, duration: 0.7, ease: 'power2.out' }, 0.32)
    startAt = 0.45
  }

  tl.add(() => {
    const pos = new Vector3()
    const look = new Vector3()
    const frame = world.shot(n, pos, look, shotCtx())
    const { dur } = flight(pos, look, frame)
    runFlight(dur, () => arrive(id))
    // settle into the narrator seat as we arrive
    gsap.delayedCall(Math.max(0, dur * 0.66), () => {
      gsap.to(b.anchor, { ...A.narrator, duration: 1.3, ease: 'power3.inOut' })
      gsap.to(b, { fly: 0, duration: 0.9, ease: 'power2.inOut' })
      gsap.to(b, { face: 1, duration: 1.1, ease: 'power2.inOut', delay: 0.2 })
    })
  }, startAt)
}

function arrive(id) {
  busy = false
  rig.camMode = 'shot'
  rig.phase = 'chapter'
  const s = S()
  useStore.setState({ phase: 'chapter' })
  s.visit(id)
  sound.arrive()
  const i = AGENT_INDEX[id]
  rig.bots[i].wave = rig.time
  const beat = CHAPTERS[id].beats[S().beat]
  say(id, beat.say)
}

export function goBeat(n) {
  const s = S()
  if (s.phase !== 'chapter') return
  const beats = CHAPTERS[s.agent].beats
  n = clamp(n, 0, beats.length - 1)
  if (n === s.beat) return
  useStore.setState({ beat: n, detail: null })
  rig.chapter.tyaw = rig.chapter.tpitch = 0
  sound.tick()
  const b = rig.bots[AGENT_INDEX[s.agent]]
  b.hop = rig.time
  say(s.agent, beats[n].say)
}

export function goBeatId(beatId) {
  const s = S()
  if (!s.agent) return
  goBeat(beatIndex(s.agent, beatId))
}

export const nextBeat = () => goBeat(S().beat + 1)
export const prevBeat = () => goBeat(S().beat - 1)

// ---------- back to the Core ----------

export function backToHub() {
  const s = S()
  if (busy || s.phase !== 'chapter') return
  busy = true
  voice.cancel()
  const id = s.agent
  const i = AGENT_INDEX[id]
  const b = rig.bots[i]
  const A = anchors()
  useStore.setState({ phase: 'travel', detail: null, line: '' })
  rig.phase = 'travel'
  sound.click()

  // come home to the default framing
  const h = rig.hub
  h.taz = h.az = 0
  h.tel = h.el = rig.L.elev
  h.tdist = h.dist = HUB_DIST
  const pos = new Vector3()
  const look = new Vector3()
  const frame = hubShot(pos, look)
  const { dur } = flight(pos, look, frame, { lift: 0.6 })

  gsap.to(b.anchor, { ...A.lead, duration: 0.9, ease: 'power2.inOut' })
  gsap.to(b, { face: 0, fly: 1, duration: 0.8, ease: 'power2.inOut' })
  gsap.to(b, { attach: 0, fly: 0, duration: 1.1, ease: 'power2.inOut', delay: dur * 0.62 })
  gsap.to(b, { face: 1, duration: 0.6, delay: dur * 0.7 })
  rig.bots.forEach((o) => gsap.to(o, { dim: 0, duration: 0.8, ease: 'sine.inOut', delay: dur * 0.6 }))

  runFlight(dur, () => {
    busy = false
    rig.camMode = 'hub'
    rig.phase = 'hub'
    b.face = 0
    useStore.setState({ phase: 'hub', agent: null, beat: 0 })
  })
}

// ---------- little reactions ----------

export function poke(id) {
  const i = AGENT_INDEX[id]
  const b = rig.bots[i]
  b.hop = rig.time
  const n = S().pokes + 1
  useStore.setState({ pokes: n })
  sound.chirp(agentById(id).voice.pitch, 3)
  if (n >= POKES.length) {
    b.spin = rig.time
    S().award('chatty')
  }
  S().setLine(POKES[Math.min(n, POKES.length) - 1])
}

export function waveAll() {
  rig.bots.forEach((b, k) => (b.wave = rig.time + k * 0.12))
  rig.wakeAll = rig.time
  sound.chirp(1.1, 5)
}

// The Relay fires: beam, shockwave, a little camera shake.
export function transmit() {
  sound.transmit()
  rig.cam.shake = 1
  gsap.killTweensOf(rig, 'beam')
  gsap.timeline().to(rig, { beam: 1, duration: 0.25, ease: 'power2.out' }).to(rig, { beam: 0, duration: 1.4, ease: 'power2.in' }, 1.4)
  S().award('transmit')
}

export function togglePartyMode() {
  rig.partyOn = !rig.partyOn
  if (rig.partyOn) {
    sound.party()
    waveAll()
    S().award('party')
    S().toast({ kind: 'note', title: 'Party protocol', text: 'Hats issued to all agents. Enter the code again to stand down.', ms: 5000 })
  }
}

export const isBusy = () => busy
