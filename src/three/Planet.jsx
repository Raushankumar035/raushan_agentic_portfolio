// A home world: surface baked once by a shader into equirect maps, then lit by the Core.
import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from '../lib/rig'
import { atmoFrag, atmoVert, bakeFrag, bakeVert, planetFrag, planetVert, ringFrag, ringVert } from './shaders'

const SUN = new THREE.Vector3(0, 0, 0)

// Bake albedo + emissive for one planet. Cached per agent id.
const bakes = new Map()
export function bakePlanet(gl, id, world) {
  if (bakes.has(id)) return bakes.get(id)
  const W = rig.tier > 0 ? 1024 : 512
  const make = () =>
    new THREE.WebGLRenderTarget(W, W / 2, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
    })
  const albedo = make()
  const emissive = make()
  const [c0, c1, c2, c3] = world.colors.map((h) => new THREE.Color(h))
  const mat = new THREE.ShaderMaterial({
    vertexShader: bakeVert,
    fragmentShader: bakeFrag,
    uniforms: {
      uStyle: { value: world.style },
      uMode: { value: 0 },
      uC0: { value: c0 },
      uC1: { value: c1 },
      uC2: { value: c2 },
      uC3: { value: c3 },
      uSeed: { value: world.style * 3.7 + 1.3 },
      uHeart: { value: new THREE.Vector3(...(world.heart || [0.55, 0.35, 0.76])) },
    },
    depthTest: false,
    depthWrite: false,
  })
  const scene = new THREE.Scene()
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  scene.add(quad)
  const cam = new THREE.OrthographicCamera()
  const prev = gl.getRenderTarget()
  gl.setRenderTarget(albedo)
  gl.render(scene, cam)
  mat.uniforms.uMode.value = 1
  gl.setRenderTarget(emissive)
  gl.render(scene, cam)
  gl.setRenderTarget(prev)
  quad.geometry.dispose()
  mat.dispose()
  const out = { albedo: albedo.texture, emissive: emissive.texture }
  bakes.set(id, out)
  return out
}

export function planetMaterial(maps, world, { spec = 0, emit = 1 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: planetVert,
    fragmentShader: planetFrag,
    uniforms: {
      uMap: { value: maps.albedo },
      uEmit: { value: maps.emissive },
      uSun: { value: SUN },
      uAtmo: { value: new THREE.Color(world.atmosphere).multiplyScalar(0.9) },
      uSpec: { value: spec },
      uEmitK: { value: emit },
      uFade: { value: 1 },
    },
  })
}

export function atmosphereMaterial(color, strength = 1) {
  return new THREE.ShaderMaterial({
    vertexShader: atmoVert,
    fragmentShader: atmoFrag,
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(1.6) }, uSun: { value: SUN }, uStrength: { value: strength } },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

const SPEC = [0.15, 0.9, 0.05, 0.45, 0.1]

const Planet = forwardRef(function Planet({ id, world, children }, ref) {
  const gl = useThree((s) => s.gl)
  const spinRef = useRef()
  const maps = useMemo(() => bakePlanet(gl, id, world), [gl, id, world])
  const mat = useMemo(() => planetMaterial(maps, world, { spec: SPEC[world.style] }), [maps, world])
  const atmo = useMemo(() => atmosphereMaterial(world.atmosphere, 1), [world])
  const ring = useMemo(() => {
    if (!world.ring) return null
    const R = world.radius
    return new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      uniforms: {
        uInner: { value: R * 1.35 },
        uOuter: { value: R * 2.35 },
        uColor: { value: new THREE.Color(world.colors[3]).multiplyScalar(0.9) },
        uColor2: { value: new THREE.Color(world.colors[2]).multiplyScalar(0.7) },
        uSun: { value: SUN },
        uCenter: { value: new THREE.Vector3(...world.pos) },
        uPlanetR: { value: R },
        uFade: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  }, [world])

  useLayoutEffect(() => () => {
    mat.dispose()
    atmo.dispose()
    ring?.dispose()
  }, [mat, atmo, ring])

  useFrame((_, dt) => {
    if (!rig.reduce && spinRef.current) spinRef.current.rotation.y += dt * world.spin
  })

  const R = world.radius
  return (
    <group ref={ref} position={world.pos}>
      <group rotation={[world.tilt, 0, world.tilt * 0.4]}>
        <group ref={spinRef}>
          <mesh material={mat}>
            <sphereGeometry args={[R, 96, 64]} />
          </mesh>
        </group>
        <mesh material={atmo} scale={1.14}>
          <sphereGeometry args={[R, 64, 40]} />
        </mesh>
        {ring && (
          <mesh material={ring} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[R * 1.35, R * 2.35, 256, 1]} />
          </mesh>
        )}
      </group>
      {children}
    </group>
  )
})

export default Planet
