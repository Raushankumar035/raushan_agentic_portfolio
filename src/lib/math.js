export const TAU = Math.PI * 2
export const DEG = Math.PI / 180

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1)
export const smooth = (a, b, v) => {
  const t = invLerp(a, b, v)
  return t * t * (3 - 2 * t)
}
// Frame-rate independent exponential approach.
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt))
export const bell = (p) => Math.sin(Math.PI * clamp(p, 0, 1))
export const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
export const outCubic = (p) => 1 - Math.pow(1 - p, 3)

export function rng(seed) {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// Critically damped spring, implicit integration: stable at any frame rate and never overshoots.
// Returns the new value and writes the new velocity into vel[key].
export function spring(x, target, vel, key, omega, dt) {
  const v = vel[key]
  const f = 1 + 2 * dt * omega
  const oo = omega * omega
  const hoo = dt * oo
  const hhoo = dt * hoo
  const det = 1 / (f + hhoo)
  vel[key] = (v + hoo * (target - x)) * det
  return (f * x + dt * v + hhoo * target) * det
}

// Same, for a Vector3 with a Vector3 velocity.
export function spring3(cur, target, vel, omega, dt) {
  const f = 1 + 2 * dt * omega
  const oo = omega * omega
  const hoo = dt * oo
  const hhoo = dt * hoo
  const det = 1 / (f + hhoo)
  for (const k of ['x', 'y', 'z']) {
    const x = cur[k]
    const v = vel[k]
    vel[k] = (v + hoo * (target[k] - x)) * det
    cur[k] = (f * x + dt * v + hhoo * target[k]) * det
  }
  return cur
}

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
