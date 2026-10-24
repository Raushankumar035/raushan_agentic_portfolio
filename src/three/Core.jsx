// The Core: Raushan's portrait at the heart of the galaxy, ringed by the agents' orbits.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Line, useTexture } from '@react-three/drei'
import gsap from 'gsap'
import * as THREE from 'three'
import { RINGS, rig, orbitPoint } from '../lib/rig'
import { TAU } from '../lib/math'
import { useStore } from '../store'
import { sound } from '../lib/sound'
import { glowTexture } from './textures'
import { neonFrag, neonVert, portraitFrag, portraitVert } from './shaders'

// Square crop of the photo (u, v from the bottom-left, width, height in UV space).
// `grade` pulls a plain studio backdrop toward the galaxy's indigo; 0 leaves the photo untouched.
// The default portrait is a monogram placeholder: crop [0, 0, 1, 1] keeps all of it, grade 0 leaves it untouched.
// When you drop in a real photo, try crop [0.13, 0.19, 0.74, 0.74] and grade 0.8 (see README).
export const PORTRAIT = { src: '/portrait.webp', crop: [0, 0, 1, 1], grade: 0 }

const SEG = 320
const VIOLET = new THREE.Color('#8b5cf6')
const SKY = new THREE.Color('#7dd3fc')

function ringData(L, s, bright) {
  const pts = []
  const cols = []
  const dist = [0]
  for (let k = 0; k <= SEG; k++) {
    const a = (k / SEG) * TAU
    const p = orbitPoint(L, a, s)
    if (k) dist.push(dist[k - 1] + p.distanceTo(pts[k - 1]))
    pts.push(p)
    const side = Math.abs(Math.cos(a))
    const near = (Math.sin(a) + 1) / 2
    const c = new THREE.Color().lerpColors(SKY, VIOLET, Math.pow(side, 1.6))
    c.multiplyScalar(bright * (0.32 + 1.05 * Math.pow(near, 1.4)))
    cols.push(c)
  }
  return { pts, cols, dist, total: dist[SEG] }
}

const COMET = [
  { len: 0.012, k: 2.6, w: 2.4 },
  { len: 0.035, k: 1.1, w: 1.8 },
  { len: 0.09, k: 0.45, w: 1.3 },
]

function Orbits({ L }) {
  const rings = useMemo(() => RINGS.map((s, i) => ringData(L, s, [0.85, 1.25, 0.7][i])), [L])
  const comet = useMemo(() => ringData(L, 1, 1), [L])
  const lineRefs = useRef([])
  const cometRefs = useRef([])
  const head = useRef()
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: new THREE.Color('#bfe8ff').multiplyScalar(2.2),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )

  useFrame((state) => {
    const party = rig.party
    rings.forEach((r, i) => {
      const line = lineRefs.current[i]
      if (!line) return
      line.material.dashOffset = r.total * (1 - rig.intro.rings[i])
      if (party > 0.01) line.material.color.setHSL((state.clock.elapsedTime * 0.2 + i * 0.3) % 1, 0.9, 0.5 + 0.5 * (1 - party))
      else line.material.color.setRGB(1, 1, 1)
    })
    const T = comet.total
    const h = ((rig.reduce ? 0.3 : state.clock.elapsedTime / 11) % 1) * T
    cometRefs.current.forEach((line, k) => {
      if (!line) return
      line.material.dashOffset = COMET[k].len * T - h
      line.material.opacity = rig.intro.rings[1]
    })
    if (head.current) {
      let j = 1
      while (j < SEG && comet.dist[j] < h) j++
      const f = (h - comet.dist[j - 1]) / Math.max(1e-6, comet.dist[j] - comet.dist[j - 1])
      head.current.position.lerpVectors(comet.pts[j - 1], comet.pts[j], f)
      head.current.quaternion.copy(state.camera.quaternion)
      glowMat.opacity = rig.intro.rings[1]
    }
  })

  return (
    <group>
      {rings.map((r, i) => (
        <Line
          key={`r${i}`}
          ref={(el) => (lineRefs.current[i] = el)}
          points={r.pts}
          vertexColors={r.cols}
          lineWidth={i === 1 ? 1.5 : 1.15}
          dashed
          dashSize={r.total}
          gapSize={r.total}
          dashOffset={r.total}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      ))}
      {COMET.map((c, k) => (
        <Line
          key={`c${k}`}
          ref={(el) => (cometRefs.current[k] = el)}
          points={comet.pts}
          color={new THREE.Color('#d6f3ff').multiplyScalar(c.k)}
          lineWidth={c.w}
          dashed
          dashSize={c.len * comet.total}
          gapSize={(1 - c.len) * comet.total}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      ))}
      <mesh ref={head} material={glowMat} scale={0.55}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  )
}

