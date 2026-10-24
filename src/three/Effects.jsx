// Post: bloom does the neon glow, a touch of chromatic aberration only at warp speed.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { rig } from '../lib/rig'

export default function Effects({ msaa }) {
  const ca = useRef()
  const offset = useMemo(() => new THREE.Vector2(0, 0), [])
  useFrame(() => {
    const e = ca.current
    if (!e) return
    const k = rig.reduce ? 0 : rig.warp * 0.0011
    e.offset.set(k, k * 0.6)
  })
  return (
    <EffectComposer multisampling={msaa} frameBufferType={THREE.HalfFloatType}>
      <Bloom mipmapBlur luminanceThreshold={0.8} luminanceSmoothing={0.24} intensity={1.1} radius={0.72} levels={rig.tier > 0 ? 8 : 6} />
      <ChromaticAberration ref={ca} offset={offset} radialModulation modulationOffset={0.25} />
      <Vignette offset={0.26} darkness={0.7} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}
