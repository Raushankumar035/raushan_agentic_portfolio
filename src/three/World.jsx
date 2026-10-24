import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { AGENTS } from '../agents'
import { HUB_DIST, rig } from '../lib/rig'
import { smooth } from '../lib/math'
import { useStore } from '../store'
import Agent from './Agent'
import CameraRig from './CameraRig'
import Core from './Core'
import Effects from './Effects'
import Galaxy from './Galaxy'
import Sky from './Sky'
import Warp from './Warp'
import SkillsWorld from './worlds/SkillsWorld'
import ProjectsWorld from './worlds/ProjectsWorld'
import ExperienceWorld from './worlds/ExperienceWorld'
import JourneyWorld from './worlds/JourneyWorld'
import ConnectWorld from './worlds/ConnectWorld'
import Signal from './secrets/Signal'
import Agent404 from './secrets/Agent404'
import Comet from './secrets/Comet'

// Studio light panels baked into a PMREM environment once: the glossy shells and visor glass
// reflect these. Same idea as drei's <Lightformer>s without pulling in its HDR loaders.
const PANELS = [
  { color: '#ffffff', k: 2.4, pos: [0, 7, 3], scale: [12, 4, 1] },
  { color: '#dbe4ff', k: 1.4, pos: [-7, 3, 7], scale: [5, 9, 1] },
  { color: '#67e8f9', k: 3.2, pos: [8, 1, -5], scale: [3, 10, 1] },
  { color: '#a78bfa', k: 3.2, pos: [-8, 1, -5], scale: [3, 10, 1] },
  { color: '#ffffff', k: 2.2, pos: [2, 3, 9], scale: [2.4, 2.4, 1], ring: true },
  { color: '#3b4fd8', k: 0.6, pos: [0, -6, 0], scale: [14, 14, 1] },
]

function StudioEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useLayoutEffect(() => {
    const env = new THREE.Scene()
    const disposables = []
    PANELS.forEach((p) => {
      const geo = p.ring ? new THREE.RingGeometry(0.5, 1, 64) : new THREE.PlaneGeometry(1, 1)
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.k), side: THREE.DoubleSide, toneMapped: false })
      const m = new THREE.Mesh(geo, mat)
      m.position.set(...p.pos)
      m.scale.set(...p.scale)
      m.lookAt(0, 0, 0)
      env.add(m)
      disposables.push(geo, mat)
    })
    const pmrem = new THREE.PMREMGenerator(gl)
    const rt = pmrem.fromScene(env, 0.02)
    scene.environment = rt.texture
    return () => {
      scene.environment = null
      rt.dispose()
      pmrem.dispose()
      disposables.forEach((d) => d.dispose())
    }
  }, [gl, scene])
  return null
}

// A soft key light that rides with the camera, so the guide always reads well.
const KEY_OFF = new THREE.Vector3(-2, 3, 2)
const KEY_AIM = new THREE.Vector3(0, 0, -10)
const _k = new THREE.Vector3()
function CameraKey() {
  const light = useRef()
  const target = useRef()
  useLayoutEffect(() => {
    light.current.target = target.current
  }, [])
  useFrame((state) => {
    const c = state.camera
    light.current.position.copy(c.position).add(_k.copy(KEY_OFF).applyQuaternion(c.quaternion))
    target.current.position.copy(c.position).add(_k.copy(KEY_AIM).applyQuaternion(c.quaternion))
    target.current.updateMatrixWorld()
  })
  return (
    <>
      <directionalLight ref={light} intensity={0.9} color="#eef2ff" />
      <object3D ref={target} />
    </>
  )
}

function Lights() {
  return (
    <>
      <StudioEnvironment />
      <ambientLight intensity={0.06} />
      <directionalLight position={[-5, 7, 6]} intensity={1.6} color="#eef0ff" />
      <directionalLight position={[6, 2, -7]} intensity={1.3} color="#7dd3fc" />
      <directionalLight position={[-6, 1, -6]} intensity={1.1} color="#c4b5fd" />
      <pointLight position={[0, 0, 0]} intensity={2.2} decay={0} color="#e9e2ff" />
      <CameraKey />
    </>
  )
}

