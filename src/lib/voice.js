// How the agents talk. Three tiers, best first:
//   1. pre-rendered narration (public/voices, made by `npm run voices` with Sarvam Bulbul)
//   2. live Sarvam Bulbul through our /api/tts (cached server-side and by the browser)
//   3. the browser's built-in speech engine
// Tiers 1-2 play through WebAudio, so the speaking agent's visor and the Skills waveform follow the real audio.
import { rig } from './rig'
import { sound } from './sound'
import { caps, ttsUrl, voices } from './api'
import { AGENT_INDEX, agentById } from '../agents'

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

// ---------- browser voice picking (tier 3) ----------

let chosen = null
function pickVoice(lang) {
  if (!synth) return null
  const want = (lang || 'en-IN').slice(0, 2)
  if (chosen && chosen.lang.startsWith(want)) return chosen
  const all = synth.getVoices()
  const voicesFor = all.filter((v) => v.lang.toLowerCase().startsWith(want))
  if (!voicesFor.length) return null
  const score = (v) =>
    (/natural|neural/i.test(v.name) ? 40 : 0) +
    (/IN$/i.test(v.lang) ? 8 : 0) +
    (/google/i.test(v.name) ? 12 : 0) +
    (/aria|jenny|neerja|samantha|serena|libby|sonia|swara|madhur/i.test(v.name) ? 10 : 0) +
    (v.localService ? 1 : 0)
  chosen = voicesFor.sort((a, b) => score(b) - score(a))[0]
  return chosen
}
if (synth) synth.addEventListener?.('voiceschanged', () => (chosen = null))

// ---------- playback state ----------

let seq = 0
let current = { sources: [], ctl: null, raf: 0, pulse: 0, agent: null }
rig.speech = { active: false, bins: new Float32Array(48), level: 0 }

const agentIndex = (id) => (id != null && id in AGENT_INDEX ? AGENT_INDEX[id] : null)

function setTalk(i, v) {
  if (i == null) return
  rig.bots[i].talk = v
}

function stopAll() {
  const c = current
  c.ctl?.abort()
  c.sources.forEach((s) => {
    try {
      s.onended = null
      s.stop()
    } catch {
      // already stopped
    }
  })
  cancelAnimationFrame(c.raf)
  clearInterval(c.pulse)
  rig.speech.active = false
  rig.speech.level = 0
  rig.speech.bins.fill(0)
  rig.bots.forEach((b) => (b.talk = 0))
  sound.duck(false)
  current = { sources: [], ctl: null, raf: 0, pulse: 0, agent: null }
}

// Split long replies so the first sentence can start playing while the rest synthesise.
function sentences(text) {
  const parts = text.match(/[^.!?।]+[.!?।]+["”’)]*\s*|[^.!?।]+$/g) || [text]
  const out = []
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && (out[out.length - 1].length < 40 || p.length < 18)) out[out.length - 1] += ` ${p}`
    else out.push(p)
  }
  return out.slice(0, 6)
}

// Drive the visor and waveform from the voice bus while audio plays.
function meter(i, token) {
  const an = sound.voiceAnalyser
  if (!an) return
  const time = new Uint8Array(an.fftSize)
  const freq = new Uint8Array(an.frequencyBinCount)
  const bins = rig.speech.bins
  const tick = () => {
    if (token !== seq) return
    an.getByteTimeDomainData(time)
    let sum = 0
    for (let k = 0; k < time.length; k++) {
      const v = (time[k] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / time.length)
    rig.speech.level = rms
    an.getByteFrequencyData(freq)
    for (let k = 0; k < bins.length; k++) bins[k] = freq[Math.min(freq.length - 1, 2 + Math.floor(Math.pow(k / bins.length, 1.4) * 70))] / 255
    setTalk(i, Math.min(1, rms * 5.5))
    current.raf = requestAnimationFrame(tick)
  }
  tick()
}

async function playUrls(urls, i, token, onStart) {
  const ctx = sound.ctx
  if (!ctx || !sound.voiceGain) throw new Error('no audio context')
  if (ctx.state === 'suspended') await ctx.resume()
  const ctl = new AbortController()
  current.ctl = ctl
  const giveUp = setTimeout(() => ctl.abort(), 15000)
  // fetch every chunk at once; play them in order as they arrive
  const buffers = urls.map((u) =>
    fetch(u, { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`voice ${r.status}`)
        return r.arrayBuffer()
      })
      .then((b) => ctx.decodeAudioData(b)),
  )
  let started = false
  let when = 0
  for (let k = 0; k < buffers.length; k++) {
    const buf = await buffers[k]
    if (token !== seq) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(sound.voiceGain)
    when = Math.max(ctx.currentTime + 0.02, when)
    src.start(when)
    current.sources.push(src)
    if (!started) {
      started = true
      rig.speech.active = true
      sound.duck(true)
      onStart?.()
      meter(i, token)
    }
    when += buf.duration + 0.06
    if (k === buffers.length - 1) {
      clearTimeout(giveUp)
      await new Promise((res) => {
        src.onended = res
        // belt and braces: some browsers drop onended when a context is suspended
        setTimeout(res, (when - ctx.currentTime) * 1000 + 600)
      })
    }
  }
}

