import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOB_PERIODS, SLOTS, orbitPoint, rig } from '../lib/rig'
import { TAU, clamp, damp } from '../lib/math'
import { useStore } from '../store'
import { openAgent, poke } from '../lib/director'
import { sound } from '../lib/sound'
import { DEG, GESTURE_SECONDS, HABITS, RIGS, VISOR_R, VISOR_Z, bellp, gestureOffsets, robotGeometry, robotMaterials } from './robot'

const _hub = new THREE.Vector3()
const _att = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _qHub = new THREE.Quaternion()
const _qAtt = new THREE.Quaternion()
const _qe = new THREE.Quaternion()
const _e = new THREE.Euler(0, 0, 0, 'YXZ')

const follow = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt))

function seeded(seed) {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const Arm = ({ side, raise, fwd, mat, armRef, g }) => (
  <group ref={armRef} position={[side * 0.27, 0.03, 0]} rotation={[fwd * DEG, 0, side * raise * DEG]}>
    <mesh geometry={g.arm} material={mat} />
    <mesh geometry={g.hand} material={mat} position={[0, -0.34, 0]} />
  </group>
)

export default function Agent({ agent, index }) {
  const g = robotGeometry()
  const rgf = RIGS[agent.id]
  const m = useMemo(() => robotMaterials(agent), [agent])
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
  const hat = useRef()
  const flames = useRef()
  const pad = useRef()
  const lastDim = useRef(-1)

  const life = useRef(null)
  if (!life.current) {
    const r = seeded(index + 11)
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
      seen: { wave: 0, hop: 0, spin: 0 },
      talk: 0,
    }
  }
  const o = useMemo(() => ({}), [])
  const waveSide = rgf.arms[1] >= rgf.arms[0] ? 1 : -1
  const [rl, rr, fl, fr] = rgf.arms

  const start = (lf, type, t) => {
    lf.gesture = { type, t0: t, dur: GESTURE_SECONDS[type] }
  }

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05)
    const b = rig.bots[index]
    const lf = life.current
    const t = state.clock.elapsedTime
    const L = rig.L
    const calm = rig.reduce
    const st = useStore.getState()
    const mine = st.agent === agent.id
    const inHub = rig.phase === 'hub' || rig.phase === 'intro'
    const att = b.attach * b.attach * (3 - 2 * b.attach)

    // Off-stage bots skip all work while a chapter plays elsewhere.
    const show = b.enter > 0.001 && (inHub || mine || att > 0.001 || b.dim < 0.98 || rig.phase === 'travel')
    root.current.visible = show
    if (!show) return

    // ---- hover comes from the 3D hit area or the HTML card ----
    const hoverOn = inHub && st.hovered === agent.id ? 1 : 0
    b.hover = follow(b.hover, hoverOn, hoverOn ? 8 : 5, dt)

    // ---- reactions ----
    if (!calm && b.enter > 0.98) {
      if (b.hover > 0.5 && lf.wasHover <= 0.5 && inHub) {
        start(lf, 'wave', t)
        lf.happy = 1
      }
      if (b.burst > 0.02 && lf.wasBurst <= 0.02) start(lf, 'celebrate', t)
      for (const k of ['wave', 'hop', 'spin']) {
        if (b[k] > lf.seen[k] && t >= b[k]) {
          lf.seen[k] = b[k]
          start(lf, k, t)
          lf.happy = 1
        }
      }
      if (!lf.gesture && t > lf.nextGesture && b.hover < 0.1 && (inHub || mine) && b.fly < 0.1) {
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
        lf.nextGesture = t + (mine ? 7 : 5) + lf.r() * 7
      } else gestureOffsets(lf.gesture.type, p, o)
    }
    lf.happy = follow(lf.happy, 0, 2.2, dt)

    const cam = state.camera
    const e = b.enter

    // ---- hub placement: orbiting the Core ----
    const s = L.robotScale
    const ang = rig.orbit.base + SLOTS[index]
    orbitPoint(L, ang, 1, _hub)
    _hub.y += 0.28 * s
    const bob = calm ? 0 : Math.sin((t * TAU) / BOB_PERIODS[index]) * 0.05 * s
    _hub.y += bob + (b.hover * 0.1 + (o.y || 0)) * s
    const toCam = Math.atan2(cam.position.x - _hub.x, cam.position.z - _hub.z)
    const elev = Math.atan2(cam.position.y - _hub.y, Math.hypot(cam.position.x - _hub.x, cam.position.z - _hub.z))
    _e.set(
      rgf.pitch * (1 - 0.6 * b.hover) - elev * 0.85 - (1 - e) * 1.25,
      toCam + rgf.yaw * (1 - 0.7 * b.hover) + (1 - e) * 1.0,
      rgf.roll * (1 - b.hover) + (o.tilt || 0) * -waveSide,
    )
    _qHub.setFromEuler(_e)

    // ---- attached placement: riding along in camera space ----
    if (att > 0.001) {
      _fwd.set(0, 0, -1).applyQuaternion(cam.quaternion)
      _right.set(1, 0, 0).applyQuaternion(cam.quaternion)
      _up.set(0, 1, 0).applyQuaternion(cam.quaternion)
      const z = b.anchor.z
      const halfH = z * Math.tan((cam.fov * DEG) / 2)
      const halfW = halfH * cam.aspect
      _att
        .copy(cam.position)
        .addScaledVector(_fwd, z)
        .addScaledVector(_right, b.anchor.x * halfW)
        .addScaledVector(_up, b.anchor.y * halfH + (calm ? 0 : Math.sin(t * 1.7 + index) * 0.06) + (o.y || 0) * b.scale)
      // narrator turns a little toward the content; a flyer faces where we're going
      const presentYaw = L.narrow ? 0.25 : 0.42
      const yaw = Math.PI * (1 - b.face) + presentYaw * b.face + (o.spin ? 0 : 0)
      const wob = calm ? 0 : Math.sin(t * 2.3 + index) * 0.08 * b.fly
      _e.set(b.fly * 1.15 + (1 - b.fly) * 0.04, yaw, wob + (o.tilt || 0) * -waveSide * (1 - b.fly))
      _qe.setFromEuler(_e)
      _qAtt.copy(cam.quaternion).multiply(_qe)
      root.current.position.lerpVectors(_hub, _att, att)
      root.current.quaternion.slerpQuaternions(_qHub, _qAtt, att)
    } else {
      root.current.position.copy(_hub)
      root.current.quaternion.copy(_qHub)
    }
    rig.world[index].copy(root.current.position)

    const scaleHub = s * (1 + 0.12 * b.hover)
    const sc = scaleHub + (b.scale - scaleHub) * att
    root.current.scale.setScalar(Math.max(0.0001, sc * e * b.press))

    // ---- gaze ----
    const me = rig.screen[index]
    const ptr = rig.pointer
    const ptrLive = ptr.active && performance.now() - ptr.at < 4000
    let ty = 0
    let tp = 0
    if (b.fly > 0.5) {
      ty = Math.sin(t * 0.8) * 0.15
      tp = -0.25
    } else {
      const hot = inHub ? rig.bots.findIndex((x, j) => j !== index && x.hover > 0.5) : -1
      const target = hot >= 0 ? rig.screen[hot] : ptrLive ? ptr : null
      if (target) {
        const dx = target.x - me.x
        const dy = target.y - me.y
        const w = target === ptr ? clamp(1.25 - Math.hypot(dx, dy) / 700, 0.35, 1) : 0.85
        ty = clamp(dx / 320, -1, 1) * 0.7 * w
        tp = clamp(dy / 320, -1, 1) * 0.38 * w
        // the narrator already faces right; cancel that out of the head turn
        if (att > 0.5 && b.face > 0.5) ty -= L.narrow ? 0.2 : 0.35
      } else if (!calm) {
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
    const breath = calm ? 0 : Math.sin(t * 1.9 + index) * 0.012
    const sq = o.squash || 0
    body.current.scale.set(1 - sq * 0.6, 1 + sq, 1 - sq * 0.6)
    torso.current.scale.set(1, 0.95 * (1 + breath), 0.88 * (1 - breath * 0.5))

    // eyes: drift, blink, and pulse while speaking
    if (!calm && t > lf.nextBlink) {
      lf.blinkAt = t
      lf.nextBlink = t + (lf.r() < 0.2 ? 0.25 : 2.2 + lf.r() * 3.8)
    }
    lf.talk = Math.max(lf.talk * Math.exp(-9 * dt), b.talk)
    b.talk *= Math.exp(-6 * dt)
    const blink = lf.blinkAt >= 0 ? clamp(1 - bellp((t - lf.blinkAt) / 0.16), 0.08, 1) : 1
    const joy = 1 + 0.18 * bellp(1 - lf.happy) * (lf.happy > 0.01 ? 1 : 0)
    icon.current.position.set(lf.yaw * 0.07, 0.02 - lf.pitch * 0.07, 0.555)
    icon.current.scale.set(joy * (1 + lf.talk * 0.12), blink * joy * (1 + lf.talk * 0.3), 1)
    m.icon.color.copy(m.iconBase).multiplyScalar((1 + lf.talk * 0.9) * (1 - 0.62 * b.dim))

    // antenna: a damped spring kicked by head turns and hops
    if (knob.current) {
      const kn = lf.knob
      const yawVel = (lf.yaw - lf.prevYaw) / Math.max(dt, 1e-3)
      kn.v += (-70 * kn.a - 7 * kn.v) * dt - yawVel * 0.9 * dt * 10 - (o.squash || 0) * 4 * dt * 10 + b.fly * Math.sin(t * 9) * dt * 6
      kn.a = clamp(kn.a + kn.v * dt, -0.6, 0.6)
      knob.current.rotation.z = kn.a
      knob.current.rotation.x = -b.fly * 0.5
    }
    lf.prevYaw = lf.yaw

    // arms: idle sway, the wave, arms up on a hop, swept back in flight
    const sway = calm ? 0 : Math.sin(t * 1.3 + index * 2) * 4
    const up = (o.arms || 0) * 50
    const wv = o.wave || 0
    const waveAngle = 150 + Math.sin(t * 13) * 22
    const flyArms = b.fly
    let raiseL = rl + sway + up + (waveSide < 0 ? (waveAngle - rl) * wv : 0)
    let raiseR = rr - sway + up + (waveSide > 0 ? (waveAngle - rr) * wv : 0)
    raiseL += (18 - raiseL) * flyArms
    raiseR += (18 - raiseR) * flyArms
    armL.current.rotation.set((fl + (-70 - fl) * flyArms) * DEG, 0, -raiseL * DEG)
    armR.current.rotation.set((fr + (-70 - fr) * flyArms) * DEG, 0, raiseR * DEG)

    // ---- props ----
    const pr = b.props
    const spread = 1 + 0.2 * b.hover
    const panelK = pr * (1 - att)
    rgf.panels.forEach((pd, k) => {
      const el = panelRefs.current[k]
      if (!el) return
      const fl2 = calm ? 0 : Math.sin(t * (1.1 + k * 0.23) + index * 1.7 + k) * 0.035
      el.position.set(pd.pos[0] * spread, pd.pos[1] + fl2 + b.hover * 0.05, pd.pos[2])
      el.rotation.set(pd.rot[0] + lf.pitch * 0.2, pd.rot[1] + lf.yaw * 0.25, pd.rot[2])
      el.scale.setScalar(Math.max(0.0001, pd.w * (0.3 + 0.7 * panelK)))
      el.material.opacity = 0.9 * panelK
      el.visible = panelK > 0.01
    })
    if (pad.current) pad.current.visible = att < 0.6
    if (halo.current) {
      halo.current.position.y = 1.24 + (calm ? 0 : Math.sin(t * 1.6 + index) * 0.03) + (o.y || 0) * 0.3
      halo.current.rotation.z = Math.sin(t * 0.7) * 0.12 + lf.yaw * 0.3
      halo.current.scale.setScalar(Math.max(0.0001, pr))
    }
    if (disc.current) {
      disc.current.rotation.set(1.32 + Math.sin(t * 0.9) * 0.06, 0, calm ? 0 : t * (0.25 + b.hover * 1.2))
      disc.current.scale.setScalar(Math.max(0.0001, (0.6 + 0.4 * pr) * spread * (1 - 0.35 * att)))
      disc.current.visible = pr > 0.01
    }
    heartRefs.current.forEach((h, k) => {
      if (!h) return
      const ph = calm ? 0.4 : (t * (0.32 + b.hover * 0.4) + k * 0.33) % 1
      h.position.set([-0.55, 0.6, 0.78][k] * spread, 0.95 + ph * 0.55, 0.1)
      h.rotation.y = Math.sin(t * 1.4 + k) * 0.5
      h.scale.setScalar(Math.max(0.0001, (0.7 + 0.5 * Math.sin(ph * Math.PI)) * pr))
      h.material.opacity = Math.sin(ph * Math.PI) * pr
    })
    if (hat.current) {
      const p = rig.party
      hat.current.visible = p > 0.01
      hat.current.scale.setScalar(Math.max(0.0001, p))
    }
    if (flames.current) {
      flames.current.visible = b.fly > 0.05
      m.flame.opacity = b.fly * (0.7 + 0.3 * Math.sin(t * 40 + index))
      flames.current.scale.set(1, 0.7 + 0.5 * b.fly + 0.15 * Math.sin(t * 31), 1)
    }

    if (burst.current) {
      burst.current.visible = b.burst > 0.001 && b.burst < 0.999
      burst.current.scale.setScalar(0.4 + b.burst * 2.4)
      m.burst.opacity = 0.8 * (1 - b.burst)
      burst.current.quaternion.copy(root.current.quaternion).invert().multiply(cam.quaternion)
    }
    if (glow.current) {
      glow.current.quaternion.copy(root.current.quaternion).invert().multiply(cam.quaternion)
      m.glow.opacity = (0.22 + 0.2 * b.hover) * (1 - 0.6 * b.dim) * (1 - 0.45 * att)
    }
    m.rim.uniforms.uStrength.value = (1 + b.hover * 0.9) * (1 - 0.7 * b.dim)

    const beat = calm
      ? 0.3
      : Math.pow(Math.max(0, Math.sin(t * 2.4 + index)), 12) + 0.5 * Math.pow(Math.max(0, Math.sin(t * 2.4 + index - 0.5)), 12)
    m.pulse.color.copy(m.pulseBase).multiplyScalar((0.75 + 0.6 * beat + 0.5 * b.hover + lf.talk * 0.6) * (1 - 0.62 * b.dim))

    if (lastDim.current !== b.dim) {
      lastDim.current = b.dim
      const k = 1 - 0.62 * b.dim
      m.dimmable.forEach((d) => {
        if (d.m === m.icon) return
        d.m.color.copy(d.color).multiplyScalar(k)
        if (d.emissive) d.m.emissive.copy(d.emissive).multiplyScalar(k)
      })
    }
  })

  const onOver = (e) => {
    e.stopPropagation()
    if (rig.phase !== 'hub') return
    if (useStore.getState().hovered !== agent.id) sound.tick()
    useStore.setState({ hovered: agent.id })
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    if (useStore.getState().hovered === agent.id) useStore.setState({ hovered: null })
    document.body.style.cursor = ''
  }
  const onClick = (e) => {
    e.stopPropagation()
    if (e.delta > 6) return
    const st = useStore.getState()
    if (rig.phase === 'hub') openAgent(agent.id)
    else if (st.phase === 'chapter' && st.agent === agent.id) poke(agent.id)
  }

  return (
    <group ref={root} visible={false}>
      <mesh ref={glow} geometry={g.sprite} material={m.glow} position={[0, 0.25, -0.6]} scale={3.2} renderOrder={-1} />
      <group ref={pad} position={[0, -0.74, 0]}>
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
            <group ref={flames} visible={false}>
              {[-1, 1].map((sd) => (
                <mesh key={sd} geometry={g.flame} material={m.flame} position={[sd * 0.14, -0.92, 0.02]} rotation={[Math.PI, 0, 0]} />
              ))}
            </group>
            <Arm g={g} side={-1} raise={rl} fwd={fl} mat={m.accent} armRef={armL} />
            <Arm g={g} side={1} raise={rr} fwd={fr} mat={m.accent} armRef={armR} />

            <mesh ref={torso} geometry={g.body} material={m.shell} position={[0, -0.12, 0]} scale={[1, 0.95, 0.88]} />
            <group position={[0, -0.08, 0.288]} rotation={[-0.2, 0, 0]}>
              <mesh geometry={g.chestCore} material={m.glass} />
              <mesh geometry={g.chestRing} material={m.pulse} />
            </group>

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
                  {rgf.knob && (
                    <group position={[0, 0.48, 0]}>
                      <group ref={knob}>
                        <mesh geometry={g.stem} material={m.accent} position={[0, 0.04, 0]} />
                        <mesh geometry={g.knob} material={m.shell} position={[0, 0.12, 0]} />
                      </group>
                    </group>
                  )}
                  <group ref={hat} position={[0.16, 0.42, 0]} rotation={[0, 0, -0.32]} visible={false}>
                    <mesh geometry={g.hat} material={m.hat} />
                    <mesh geometry={g.pom} material={m.pom} position={[0, 0.47, 0]} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      <group>
        {rgf.panels.map((pd, k) => (
          <mesh key={pd.kind} ref={(el) => (panelRefs.current[k] = el)} geometry={g.panel} material={m.panels[pd.kind]} rotation={pd.rot} renderOrder={2} />
        ))}
        {rgf.halo && <mesh ref={halo} geometry={g.halo} material={m.neon} rotation={[1.36, 0, 0]} />}
        {rgf.disc && <mesh ref={disc} geometry={g.disc} material={m.neon} position={[0, -0.1, 0]} />}
        {rgf.hearts && [0, 1, 2].map((k) => <mesh key={k} ref={(el) => (heartRefs.current[k] = el)} geometry={g.heart} material={m.hearts[k]} />)}
      </group>

      <mesh ref={burst} geometry={g.burst} material={m.burst} position={[0, 0.3, 0]} visible={false} />

      <mesh geometry={g.hit} position={[0, 0.25, 0]} scale={[1.15, 1.2, 1]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}