// Projects bots to the screen and moves their HTML cards; also anchors the guide's speech bubble.
const _v = new THREE.Vector3()
const _c = new THREE.Vector3()
const _r = new THREE.Vector3()
let lastFar = -1
let lastDrift = -1
function LabelTracker() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame(() => {
    const { width: w, height: h } = size
    const L = rig.L
    _c.set(0, 0, 0).project(camera)
    const cx = (_c.x * 0.5 + 0.5) * w
    const cy = (-_c.y * 0.5 + 0.5) * h
    _r.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(L.portraitR).project(camera)
    const rpx = Math.abs(_r.x - _c.x) * 0.5 * w
    const camDist = camera.position.length()
    const hubVis = rig.phase === 'hub' ? 1 - smooth(HUB_DIST * 1.5, HUB_DIST * 3, rig.hub.dist) : 0
    const st = useStore.getState()
    const far = rig.phase === 'hub' ? smooth(HUB_DIST * 1.6, HUB_DIST * 5, rig.hub.dist) : 0
    if (Math.abs(far - lastFar) > 0.004) {
      lastFar = far
      document.documentElement.style.setProperty('--far', far.toFixed(3))
    }
    // the title belongs to the default view: fade it while the visitor looks around
    const hb = rig.hub
    const azOff = Math.abs(Math.atan2(Math.sin(hb.az), Math.cos(hb.az)))
    const drift = Math.max(smooth(0.25, 0.7, azOff), smooth(0.12, 0.4, Math.abs(hb.el - L.elev)), smooth(0.95, 0.8, hb.dist / HUB_DIST))
    if (Math.abs(drift - lastDrift) > 0.004) {
      lastDrift = drift
      document.documentElement.style.setProperty('--drift', drift.toFixed(3))
    }

    AGENTS.forEach((a, i) => {
      const p = rig.world[i]
      const d = camera.position.distanceTo(p)
      _v.copy(p).project(camera)
      const sc = rig.screen[i]
      sc.x = (_v.x * 0.5 + 0.5) * w
      sc.y = (-_v.y * 0.5 + 0.5) * h
      const el = rig.cards[i]
      if (!el) return
      const scale = Math.min(1.1, Math.max(0.74, (camDist / d) ** 1.8))
      _v.copy(p)
      _v.y -= 0.72 * L.robotScale
      _v.project(camera)
      const x = (_v.x * 0.5 + 0.5) * w
      const y = (-_v.y * 0.5 + 0.5) * h
      const behind = d > camDist
      const off = Math.hypot(x - cx, y + 18 - cy)
      const occ = behind ? Math.min(1, Math.max(0, (off - rpx * 1.02) / (rpx * 0.3))) : 1
      const vis = hubVis * occ * (1 - rig.bots[i].attach) * rig.bots[i].enter
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,0) scale(${scale.toFixed(3)})`
      el.style.setProperty('--occ', vis.toFixed(3))
      el.style.visibility = vis < 0.02 ? 'hidden' : 'visible'
      el.style.zIndex = String(Math.round(1000 - d * 10))
    })

    // the guide's head, for the speech bubble
    if (st.agent && rig.narratorEl) {
      const i = AGENTS.findIndex((a) => a.id === st.agent)
      const sc = rig.screen[i]
      rig.narratorEl.style.setProperty('--gx', `${sc.x.toFixed(1)}px`)
      rig.narratorEl.style.setProperty('--gy', `${sc.y.toFixed(1)}px`)
    }
  })
  return null
}

// Compiles every shader up front, then tells the app it can lift the curtain.
function Ready({ onReady }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let id = 0
    const go = async () => {
      try {
        if (gl.compileAsync) await gl.compileAsync(scene, camera)
        else gl.compile(scene, camera)
      } catch {
        gl.compile(scene, camera)
      }
      id = setTimeout(onReady, 60)
    }
    go()
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

const HUB_SIGNAL = [0, -2.4, -9.5]

export default function World({ msaa, onReady }) {
  return (
    <>
      <CameraRig />
      <Lights />
      <Sky />
      <Galaxy />
      <Warp />
      <Suspense fallback={null}>
        <Core />
        {AGENTS.map((a, i) => (
          <Agent key={a.id} agent={a} index={i} />
        ))}
        <SkillsWorld />
        <ProjectsWorld />
        <ExperienceWorld />
        <JourneyWorld />
        <ConnectWorld />
        <Agent404 />
        <Comet />
        <Signal where="hub" position={HUB_SIGNAL} size={1.4} color="#c7d2fe" />
        <LabelTracker />
        <Ready onReady={onReady} />
      </Suspense>
      <Effects msaa={msaa} />
    </>
  )
}
