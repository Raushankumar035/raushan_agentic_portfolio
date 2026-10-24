import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, advance } from '@react-three/fiber'
import gsap from 'gsap'
import { PerformanceMonitor } from '@react-three/drei'
import { AGENTS } from './agents'
import { IDLE_HINTS } from './content/secrets'
import { layout, rig } from './lib/rig'
import { reducedMotion } from './lib/math'
import { prepareIntro, startIntro } from './lib/director'
import { consoleHello, installKeys } from './lib/keys'
import { sound } from './lib/sound'
import { loadHealth, loadVoices, voiceLangs } from './lib/api'
import { useStore } from './store'
import World from './three/World'
import Hub from './ui/Hub'
import Chapter from './ui/Chapter'
import Hud from './ui/Hud'
import Toasts from './ui/Toasts'
import CommandBar from './ui/CommandBar'
import Trophies from './ui/Trophies'
import Loader from './ui/Loader'
import Classic from './ui/Classic'

// dev only: ?tick drives frames from a timer, for headless or hidden previews
const MANUAL_TICK = import.meta.env.DEV && new URLSearchParams(location.search).has('tick')

// Rough GPU budget: phones and small machines get fewer stars and no MSAA.
function detectTier() {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 8
  if (mobile || cores <= 4 || mem <= 4) return 0
  return cores >= 12 && mem >= 8 ? 2 : 1
}

export default function App() {
  const root = useRef()
  const [ready, setReady] = useState(false)
  const [dpr, setDpr] = useState(() => {
    const px = window.innerWidth * window.innerHeight
    const cap = rig.tier === 0 ? 1.5 : rig.tier === 1 ? 1.6 : 2
    return Math.max(1, Math.min(window.devicePixelRatio || 1, cap, Math.sqrt(3.4e6 / Math.max(1, px))))
  })
  const msaa = rig.tier === 0 ? 0 : dpr >= 1.5 ? 2 : 4

  useEffect(() => {
    if (!MANUAL_TICK) return
    const id = setInterval(() => {
      gsap.ticker.tick()
      advance(performance.now())
    }, 33)
    return () => clearInterval(id)
  }, [])

  // layout follows the viewport
  useLayoutEffect(() => {
    const update = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      rig.L = layout(w, h)
      useStore.setState({ layoutKey: `${w}x${h}` })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // boot sequence
  useEffect(() => {
    if (import.meta.env.DEV) Promise.all([import('./lib/director'), import('three')]).then(([d, THREE]) => (window.__g = { rig, useStore, d, THREE }))
    const s = useStore.getState()
    s.setProgress(0.08, 'Igniting the Core')
    consoleHello()
    document.fonts?.ready.then(() => useStore.getState().setProgress(0.32, 'Seeding sixty thousand stars'))
    // wake the voice backend (and learn what it can do) while the galaxy loads
    loadHealth().then((caps) => useStore.setState({ caps }))
    loadVoices().then(() => useStore.setState({ langs: voiceLangs() }))
    return installKeys()
  }, [])

  const onCreated = useCallback(() => useStore.getState().setProgress(0.55, 'Painting five worlds'), [])

  const onReady = useCallback(() => {
    useStore.getState().setProgress(0.85, 'Calibrating voices')
    prepareIntro()
    setTimeout(() => {
      useStore.getState().setProgress(1, 'All agents online')
      setReady(true)
    }, 500)
    setTimeout(() => {
      if (useStore.getState().phase === 'loading') {
        useStore.setState({ phase: 'gate' })
        rig.phase = 'gate'
      }
    }, 1100)
  }, [])

  const onEnter = useCallback((withSound) => {
    sound.enabled = withSound
    sound.init()
    useStore.getState().setSound(withSound)
    startIntro()
  }, [])

  // idle nudges in the hub: an agent pipes up with a hint
  useEffect(() => {
    let k = Math.floor(Math.random() * IDLE_HINTS.length)
    let last = performance.now()
    const poke = () => (last = performance.now())
    window.addEventListener('pointermove', poke)
    window.addEventListener('keydown', poke)
    window.addEventListener('wheel', poke)
    const id = setInterval(() => {
      const s = useStore.getState()
      if (s.phase !== 'hub' || s.command || s.trophies || s.classic) {
        if (s.bubble) useStore.setState({ bubble: null })
        return
      }
      const idle = performance.now() - last
      if (!s.bubble && idle > 14000) {
        const hint = IDLE_HINTS[k++ % IDLE_HINTS.length]
        useStore.setState({ bubble: hint })
        const i = AGENTS.findIndex((a) => a.id === hint.agent)
        if (i >= 0) rig.bots[i].wave = rig.time
        sound.chirp(1.1, 3)
        last = performance.now() - 6000
      } else if (s.bubble && idle < 300) useStore.setState({ bubble: null })
      else if (s.bubble && idle > 14000 + 7000) useStore.setState({ bubble: null })
    }, 500)
    return () => {
      clearInterval(id)
      window.removeEventListener('pointermove', poke)
      window.removeEventListener('keydown', poke)
      window.removeEventListener('wheel', poke)
    }
  }, [])

  return (
    <div ref={root} className={`app${ready ? ' is-ready' : ''}`}>
      <div className="gl" aria-hidden="true">
        <Canvas
          flat
          frameloop={MANUAL_TICK ? 'never' : 'always'}
          dpr={dpr}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
          camera={{ fov: 45, near: 0.5, far: 9000, position: [-140, 760, 980] }}
          onCreated={onCreated}
        >
          <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.8, +(d - 0.25).toFixed(2)))} onIncline={() => setDpr((d) => Math.min(window.devicePixelRatio || 1, 1.75, +(d + 0.15).toFixed(2)))} flipflops={3} />
          <World msaa={msaa} onReady={onReady} />
        </Canvas>
      </div>
      <Hub />
      <Chapter />
      <Hud />
      <Toasts />
      <CommandBar />
      <Trophies />
      <Loader onEnter={onEnter} />
      <Classic />
    </div>
  )
}

export function bootRig() {
  rig.tier = detectTier()
  rig.reduce = reducedMotion()
}
