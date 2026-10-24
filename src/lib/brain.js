// The agents' brain and a full voice turn, shaped like a production voice agent:
//   ears (Sarvam Saaras, or the browser) → brain (Groq / Grok LLM, or the local router) → voice (Sarvam Bulbul, or the browser)
// Each hop is timed so the UI can show the pipeline trace.
import { caps, chat, transcribe } from './api'
import { recordUtterance, canRecord } from './listen'
import { route } from './router'
import { voice } from './voice'
import { useStore } from '../store'
import { CHAPTERS } from '../content/chapters'
import { agentById } from '../agents'

const history = []

function where() {
  const s = useStore.getState()
  if (s.phase !== 'chapter' || !s.agent) return 'the Core (hub)'
  const b = CHAPTERS[s.agent].beats[s.beat]
  return `${agentById(s.agent).name} world, step "${b.id}"`
}

// Text in, structured answer out.
export async function think(text) {
  const q = text.trim().slice(0, 500)
  history.push({ role: 'user', content: q })
  if (caps().llm) {
    try {
      const t0 = performance.now()
      const r = await chat(history.slice(-8), where())
      history.push({ role: 'assistant', content: r.reply })
      return { ...r, ms: performance.now() - t0, source: 'llm' }
    } catch {
      // fall through to the local router
    }
  }
  const t0 = performance.now()
  const r = route(q)
  history.push({ role: 'assistant', content: r.reply })
  return { reply: r.reply, agent: r.agent, action: r.action || null, lang: 'en-IN', ms: performance.now() - t0, source: 'local' }
}

// Speak and resolve when done; reports time to first audio.
export function say(text, agentId, lang) {
  const t0 = performance.now()
  let first = null
  return new Promise((resolve) => {
    voice.speak(text, agentId || 'core', {
      lang,
      onStart: () => (first = performance.now() - t0),
      onEnd: () => resolve(first),
    })
  })
}

// Listen for one utterance and return its text.
export async function hear({ onStage, onLevel, onInterim } = {}) {
  const c = caps()
  if (c.stt && canRecord()) {
    onStage?.('listening')
    const rec = await recordUtterance({ onLevel })
    if (!rec.speech || !rec.blob) return { text: '', empty: true }
    onStage?.('transcribing')
    const r = await transcribe(rec.blob)
    return { text: r.transcript || '', lang: r.lang, ms: performance.now() - rec.endedAt, source: 'sarvam' }
  }
  if (!voice.canListen) throw new Error('no-ears')
  // browser recogniser fallback
  onStage?.('listening')
  return new Promise((resolve, reject) => {
    let endAt = 0
    let got = false
    const r = voice.listen({
      onInterim,
      onSpeechEnd: () => (endAt = performance.now()),
      onFinal: (t) => {
        got = true
        resolve({ text: t, ms: endAt ? performance.now() - endAt : null, source: 'browser' })
      },
      onError: (e) => reject(new Error(e)),
      onEnd: () => !got && resolve({ text: '', empty: true }),
    })
    if (!r) reject(new Error('no-ears'))
  })
}

export function resetConversation() {
  history.length = 0
}

export const pipelineLabels = () => {
  const c = caps()
  return {
    ears: c.stt ? 'Sarvam Saaras' : 'Browser',
    brain: c.llm ? (c.provider || 'LLM').replace(' · ', ' ') : 'Local router',
    voice: c.tts ? 'Sarvam Bulbul' : 'Browser',
    live: c.llm || c.tts || c.stt,
  }
}