function browserSpeak(text, agentId, lang, token, onStart) {
  return new Promise((resolve) => {
    if (!synth) return resolve()
    const i = agentIndex(agentId)
    const cfg = i != null ? agentById(agentId).voice : { pitch: 1, rate: 1.04 }
    const u = new SpeechSynthesisUtterance(text.replace(/[→←↑↓·]/g, ' ').replace(/\s+/g, ' '))
    const v = pickVoice(lang)
    if (v) u.voice = v
    if (lang) u.lang = lang
    u.pitch = cfg.pitch
    u.rate = cfg.rate
    u.volume = 0.95
    u.onstart = () => {
      if (token !== seq) return
      onStart?.()
      clearInterval(current.pulse)
      current.pulse = setInterval(() => setTalk(i, 0.35 + Math.random() * 0.5), 120)
    }
    u.onboundary = () => setTalk(i, 1)
    let finished = false
    // some engines never fire onend (or have no voices at all): never let a line hang the story
    const words = text.split(/\s+/).length
    const guard = setTimeout(() => done(), 2500 + words * 520)
    const quiet = setTimeout(() => !synth.speaking && done(), 1600)
    function done() {
      if (finished) return
      finished = true
      clearTimeout(guard)
      clearTimeout(quiet)
      clearInterval(current.pulse)
      setTalk(i, 0)
      resolve()
    }
    u.onend = done
    u.onerror = done
    synth.speak(u)
  })
}

export const voice = {
  get canSpeak() {
    return !!synth || caps().tts || Object.keys(voices()).length > 0
  },
  canListen: !!Recognition,

  // Narration line → its translated text, if a pre-rendered language track has it.
  localise(text, agentId, lang) {
    if (!lang || lang === 'en-IN') return text
    return voices()[lang]?.[`${agentId}|${text}`]?.text || text
  },

  // Resolves when the line has finished (or was cancelled).
  async speak(text, agentId, { lang = 'en-IN', onStart, onEnd } = {}) {
    this.cancel()
    const token = seq
    const i = agentIndex(agentId)
    current.agent = agentId
    try {
      const pre = voices()[lang]?.[`${agentId}|${text}`] || voices()['en-IN']?.[`${agentId}|${text}`]
      if (pre) {
        await playUrls([`/voices/${pre.file}`], i, token, onStart)
      } else if (caps().tts && sound.ctx) {
        await playUrls(
          sentences(text).map((s) => ttsUrl(s, agentId, lang)),
          i,
          token,
          onStart,
        )
      } else {
        await browserSpeak(text, agentId, lang, token, onStart)
      }
    } catch (e) {
      if (token !== seq || e.name === 'AbortError') return
      // live voice failed: the browser still has a voice
      await browserSpeak(text, agentId, lang, token, onStart)
    } finally {
      if (token === seq) {
        stopAll()
        onEnd?.()
      }
    }
  },

  cancel() {
    seq++
    stopAll()
    synth?.cancel()
  },

  // Browser speech recognition (used only when Sarvam isn't configured).
  listen({ onInterim, onFinal, onError, onEnd, onSpeechEnd, lang = 'en-IN' }) {
    if (!Recognition) {
      onError?.('unsupported')
      return null
    }
    const r = new Recognition()
    r.lang = lang
    r.interimResults = true
    r.maxAlternatives = 1
    r.continuous = false
    let final = ''
    r.onresult = (e) => {
      let interim = ''
      for (let k = e.resultIndex; k < e.results.length; k++) {
        const res = e.results[k]
        if (res.isFinal) final += res[0].transcript
        else interim += res[0].transcript
      }
      if (interim) onInterim?.(interim)
      if (final) onFinal?.(final.trim())
    }
    r.onspeechend = () => onSpeechEnd?.()
    r.onerror = (e) => onError?.(e.error || 'error')
    r.onend = () => onEnd?.(final.trim())
    try {
      r.start()
    } catch {
      onError?.('busy')
      return null
    }
    return r
  },
}
