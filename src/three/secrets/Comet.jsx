// A comet crosses the hub sky now and then. Catch it.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from '../../lib/rig'
import { useStore } from '../../store'
import { sound } from '../../lib/sound'
import { glowTexture } from '../textures'

const SPARKS = 60
const TAIL_LEN = 34

// Soft streak: bright at the head (u = 1), fading to nothing, round across its width.
function tailTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 32
  const g = c.getContext('2d')
  const img = g.createImageData(256, 32)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 256; x++) {
      const u = x / 255
      const v = Math.abs(y / 31 - 0.5) * 2
      const across = Math.exp(-v * v * (3 + 9 * u))
      const along = Math.pow(u, 2.2)
      const a = Math.round(255 * along * across)
      const i = (y * 256 + x) * 4
      img.data.set([255, 255, 255, a], i)
    }
  }
  g.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(c)
}

const _mid = new THREE.Vector3()
const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _z = new THREE.Vector3()
const _m = new THREE.Matrix4()

export default function Comet() {
  const head = useRef()
  const tail = useRef()
  const sparks = useRef()
  const st = useRef({ on: false, t: 0, dur: 8, next: 16 + Math.random() * 10, from: new THREE.Vector3(), to: new THREE.Vector3(), boom: -1, boomAt: new THREE.Vector3() })
  const mats = useMemo(() => {
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }
    return {
      head: new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#e0f2ff').multiplyScalar(4), ...additive }),
      tail: new THREE.MeshBasicMaterial({ map: tailTexture(), color: new THREE.Color('#bfe3ff').multiplyScalar(2.2), side: THREE.DoubleSide, ...additive }),
      sparks: new THREE.PointsMaterial({ map: glowTexture(), size: 1.6, sizeAttenuation: true, color: new THREE.Color('#fde68a').multiplyScalar(3), ...additive, opacity: 0 }),
    }
  }, [])
  const spark = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    const v = []
    for (let k = 0; k < SPARKS; k++) v.push(new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 14))
    return { g, v }
  }, [])

  useFrame((state, dt) => {
    const s = st.current
    const t = state.clock.elapsedTime
    const cam = state.camera
    const hub = rig.phase === 'hub'
    if (!s.on && hub && t > s.next) {
      // pick the path in screen space so it always crosses the visible sky, high above the title
      const dir = Math.random() < 0.5 ? 1 : -1
      const at = (x, y, out) => out.set(x, y, 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(160).add(cam.position)
      at(-dir * 1.35, 0.78 + Math.random() * 0.14, s.from)
      at(dir * 1.35, 0.58 + Math.random() * 0.16, s.to)
      s.on = true
      s.t = 0
      s.dur = 7 + Math.random() * 3
    }
    head.current.visible = s.on
    tail.current.visible = s.on
    if (s.on) {
      s.t += dt / s.dur
      if (s.t >= 1 || !hub) {
        s.on = false
        s.next = t + 24 + Math.random() * 22
      }
      const p = head.current.position.lerpVectors(s.from, s.to, s.t)
      head.current.scale.setScalar(5 + Math.sin(t * 20) * 0.4)
      // a camera-facing streak from the head back along the path
      _x.copy(s.to).sub(s.from).normalize()
      _mid.copy(p).addScaledVector(_x, -TAIL_LEN / 2)
      _z.copy(cam.position).sub(_mid).normalize()
      _y.crossVectors(_z, _x).normalize()
      _z.crossVectors(_x, _y)
      _m.makeBasis(_x, _y, _z)
      tail.current.quaternion.setFromRotationMatrix(_m)
      tail.current.position.copy(_mid)
      tail.current.scale.set(TAIL_LEN, 2.6, 1)
    }
    // the burst when caught
    if (s.boom >= 0) {
      s.boom += dt
      const k = s.boom / 1.4
      const arr = spark.g.attributes.position.array
      spark.v.forEach((v, i) => {
        arr[i * 3] = s.boomAt.x + v.x * k
        arr[i * 3 + 1] = s.boomAt.y + v.y * k - 4 * k * k
        arr[i * 3 + 2] = s.boomAt.z + v.z * k
      })
      spark.g.attributes.position.needsUpdate = true
      mats.sparks.opacity = Math.max(0, 1 - k)
      sparks.current.visible = k < 1
      if (k >= 1) s.boom = -1
    }
  })

  const onClick = (e) => {
    e.stopPropagation()
    const s = st.current
    if (!s.on) return
    s.boomAt.copy(head.current.position)
    s.boom = 0
    s.on = false
    s.next = rig.time + 30
    sound.collect()
    const st0 = useStore.getState()
    st0.toast({ kind: 'note', title: 'Wish granted', text: 'Well, logged. It’s a comet, not a product manager.', ms: 5000 })
    st0.award('wish')
  }

  return (
    <group>
      <sprite ref={head} material={mats.head} visible={false} onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')} />
      <mesh ref={tail} material={mats.tail} visible={false} frustumCulled={false} onClick={onClick}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <points ref={sparks} geometry={spark.g} material={mats.sparks} visible={false} frustumCulled={false} />
    </group>
  )
}
