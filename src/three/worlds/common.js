import { useLayoutEffect, useMemo } from 'react'
import { Vector3 } from 'three'
import { rig } from '../../lib/rig'
import { agentById } from '../../agents'
import { useStore } from '../../store'

export const UP = new Vector3(0, 1, 0)

// Where the focus of a chapter shot lands on screen, leaving room for the guide and the card.
export function chapterFrame(ctx, fov = 32) {
  return ctx.narrow ? { fov: fov + 8, fx: 0.05, fy: 0.3 } : { fov, fx: -0.12, fy: 0.06 }
}

// Registers a world's camera shots with the rig so the director and camera can find them.
export function useWorld(id, shot) {
  const center = useMemo(() => new Vector3(...agentById(id).world.pos), [id])
  useLayoutEffect(() => {
    rig.worlds[id] = { center, shot }
    return () => {
      if (rig.worlds[id]?.shot === shot) delete rig.worlds[id]
    }
  }, [id, center, shot])
  return center
}

// 0..1, how "on stage" this world is: travelling to it or inside its chapter.
export function stageOf(id) {
  const s = useStore.getState()
  return s.agent === id && (s.phase === 'chapter' || s.phase === 'travel') ? 1 : 0
}

// A point on a sphere around `c` from azimuth/elevation (radians) at distance d.
export function around(c, az, el, d, out = new Vector3()) {
  return out.set(c.x + Math.sin(az) * Math.cos(el) * d, c.y + Math.sin(el) * d, c.z + Math.cos(az) * Math.cos(el) * d)
}

// Azimuth that faces from `c` toward the Core (so the galaxy's heart sits behind the world).
export function azToCore(c) {
  return Math.atan2(-c.x, -c.z)
}
