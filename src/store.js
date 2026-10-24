import { create } from 'zustand'
import { ACHIEVEMENTS, SIGNALS, SIGNAL_ORDER } from './content/secrets'
import { AGENTS } from './agents'
import { sound } from './lib/sound'

const KEY = 'rk-galaxy-v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

const saved = load()
let toastId = 0

export const useStore = create((set, get) => ({
  // loading → gate (press enter) → intro → hub ⇄ travel ⇄ chapter
  phase: 'loading',
  progress: 0,
  progressLabel: 'Waking the agents',
  agent: null,
  beat: 0,
  sound: saved.sound ?? true,
  voice: saved.voice ?? true,
  lang: saved.lang ?? 'en-IN', // narration language (needs a pre-rendered track)
  signals: saved.signals ?? [],
  achievements: saved.achievements ?? [],
  visited: saved.visited ?? [],
  toasts: [],
  command: false,
  trophies: false,
  classic: false,
  detail: null, // extra panel on top of the chapter card: { kind, ... }
  bubble: null, // hub hint: { agent, text }
  hovered: null,
  line: '', // what the guide is saying right now
  pokes: 0,
  layoutKey: '',
  caps: null, // what the voice backend can do (lib/api.js)
  langs: [], // pre-rendered narration languages

  setPhase: (phase) => set({ phase }),
  setProgress: (progress, progressLabel) => set(progressLabel ? { progress, progressLabel } : { progress }),
  setDetail: (detail) => set({ detail }),
  setLine: (line) => set({ line }),

  toast: (t) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, ...t }] }))
    setTimeout(() => get().dismiss(id), t.ms ?? 5200)
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  award: (id) => {
    if (get().achievements.includes(id)) return false
    const a = ACHIEVEMENTS.find((x) => x.id === id)
    if (!a) return false
    set((s) => ({ achievements: [...s.achievements, id] }))
    persist()
    sound.achievement()
    get().toast({ kind: 'achievement', title: a.title, text: a.hint, ms: 6000 })
    return true
  },

  collect: (where) => {
    if (get().signals.includes(where)) return false
    const signals = [...get().signals, where]
    set({ signals })
    persist()
    sound.collect()
    get().toast({
      kind: 'signal',
      title: `Lost signal ${signals.length} / ${SIGNAL_ORDER.length}`,
      text: SIGNALS[where].text,
      ms: 9000,
    })
    if (where === 'journey') set({ detail: { kind: 'detour' } })
    if (signals.length === SIGNAL_ORDER.length) {
      setTimeout(() => {
        get().award('signals')
        set({ detail: { kind: 'all-signals' } })
      }, 1400)
    }
    return true
  },

  visit: (agent) => {
    if (get().visited.includes(agent)) return
    const visited = [...get().visited, agent]
    set({ visited })
    persist()
    get().award('first')
    if (AGENTS.every((a) => visited.includes(a.id))) setTimeout(() => get().award('tour'), 2500)
  },

  setSound: (on) => {
    set({ sound: on })
    sound.setEnabled(on)
    persist()
  },
  setVoice: (on) => {
    set({ voice: on })
    persist()
  },
  setLang: (lang) => {
    set({ lang })
    persist()
  },
}))

function persist() {
  const s = useStore.getState()
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ signals: s.signals, achievements: s.achievements, visited: s.visited, sound: s.sound, voice: s.voice, lang: s.lang }),
    )
  } catch {
    // private mode or blocked storage: progress just won't persist
  }
}

export const getState = () => useStore.getState()
