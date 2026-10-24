// The far sky: a nebula baked once into a cube map, plus a twinkling star field that
// rides with the camera so it always reads as infinitely far away.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from '../lib/rig'
import { rng } from '../lib/math'
import { skyFrag, skyVert, starsFrag, starsVert } from './shaders'
import { GALAXY_NORMAL } from './Galaxy'

function Nebula() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useLayoutEffect(() => {
    const rt = new THREE.WebGLCubeRenderTarget(rig.tier > 0 ? 768 : 512, { type: THREE.HalfFloatType, generateMipmaps: false })
    const cubeCam = new THREE.CubeCamera(0.5, 20, rt)
    const s = new THREE.Scene()
    const mat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: { uBand: { value: GALAXY_NORMAL.clone() } },
      side: THREE.BackSide,
      depthWrite: false,
    })
    const geo = new THREE.SphereGeometry(10, 64, 32)
    s.add(new THREE.Mesh(geo, mat))
    cubeCam.update(gl, s)
    scene.background = rt.texture
    scene.backgroundIntensity = 0
    return () => {
      scene.background = null
      rt.dispose()
      geo.dispose()
      mat.dispose()
    }
  }, [gl, scene])
  useFrame(() => {
    scene.backgroundIntensity = 0.85 * rig.intro.stars
  })
  return null
}

const TINTS = [
  [1, 1, 1],
  [0.78, 0.86, 1],
  [0.86, 0.8, 1],
  [1, 0.92, 0.84],
]

function FarStars() {
  const dpr = useThree((s) => s.viewport.dpr)
  const ref = useRef()
  const { geo, mat } = useMemo(() => {
    const rnd = rng(7)
    const count = rig.tier > 0 ? 3400 : 1800
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const seed = new Float32Array(count)
    const color = new Float32Array(count * 3)
    const v = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1)
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) {
        i--
        continue
      }
      v.normalize().multiplyScalar(1800)
      pos.set([v.x, v.y, v.z], i * 3)
      const big = rnd() > 0.993
      size[i] = big ? 5 + rnd() * 2.5 : 0.8 + Math.pow(rnd(), 3) * 2.2
      seed[i] = rnd()
      const tint = TINTS[Math.floor(rnd() * TINTS.length)]
      const lum = big ? 2 + rnd() * 1.6 : 0.22 + Math.pow(rnd(), 2) * 0.9
      color.set(tint.map((c) => c * lum), i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    const mat = new THREE.ShaderMaterial({
      vertexShader: starsVert,
      fragmentShader: starsFrag,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uIntensity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [])
  useFrame((state) => {
    ref.current.position.copy(state.camera.position)
    mat.uniforms.uTime.value = rig.reduce ? 0 : state.clock.elapsedTime
    mat.uniforms.uPixel.value = dpr
    mat.uniforms.uIntensity.value = rig.intro.stars
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={-900} />
}

export default function Sky() {
  return (
    <>
      <Nebula />
      <FarStars />
    </>
  )
}
