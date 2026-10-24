import { useEffect, useRef, useState } from 'react'
import { agentById } from '../agents'
import { SUGGESTIONS } from '../lib/router'
import { backToHub, openAgent, togglePartyMode, waveAll } from '../lib/director'
import { hear, pipelineLabels, say, think } from '../lib/brain'
import { stopRecording } from '../lib/listen'
import { voice } from '../lib/voice'
import { useStore } from '../store'
import { Icon } from './Icon'

const LANG_NAMES = { 'hi-IN': 'हिंदी', 'bn-IN': 'বাংলা', 'ta-IN': 'தமிழ்', 'te-IN': 'తెలుగు', 'mr-IN': 'मराठी', 'gu-IN': 'ગુજરાતી', 'kn-IN': 'ಕನ್ನಡ', 'ml-IN': 'മലയാളം', 'pa-IN': 'ਪੰਜਾਬੀ', 'od-IN': 'ଓଡ଼ିଆ' }
const STAGE = { idle: '', listening: 'Listening…', transcribing: 'Transcribing…', thinking: 'Thinking…', speaking: 'Speaking…' }
const ms = (v) => (v == null ? '—' : v < 1 ? '<1 ms' : `${Math.round(v)} ms`)

// "Ask the agents": type, tap to talk, or start a hands-free call. A real voice agent when the
// backend has keys (Sarvam + Groq/Grok), a small local router otherwise.
export default function CommandBar() {
  const open = useStore((s) => s.command)
  const [text, setText] = useState('')
  const [log, setLog] = useState([])
  const [stage, setStage] = useState('idle')
  const [level, setLevel] = useState(0)
  const [trace, setTrace] = useState(null)
  const [call, setCall] = useState(false)
  const [error, setError] = useState('')
  const input = useRef()
  const busy = useRef(false)
  const calling = useRef(false)
  const logRef = useRef()
  useStore((s) => s.caps)
  const labels = pipelineLabels()

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30)
    else {
      calling.current = false
      setCall(false)
      stopRecording()
    }
  }, [open])

  useEffect(() => {
    logRef.current?.scrollTo?.({ top: 1e6, behavior: 'smooth' })
  }, [log, stage])

  if (!open) return null
  const close = () => useStore.setState({ command: false })

  const runAction = (act) => {
    if (!act) return false
    if (act.type === 'open') {
      close()
      openAgent(act.agent, { beat: act.beat ?? 0 })
      return true
    }
    if (act.type === 'hub') {
      close()
      backToHub()
      return true
    }
    if (act.type === 'classic') {
      close()
      useStore.setState({ classic: true })
      return true
    }
    if (act.type === 'party') togglePartyMode()
    if (act.type === 'wave') waveAll()
    return false
  }

  // brain → voice → (maybe) fly somewhere. Returns true if the visitor was sent elsewhere.
  async function respond(q, earsMs) {
    setStage('thinking')
    const r = await think(q)
    setLog((l) => [...l.slice(-5), { q, r }])
    const st = useStore.getState()
    st.award('voice')
    let voiceMs = null
    if (st.sound && st.voice) {
      setStage('speaking')
      voiceMs = await say(r.reply, r.agent, r.lang)
    }
    setTrace({ ears: earsMs, brain: r.ms, voice: voiceMs, source: r.source })
    setStage('idle')
    return runAction(r.action)
  }

  const ask = async (q) => {
    if (busy.current || !q.trim()) return
    busy.current = true
    setText('')
    setError('')
    try {
      await respond(q.trim(), null)
    } finally {
      busy.current = false
    }
  }

  // one spoken turn: 'ok' | 'empty' | 'done' (navigated) | 'error'
  const turn = async () => {
    busy.current = true
    setError('')
    try {
      const h = await hear({ onStage: setStage, onLevel: setLevel, onInterim: setText })
      setLevel(0)
      if (h.empty || !h.text) {
        setStage('idle')
        return 'empty'
      }
      setText('')
      return (await respond(h.text, h.ms)) ? 'done' : 'ok'
    } catch (e) {
      setStage('idle')
      setError(/permission|NotAllowed|denied/i.test(String(e?.name || e?.message || e)) ? 'Microphone access was blocked. You can still type.' : 'I couldn’t hear that. Try again, or type instead.')
      return 'error'
    } finally {
      busy.current = false
    }
  }

  const talkOnce = () => {
    if (stage === 'listening') return stopRecording()
    if (!busy.current) turn()
  }

  const startCall = async () => {
    if (calling.current) {
      calling.current = false
      setCall(false)
      stopRecording()
      voice.cancel()
      return
    }
    calling.current = true
    setCall(true)
    setStage('speaking')
    await say('You’re through to Raushan’s agents. What would you like to know?', 'core', 'en-IN')
    let empties = 0
    while (calling.current) {
      const r = await turn()
      if (r === 'done' || r === 'error') break
      if (r === 'empty') {
        if (++empties >= 2) break
      } else empties = 0
    }
    calling.current = false
    setCall(false)
    setStage('idle')
  }

  const canTalk = labels.live || voice.canListen

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={`command${call ? ' is-call' : ''}`} role="dialog" aria-modal="true" aria-label="Ask the agents">
        <p className={`command-status${labels.live ? ' is-live' : ''}`}>
          <i aria-hidden="true" />
          {labels.live ? (
            <>
              Live voice agent <span>{labels.ears}</span>
              <Icon name="right" />
              <span>{labels.brain}</span>
              <Icon name="right" />
              <span>{labels.voice}</span>
            </>
          ) : (
            <>Offline mode: browser speech and a small local router</>
          )}
        </p>

        <div className="command-log" ref={logRef} aria-live="polite">
          {log.length === 0 && (
            <p className="command-hello">
              Ask the agents anything about him, by typing or out loud{labels.live ? ', in English or any major Indian language' : ''}. They answer like a voice agent on a phone line, and can fly you to the right world.
            </p>
          )}
          {log.map((m, k) => {
            const a = m.r.agent ? agentById(m.r.agent) : null
            return (
              <div key={k} className="exchange">
                <p className="q">{m.q}</p>
                <p className="a" style={{ '--c': a?.color ?? '#c7d2fe' }}>
                  <span>
                    {a ? `${a.name} agent` : 'Router'}
                    {m.r.lang && m.r.lang !== 'en-IN' && LANG_NAMES[m.r.lang] ? ` · ${LANG_NAMES[m.r.lang]}` : ''}
                  </span>
                  {m.r.reply}
                </p>
              </div>
            )
          })}
          {stage !== 'idle' && (
            <p className="command-stage">
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {STAGE[stage]}
            </p>
          )}
        </div>

        <form
          className="command-input"
          onSubmit={(e) => {
            e.preventDefault()
            ask(text)
          }}
        >
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={stage === 'listening' ? 'Listening…' : 'Ask about skills, projects, how to reach him…'}
            aria-label="Your question"
            onKeyDown={(e) => e.key === 'Escape' && close()}
          />
          {canTalk && (
            <button
              type="button"
              className={`icon-btn mic-meter${stage === 'listening' && !call ? ' is-live' : ''}`}
              style={{ '--lvl': level }}
              onClick={talkOnce}
              disabled={call}
              aria-label={stage === 'listening' ? 'Stop listening' : 'Speak your question'}
              aria-pressed={stage === 'listening'}
              title="Tap and speak"
            >
              <Icon name="mic" />
            </button>
          )}
          <button type="submit" className="icon-btn" aria-label="Ask">
            <Icon name="send" />
          </button>
        </form>

        {error && <p className="command-error">{error}</p>}

        <div className="command-row">
          {canTalk && (
            <button type="button" className={`call-btn${call ? ' is-on' : ''}`} onClick={startCall}>
              <Icon name={call ? 'close' : 'voice'} />
              {call ? 'Hang up' : 'Start a hands-free call'}
            </button>
          )}
          {trace && (
            <dl className="trace" aria-label="Last turn timings">
              {trace.ears != null && (
                <div>
                  <dt>{labels.ears}</dt>
                  <dd>{ms(trace.ears)}</dd>
                </div>
              )}
              <div>
                <dt>{trace.source === 'llm' ? labels.brain : 'Local router'}</dt>
                <dd>{ms(trace.brain)}</dd>
              </div>
              {trace.voice != null && (
                <div>
                  <dt>{labels.voice} first audio</dt>
                  <dd>{ms(trace.voice)}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="command-suggest">
          {SUGGESTIONS.concat(labels.live ? ['वो किस तरह के एजेंट बनाते हैं?'] : []).map((s) => (
            <button key={s} type="button" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
        <p className="command-foot">
          <kbd>Esc</kbd> to close ·{' '}
          {labels.live
            ? `${labels.ears === 'Sarvam Saaras' || labels.voice === 'Sarvam Bulbul' ? 'speech by Sarvam AI, ' : ''}answers by ${labels.brain}`
            : 'speech uses your browser’s built-in engine'}
        </p>
      </div>
    </div>
  )
}
