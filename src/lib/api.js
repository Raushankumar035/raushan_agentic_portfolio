// Thin client for the galaxy's backend (/api). Everything here is optional:
// when the backend or its keys are missing, callers fall back to browser speech and the local router.

const RAW = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/$/, '')
const BASE = RAW && !/^https?:\/\//.test(RAW) ? `https://${RAW}` : RAW

const OFF = { llm: false, tts: false, stt: false, provider: null, speech: null }
let health = null
let pending = null

// Called at boot: also wakes a sleeping free-tier server while the intro plays.
export function loadHealth() {
  if (!pending) {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 20000)
    pending = fetch(`${BASE}/api/health`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : OFF))
      .catch(() => OFF)
      .then((h) => {
        clearTimeout(t)
        health = { ...OFF, ...h }
        return health
      })
  }
  return pending
}

export const caps = () => health || OFF

export async function chat(messages, where, signal) {
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, where }),
    signal,
  })
  if (!r.ok) throw new Error(`chat ${r.status}`)
  return r.json()
}

export const ttsUrl = (text, agent, lang = 'en-IN') =>
  `${BASE}/api/tts?${new URLSearchParams({ text, agent: agent || 'core', lang })}`

export async function transcribe(blob, signal) {
  const r = await fetch(`${BASE}/api/stt`, {
    method: 'POST',
    headers: { 'Content-Type': (blob.type || 'audio/webm').split(';')[0] },
    body: blob,
    signal,
  })
  if (!r.ok) throw new Error(`stt ${r.status}`)
  return r.json()
}

// Pre-rendered narration (scripts/voices.mjs). Missing file = no pre-rendered voices.
let manifest = null
export async function loadVoices() {
  try {
    const r = await fetch('/voices/manifest.json', { cache: 'no-cache' })
    manifest = r.ok ? await r.json() : {}
  } catch {
    manifest = {}
  }
  return manifest
}
export const voices = () => manifest || {}
export const voiceLangs = () => Object.keys(voices()).filter((k) => Object.keys(voices()[k] || {}).length)
