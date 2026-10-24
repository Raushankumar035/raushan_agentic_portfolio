// The galaxy's tiny backend: keeps API keys off the client and talks to
//   Sarvam (speech-to-text + text-to-speech) and an OpenAI-compatible LLM (Groq GPT-OSS 120B by default, or xAI Grok).
// Used by the Vite dev server (vite.config.js) and by server/index.js in production.
// Every route degrades: if a key is missing, /api/health says so and the client falls back to browser speech.
import { buildSystemPrompt, BEATS, AGENT_IDS } from './prompt.js'
import { VOICES } from './voices.js'

const SARVAM = 'https://api.sarvam.ai'
const LANGS = ['en-IN', 'hi-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'od-IN', 'pa-IN', 'ta-IN', 'te-IN']

// Models are tried in order: free tiers rate-limit each model separately, so a chain multiplies headroom.
function llmConfig(env) {
  const want = (env.LLM_PROVIDER || '').toLowerCase()
  const xai = want === 'xai' || want === 'grok' || (!env.GROQ_API_KEY && env.XAI_API_KEY)
  const list = (env.LLM_MODEL || '').split(',').map((m) => m.trim()).filter(Boolean)
  if (xai) {
    return {
      provider: 'xai',
      label: 'xAI Grok',
      base: 'https://api.x.ai/v1',
      key: env.XAI_API_KEY || env.LLM_API_KEY,
      models: list.length ? list : ['grok-4.20-0309-non-reasoning'],
    }
  }
  return {
    provider: 'groq',
    label: 'Groq',
    base: 'https://api.groq.com/openai/v1',
    key: env.GROQ_API_KEY || env.LLM_API_KEY,
    // GPT-OSS 120B first; the smaller GPT-OSS 20B only steps in when the 120B is rate-limited or down.
    models: list.length ? list : ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
  }
}

// Per-model knobs: keep reasoning short (voice latency) and out of the reply.
function modelParams(model) {
  if (/gpt-oss/.test(model)) return { reasoning_effort: 'low', include_reasoning: false }
  if (/qwen3/.test(model)) return { reasoning_effort: 'none' }
  return {}
}

const prettyModel = (m) => m.replace(/^.*\//, '').replace('gpt-oss-120b', 'GPT-OSS 120B').replace('gpt-oss-20b', 'GPT-OSS 20B').replace(/^qwen/, 'Qwen ')

// ---------- small utilities ----------

function json(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(Object.assign(new Error('too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function timed(url, opts, ms) {
  const ctl = new AbortController()
  const id = setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctl.signal })
  } finally {
    clearTimeout(id)
  }
}

// Token bucket per client and route, plus a daily ceiling to protect free tiers.
function limiter({ perMinute, daily }) {
  const buckets = new Map()
  let day = new Date().toDateString()
  let used = 0
  return (ip) => {
    const today = new Date().toDateString()
    if (today !== day) {
      day = today
      used = 0
      buckets.clear()
    }
    if (used >= daily) return false
    const now = Date.now()
    const b = buckets.get(ip) || { t: perMinute, at: now }
    b.t = Math.min(perMinute, b.t + ((now - b.at) / 60000) * perMinute)
    b.at = now
    if (b.t < 1) {
      buckets.set(ip, b)
      return false
    }
    b.t -= 1
    used++
    buckets.set(ip, b)
    if (buckets.size > 5000) buckets.clear()
    return true
  }
}

// Small LRU for synthesised audio: the same narration lines are requested by every visitor.
function lru(max) {
  const m = new Map()
  return {
    get(k) {
      const v = m.get(k)
      if (v) {
        m.delete(k)
        m.set(k, v)
      }
      return v
    },
    set(k, v) {
      m.set(k, v)
      if (m.size > max) m.delete(m.keys().next().value)
    },
  }
}

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'anon'

// ---------- the API ----------

export function createApi(env = process.env, { dev = false } = {}) {
  const llm = llmConfig(env)
  const sarvamKey = env.SARVAM_API_KEY
  const sttMode = env.SARVAM_STT_MODE || 'codemix'
  const sttModel = env.SARVAM_STT_MODEL || 'saaras:v3'
  const daily = Number(env.DAILY_LIMIT || 3000)
  const limits = {
    chat: limiter({ perMinute: 12, daily }),
    tts: limiter({ perMinute: 40, daily: daily * 4 }),
    stt: limiter({ perMinute: 10, daily }),
  }
  const ttsCache = lru(400)
  const chatCache = lru(300)
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const system = buildSystemPrompt()

  function cors(req, res) {
    const origin = req.headers.origin
    if (!origin) return true
    const sameHost = (() => {
      try {
        return new URL(origin).host === req.headers.host
      } catch {
        return false
      }
    })()
    const ok = dev || sameHost || allowed.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)
    if (!ok) return false
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Lang')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return true
  }

  // ---- POST /api/chat: the agent brain ----
  async function chat(req, res) {
    if (!llm.key) return json(res, 503, { error: 'llm not configured' })
    if (!limits.chat(clientIp(req))) return json(res, 429, { error: 'slow down' })
    let body
    try {
      body = JSON.parse((await readBody(req, 24_000)).toString('utf8'))
    } catch (e) {
      return json(res, e.status || 400, { error: 'bad request' })
    }
    const history = Array.isArray(body.messages) ? body.messages.slice(-8) : []
    const messages = [
      { role: 'system', content: system },
      ...history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content.slice(0, 600) })),
    ]
    if (body.where && typeof body.where === 'string') {
      messages.splice(1, 0, { role: 'system', content: `The visitor is currently in: ${body.where.slice(0, 80)}.` })
    }
    // identical opening questions (the suggestion chips, mostly) are answered from cache
    const single = messages.filter((m) => m.role === 'user').length === 1
    const cacheKey = single ? `${body.where || ''}|${messages[messages.length - 1].content.toLowerCase().replace(/\s+/g, ' ').trim()}` : null
    const hit = cacheKey && chatCache.get(cacheKey)
    if (hit && Date.now() - hit.at < 6 * 3600_000) return json(res, 200, { ...hit.value, ms: 0, cached: true })

    const t0 = Date.now()
    const call = async (model) =>
      timed(
        `${llm.base}/chat/completions`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${llm.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.5,
            max_tokens: 700, // GPT-OSS spends part of this budget on (hidden) reasoning, so leave headroom
            response_format: { type: 'json_object' },
            ...modelParams(model),
          }),
        },
        12_000,
      )
    try {
      let last = 0
      for (const model of llm.models) {
        const r = await call(model)
        if (r.ok) {
          const data = await r.json()
          const raw = data.choices?.[0]?.message?.content || '{}'
          const value = { ...normalise(raw), model: prettyModel(data.model || model), provider: llm.label }
          if (cacheKey) chatCache.set(cacheKey, { at: Date.now(), value })
          return json(res, 200, { ...value, ms: Date.now() - t0 })
        }
        last = r.status
        const detail = await r.text().catch(() => '')
        console.warn(`[api/chat] ${llm.provider} ${model} ${r.status} ${detail.slice(0, 160)}`)
        // try the next model on rate limits, outages or a retired model id; give up on anything else
        if (!(r.status === 429 || r.status === 404 || r.status >= 500)) break
      }
      return json(res, last === 429 ? 429 : 502, { error: 'llm failed', status: last })
    } catch (e) {
      console.warn('[api/chat]', e.name === 'AbortError' ? 'timeout' : e.message)
      return json(res, 504, { error: 'llm timeout' })
    }
  }

  // ---- GET /api/tts?text=&agent=&lang= : Sarvam Bulbul, returns mp3 ----
  async function tts(req, res, url) {
    if (!sarvamKey) return json(res, 503, { error: 'tts not configured' })
    const text = (url.searchParams.get('text') || '').trim().slice(0, 500)
    const agent = url.searchParams.get('agent') || 'core'
    const lang = LANGS.includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'en-IN'
    if (!text) return json(res, 400, { error: 'no text' })
    const voice = VOICES[agent] || VOICES.core
    const key = `${voice.speaker}|${lang}|${voice.pace}|${text}`
    let audio = ttsCache.get(key)
    if (!audio) {
      if (!limits.tts(clientIp(req))) return json(res, 429, { error: 'slow down' })
      try {
        const r = await timed(
          `${SARVAM}/text-to-speech`,
          {
            method: 'POST',
            headers: { 'api-subscription-key': sarvamKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              language_code: lang,
              model: 'bulbul:v3',
              speaker: voice.speaker,
              pace: voice.pace,
              temperature: 0.5,
              speech_sample_rate: 24000,
              output_audio_codec: 'mp3',
            }),
          },
          15_000,
        )
        if (!r.ok) {
          const detail = await r.text().catch(() => '')
          console.warn(`[api/tts] sarvam ${r.status} ${detail.slice(0, 200)}`)
          return json(res, 502, { error: 'tts failed', status: r.status })
        }
        const data = await r.json()
        audio = Buffer.from(data.audios?.[0] || '', 'base64')
        if (!audio.length) return json(res, 502, { error: 'empty audio' })
        ttsCache.set(key, audio)
      } catch (e) {
        console.warn('[api/tts]', e.name === 'AbortError' ? 'timeout' : e.message)
        return json(res, 504, { error: 'tts timeout' })
      }
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', audio.length)
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
    res.end(audio)
  }

  // ---- POST /api/stt (raw audio body) : Sarvam Saaras ----
  async function stt(req, res) {
    if (!sarvamKey) return json(res, 503, { error: 'stt not configured' })
    if (!limits.stt(clientIp(req))) return json(res, 429, { error: 'slow down' })
    let audio
    try {
      audio = await readBody(req, 3_000_000)
    } catch (e) {
      return json(res, e.status || 400, { error: 'bad audio' })
    }
    if (audio.length < 800) return json(res, 400, { error: 'too short' })
    const type = (req.headers['content-type'] || 'audio/webm').split(';')[0]
    const ext = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }[type] || 'webm'
    const form = new FormData()
    form.append('file', new Blob([audio], { type }), `speech.${ext}`)
    form.append('model', sttModel)
    form.append('mode', sttMode)
    form.append('language_code', 'unknown')
    const t0 = Date.now()
    try {
      const r = await timed(`${SARVAM}/speech-to-text`, { method: 'POST', headers: { 'api-subscription-key': sarvamKey }, body: form }, 15_000)
      if (!r.ok) {
        const detail = await r.text().catch(() => '')
        console.warn(`[api/stt] sarvam ${r.status} ${detail.slice(0, 200)}`)
        return json(res, 502, { error: 'stt failed', status: r.status })
      }
      const data = await r.json()
      return json(res, 200, { transcript: (data.transcript || '').trim(), lang: data.language_code || null, ms: Date.now() - t0 })
    } catch (e) {
      console.warn('[api/stt]', e.name === 'AbortError' ? 'timeout' : e.message)
      return json(res, 504, { error: 'stt timeout' })
    }
  }

  // Returns true when the request was an API call (handled), false to let the caller serve something else.
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://local')
    if (!url.pathname.startsWith('/api/')) return false
    if (!cors(req, res)) {
      json(res, 403, { error: 'origin not allowed' })
      return true
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return true
    }
    try {
      if (url.pathname === '/api/health' && req.method === 'GET') {
        json(res, 200, {
          llm: !!llm.key,
          tts: !!sarvamKey,
          stt: !!sarvamKey,
          provider: llm.key ? `${llm.label} · ${prettyModel(llm.models[0])}` : null,
          speech: sarvamKey ? 'Sarvam' : null,
        })
      } else if (url.pathname === '/api/chat' && req.method === 'POST') await chat(req, res)
      else if (url.pathname === '/api/tts' && req.method === 'GET') await tts(req, res, url)
      else if (url.pathname === '/api/stt' && req.method === 'POST') await stt(req, res)
      else json(res, 404, { error: 'not found' })
    } catch (e) {
      console.warn('[api]', e.message)
      if (!res.headersSent) json(res, 500, { error: 'server error' })
    }
    return true
  }
}

// Validate the model's JSON so the client can trust its shape.
function normalise(raw) {
  let o = {}
  try {
    o = JSON.parse(raw)
  } catch {
    const m = /\{[\s\S]*\}/.exec(raw)
    try {
      o = m ? JSON.parse(m[0]) : {}
    } catch {
      o = {}
    }
  }
  const agent = AGENT_IDS.includes(o.agent) ? o.agent : null
  const reply = typeof o.reply === 'string' && o.reply.trim() ? o.reply.trim().slice(0, 600) : 'Sorry, I lost the signal for a second. Could you ask that again?'
  const lang = LANGS.includes(o.lang) ? o.lang : 'en-IN'
  let action = null
  const a = o.action || {}
  if (a.type === 'open' && AGENT_IDS.includes(a.agent)) {
    action = { type: 'open', agent: a.agent }
    if (typeof a.beat === 'string' && BEATS[a.agent]?.includes(a.beat)) action.beat = a.beat
  } else if (['hub', 'resume', 'party', 'wave'].includes(a.type)) action = { type: a.type === 'resume' ? 'classic' : a.type }
  return { reply, agent, lang, action }
}