function Portrait({ L }) {
  const tex = useTexture(PORTRAIT.src)
  const group = useRef()
  const clicks = useRef(0)
  const R = L.portraitR

  const mats = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    tex.needsUpdate = true
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
    const neonUniforms = (inner, outer, intensity) => ({
      uInner: { value: inner },
      uOuter: { value: outer },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uParty: { value: 0 },
      uA: { value: new THREE.Color('#a78bfa').multiplyScalar(1.4) },
      uB: { value: new THREE.Color('#6366f1').multiplyScalar(1.5) },
      uC: { value: new THREE.Color('#22d3ee').multiplyScalar(1.5) },
    })
    return {
      disc: new THREE.ShaderMaterial({
        vertexShader: portraitVert,
        fragmentShader: portraitFrag,
        uniforms: {
          uMap: { value: tex },
          uCrop: { value: new THREE.Vector4(...PORTRAIT.crop) },
          uTexel: { value: new THREE.Vector2(1 / tex.image.width, 1 / tex.image.height) },
          uSharpen: { value: 0.5 },
          uReveal: { value: 0 },
          uGlitch: { value: 0 },
          uTime: { value: 0 },
          uGrade: { value: PORTRAIT.grade ?? 0 },
        },
        transparent: true,
      }),
      neon: new THREE.ShaderMaterial({ vertexShader: neonVert, fragmentShader: neonFrag, uniforms: neonUniforms(R, R * 1.065, 2.8), ...additive }),
      haze: new THREE.ShaderMaterial({ vertexShader: neonVert, fragmentShader: neonFrag, uniforms: neonUniforms(R * 0.97, R * 1.22, 0.35), ...additive }),
      glow: new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: new THREE.Color('#5b5bf0').multiplyScalar(0.9),
        opacity: 0,
        toneMapped: false,
        ...additive,
      }),
      core: new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: new THREE.Color('#c7b8ff').multiplyScalar(3),
        opacity: 0,
        toneMapped: false,
        ...additive,
      }),
    }
  }, [tex, R])

  useFrame((state) => {
    const k = rig.intro.portrait
    group.current.scale.setScalar(0.72 + 0.28 * k)
    mats.disc.uniforms.uReveal.value = k
    const t = rig.reduce ? 0 : state.clock.elapsedTime
    mats.disc.uniforms.uTime.value = t
    for (const m of [mats.neon, mats.haze]) {
      m.uniforms.uProgress.value = rig.intro.portraitRing
      m.uniforms.uTime.value = t
      m.uniforms.uParty.value = rig.party
    }
    mats.glow.opacity = 0.55 * rig.intro.glow * (1 + 0.06 * Math.sin(t * 1.9))
    // from far away the Core reads as the galaxy's bright heart
    const far = THREE.MathUtils.smoothstep(state.camera.position.length(), 90, 520)
    mats.core.opacity = rig.intro.galaxy * far
  })

  const onClick = (e) => {
    e.stopPropagation()
    if (e.delta > 6 || rig.phase !== 'hub') return
    clicks.current++
    sound.pop()
    gsap.fromTo(mats.disc.uniforms.uGlitch, { value: 1 }, { value: 0, duration: 0.6, ease: 'power2.out' })
    if (clicks.current === 5) {
      useStore.getState().toast({
        kind: 'note',
        title: 'The Core',
        text: 'Hi, it’s Raushan. The agents do most of the talking around here. Pick one, they know the way.',
        ms: 7000,
      })
    }
  }

  return (
    <Billboard>
      <group ref={group}>
        <mesh material={mats.core} position={[0, 0, -0.6]} scale={R * 14} renderOrder={-11}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        <mesh material={mats.glow} position={[0, 0, -0.3]} scale={R * 5.2} renderOrder={-10}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        <mesh
          material={mats.disc}
          onClick={onClick}
          onPointerOver={() => rig.phase === 'hub' && (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <circleGeometry args={[R, 128]} />
        </mesh>
        <mesh material={mats.haze} position={[0, 0, 0.005]}>
          <ringGeometry args={[R * 0.96, R * 1.3, 192, 1]} />
        </mesh>
        <mesh material={mats.neon} position={[0, 0, 0.01]}>
          <ringGeometry args={[R * 0.98, R * 1.09, 192, 1]} />
        </mesh>
      </group>
    </Billboard>
  )
}

export default function Core() {
  const key = useStore((s) => s.layoutKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const L = useMemo(() => rig.L, [key])
  return (
    <group>
      <Portrait L={L} />
      <Orbits L={L} />
    </group>
  )
}
