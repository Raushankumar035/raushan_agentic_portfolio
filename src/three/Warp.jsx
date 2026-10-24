// Speed streaks: short line segments wrapped around the camera, stretched by its velocity.
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from '../lib/rig'
import { rng } from '../lib/math'
import { warpFrag, warpVert } from './shaders'

const BOX = 180

export default function Warp() {
  const { geo, mat } = useMemo(() => {
    const N = rig.tier > 0 ? 1400 : 700
    const r = rng(9)
    const pos = new Float32Array(N * 6)
    const end = new Float32Array(N * 2)
    for (let i = 0; i < N; i++) {
      const x = r() * BOX
      const y = r() * BOX
      const z = r() * BOX
      pos.set([x, y, z, x, y, z], i * 6)
      end.set([0, 1], i * 2)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: warpVert,
      fragmentShader: warpFrag,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uVel: { value: new THREE.Vector3() },
        uBox: { value: BOX },
        uStretch: { value: 0.022 },
        uColor: { value: new THREE.Color('#cfe3ff').multiplyScalar(1.6) },
        uAlpha: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [])

  useFrame((state) => {
    const u = mat.uniforms
    u.uCam.value.copy(state.camera.position)
    u.uVel.value.copy(rig.camVel)
    u.uAlpha.value = rig.reduce ? 0 : rig.warp * 0.55
  })

  return <lineSegments geometry={geo} material={mat} frustumCulled={false} renderOrder={20} />
}
