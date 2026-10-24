// What each beat shows in the side panel. Every card reads from src/content.
import { useEffect, useRef, useState } from 'react'
import { AGENT_INDEX, agentById } from '../agents'
import { PROFILE } from '../content/profile'
import { ALL_SKILLS, LEARNING, SKILL_GROUPS } from '../content/skills'
import { ORIGIN, PROJECTS } from '../content/projects'
import { PRINCIPLES, ROLES } from '../content/experience'
import { DETOUR, MILESTONES, NEXT } from '../content/journey'
import { ACHIEVEMENTS, SIGNAL_ORDER } from '../content/secrets'
import { backToHub, goBeatId, openAgent, transmit } from '../lib/director'
import { hear, pipelineLabels, say, think } from '../lib/brain'
import { stopRecording } from '../lib/listen'
import { voice } from '../lib/voice'
import { useStore } from '../store'
import { Icon } from './Icon'

const Level = ({ n }) => (
  <span className="level" aria-label={`${n} of 5`}>
    {[1, 2, 3, 4, 5].map((k) => (
      <i key={k} className={k <= n ? 'on' : ''} />
    ))}
  </span>
)

const Chips = ({ items }) => (
  <ul className="chips">
    {items.map((s) => (
      <li key={s}>{s}</li>
    ))}
  </ul>
)

function CountUp({ value }) {
  // animates the leading number of strings like "~0.7s", "6+", "1,284"
  const m = /^([^0-9]*)([0-9][0-9,.]*)(.*)$/.exec(value)
  const [shown, setShown] = useState(m ? m[1] + '0' + m[3] : value)
  useEffect(() => {
    if (!m) return
    const target = parseFloat(m[2].replace(/,/g, ''))
    const dec = (m[2].split('.')[1] || '').length
    let raf = 0
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 900)
      const e = 1 - Math.pow(1 - p, 3)
      const v = (target * e).toFixed(dec)
      setShown(m[1] + (m[2].includes(',') ? Number(v).toLocaleString('en-IN') : v) + m[3])
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <>{shown}</>
}

const Metrics = ({ items }) => (
  <dl className="metrics">
    {items.map((m) => (
      <div key={m.label}>
        <dt>{m.label}</dt>
        <dd>
          <CountUp value={m.value} />
        </dd>
      </div>
    ))}
  </dl>
)

// ---------- skills ----------

function SkillsOverview() {
  const total = ALL_SKILLS.length
  return (
    <>
      <p className="lede">
        {total} tools across {SKILL_GROUPS.length} constellations. The brighter a star, the more often he reaches for it.
      </p>
      <ul className="rows">
        {SKILL_GROUPS.map((g) => {
          const avg = g.skills.reduce((s, x) => s + x.level, 0) / g.skills.length
          return (
            <li key={g.id}>
              <button type="button" className="row-btn" onClick={() => goBeatId(g.id)}>
                <span className="row-main">
                  <b>{g.name}</b>
                  <small>{g.skills.length} stars</small>
                </span>
                <Level n={Math.round(avg)} />
                <Icon name="right" className="row-go" />
              </button>
            </li>
          )
        })}
      </ul>
      <p className="tip">Hover a star in the sky: each one plays its own note.</p>
    </>
  )
}

function SkillGroup({ group, demo }) {
  const g = SKILL_GROUPS.find((x) => x.id === group)
  return (
    <>
      <p className="lede">{g.blurb}</p>
      {demo && <VoiceDemo />}
      <ul className="rows">
        {g.skills.map((s) => (
          <li key={s.id}>
            <button type="button" className="row-btn" onClick={() => useStore.getState().setDetail({ kind: 'skill', id: s.id })}>
              <span className="row-main">
                <b>{s.name}</b>
                <small>{s.note}</small>
              </span>
              <Level n={s.level} />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

// A live, honest voice pipeline: ears → brain → voice, each hop timed.
// With the backend keys that's Sarvam Saaras → Groq/Grok → Sarvam Bulbul; without, the browser plus a local router.
function VoiceDemo() {
  const [stage, setStage] = useState('idle') // idle | listening | transcribing | thinking | speaking | done | error
  const [heard, setHeard] = useState('')
  const [reply, setReply] = useState(null)
  const [times, setTimes] = useState({})
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState('')
  const busy = useRef(false)
  useStore((s) => s.caps)
  const labels = pipelineLabels()

  useEffect(() => () => stopRecording(), [])

  const answer = async (text, earsMs) => {
    setStage('thinking')
    const r = await think(text)
    setReply(r)
    setTimes((x) => ({ ...x, ears: earsMs, brain: r.ms }))
    useStore.getState().award('voice')
    const st = useStore.getState()
    if (st.sound && st.voice) {
      setStage('speaking')
      const first = await say(r.reply, r.agent || 'skills', r.lang)
      setTimes((x) => ({ ...x, voice: first }))
    }
    setStage('done')
  }

  const talk = async () => {
    if (stage === 'listening') return stopRecording()
    if (busy.current) return
    busy.current = true
    setHeard('')
    setReply(null)
    setTimes({})
    setErr('')
    try {
      const h = await hear({ onStage: setStage, onInterim: setHeard })
      if (h.empty || !h.text) {
        setStage('idle')
        setErr('I didn’t catch anything. Tap and speak, then pause.')
        return
      }
      setHeard(h.text)
      await answer(h.text, h.ms)
    } catch (e) {
      setStage('error')
      setErr(/permission|NotAllowed|denied/i.test(String(e?.name || e?.message || e)) ? 'Microphone access was blocked. Type instead:' : 'The microphone didn’t work here. Type instead:')
    } finally {
      busy.current = false
    }
  }

  const submitTyped = async (e) => {
    e.preventDefault()
    if (!typed.trim() || busy.current) return
    busy.current = true
    setHeard(typed)
    setReply(null)
    setTimes({})
    const q = typed
    setTyped('')
    try {
      await answer(q, null)
    } finally {
      busy.current = false
    }
  }

  const ms = (v) => (v == null ? '—' : v < 1 ? '<1 ms' : `${Math.round(v)} ms`)
  const stages = [
    [labels.ears, stage === 'listening' || stage === 'transcribing', stage === 'listening' ? 'listening' : stage === 'transcribing' ? 'transcribing' : ms(times.ears)],
    [labels.brain, stage === 'thinking', ms(times.brain)],
    [labels.voice, stage === 'speaking', ms(times.voice)],
  ]
  const canTalk = labels.live || voice.canListen

  return (
    <div className="demo">
      <div className="demo-head">
        {canTalk && (
          <button type="button" className={`mic-btn${stage === 'listening' ? ' is-live' : ''}`} onClick={talk} aria-pressed={stage === 'listening'}>
            <Icon name="mic" />
            {stage === 'listening' ? 'Listening… tap to stop' : 'Talk to me'}
          </button>
        )}
        <span className="demo-note">{labels.live ? 'Try Hindi too: “आप क्या बनाते हैं?”' : 'Try “do you know Docker?”'}</span>
      </div>
      <ol className="pipeline">
        {stages.map(([name, on, val]) => (
          <li key={name} className={on ? 'is-on' : ''}>
            <span>{name}</span>
            <b>{val}</b>
          </li>
        ))}
      </ol>
      {heard && (
        <p className="demo-heard">
          <span>You</span> {heard}
        </p>
      )}
      {reply && (
        <p className="demo-reply">
          <span>{reply.agent ? `${agentById(reply.agent).name} agent` : 'Agent'}</span> {reply.reply}
          {reply.action?.type === 'open' && reply.action.agent !== 'skills' && (
            <button type="button" className="link-btn" onClick={() => openAgent(reply.action.agent, { beat: reply.action.beat })}>
              Go there <Icon name="arrow" />
            </button>
          )}
        </p>
      )}
      {(stage === 'error' || !canTalk) && (
        <form className="demo-type" onSubmit={submitTyped}>
          <p>{err || 'This browser can’t listen, so type instead:'}</p>
          <div>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Ask about any skill…" aria-label="Ask the agent" />
            <button type="submit" className="btn btn-small">
              Ask
            </button>
          </div>
        </form>
      )}
      {err && stage !== 'error' && <p className="demo-foot">{err}</p>}
      <p className="demo-foot">
        {labels.live
          ? `A real voice agent: ${labels.ears} hears you, ${labels.brain} thinks, ${labels.voice} answers. Timings are measured live, end of speech to first audio.`
          : 'Uses your browser’s built-in speech recognition and voices, plus a tiny intent router. Timings are measured live.'}
      </p>
    </div>
  )
}

// ---------- projects ----------

function ProjectsOverview() {
  return (
    <>
      <p className="lede">Eight moons, eight projects: voice agents, RAG systems, MCP tools and multi-agent workflows.</p>
      <ul className="tiles">
        {PROJECTS.map((p) => (
          <li key={p.id}>
            <button type="button" className="tile" style={{ '--c': p.color }} onClick={() => goBeatId(p.id)}>
              <small>{p.kind}</small>
              <b>{p.name}</b>
              <span>{p.oneLiner}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function ProjectBody({ p }) {
  return (
    <>
      <p className="lede">{p.oneLiner}</p>
      {p.metrics && <Metrics items={p.metrics} />}
      {p.problem && (
        <section>
          <h3>The problem</h3>
          <p>{p.problem}</p>
        </section>
      )}
      <section>
        <h3>What he built</h3>
        <ul className="bullets">
          {p.built.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Stack</h3>
        <Chips items={p.stack} />
      </section>
      {(p.links?.length > 0 || p.note) && (
        <div className="links">
          {p.links?.map((l) => (
            <a key={l.href} className="btn btn-small" href={l.href} target="_blank" rel="noreferrer">
              <Icon name="github" />
              {l.label}
            </a>
          ))}
          {p.note && <span className="note">{p.note}</span>}
        </div>
      )}
    </>
  )
}

function Project({ project }) {
  return <ProjectBody p={PROJECTS.find((x) => x.id === project)} />
}

// ---------- experience ----------

function ExperienceOverview() {
  return (
    <>
      <p className="lede">{PROFILE.summary}</p>
      <Metrics items={PROFILE.stats.map((s) => ({ value: `${s.value}${s.unit}`, label: s.label }))} />
      <ol className="timeline">
        {ROLES.map((r) => (
          <li key={r.id}>
            <button type="button" className="row-btn" onClick={() => goBeatId(r.id)}>
              <span className="row-main">
                <b>{r.title}</b>
                <small>
                  {r.org} · {r.when}
                </small>
              </span>
              <Icon name="right" className="row-go" />
            </button>
          </li>
        ))}
      </ol>
    </>
  )
}

function Role({ role }) {
  const r = ROLES.find((x) => x.id === role)
  return (
    <>
      <p className="meta">
        <b>{r.org}</b> · {r.when} · {r.where}
      </p>
      <p className="lede">{r.summary}</p>
      <ul className="bullets">
        {r.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <section>
        <h3>Day to day</h3>
        <Chips items={r.stack} />
      </section>
    </>
  )
}

function Principles() {
  return (
    <ul className="principles">
      {PRINCIPLES.map((p, i) => (
        <li key={p.title}>
          <span>0{i + 1}</span>
          <b>{p.title}</b>
          <p>{p.text}</p>
        </li>
      ))}
    </ul>
  )
}

// ---------- journey ----------

function Milestone({ milestone }) {
  const i = MILESTONES.findIndex((m) => m.id === milestone)
  const m = MILESTONES[i]
  return (
    <>
      <p className="year">{m.year}</p>
      <p className="lede">{m.text}</p>
      <div className="progress-line" aria-label={`Milestone ${i + 1} of ${MILESTONES.length}`}>
        {MILESTONES.map((x, k) => (
          <button key={x.id} type="button" className={k <= i ? 'on' : ''} onClick={() => goBeatId(x.id)} aria-label={`${x.year}: ${x.title}`}>
            <span>{x.year}</span>
          </button>
        ))}
      </div>
    </>
  )
}

// ---------- connect ----------

function ConnectIntro() {
  return (
    <>
      <p className="status">
        <i aria-hidden="true" /> {PROFILE.status}
      </p>
      <p className="lede">{PROFILE.headline}</p>
      <section>
        <h3>Where he’d be most useful</h3>
        <ul className="bullets">
          <li>Teams shipping real-time voice or conversational AI to real users.</li>
          <li>Agent products that need telephony, tools and integrations, not just a chat box.</li>
          <li>Places that care about latency, reliability and what happens on call.</li>
        </ul>
      </section>
      <button type="button" className="btn btn-primary" onClick={() => goBeatId('transmit')}>
        Send a signal <Icon name="arrow" />
      </button>
    </>
  )
}

function Transmit() {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)
  const submit = (e) => {
    e.preventDefault()
    if (!msg.trim()) return
    transmit()
    const subject = encodeURIComponent(`Hello from the galaxy${name ? ` — ${name}` : ''}`)
    const body = encodeURIComponent(`${msg}\n\n${name ? `— ${name}` : ''}`)
    setSent(true)
    // let the beam fire first, then hand over to the mail app
    setTimeout(() => {
      window.location.href = `mailto:${PROFILE.email}?subject=${subject}&body=${body}`
    }, 1100)
  }
  return (
    <form className="transmit" onSubmit={submit}>
      <label>
        <span>Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Ada Lovelace" />
      </label>
      <label>
        <span>Message</span>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} required placeholder="We’re hiring an agentic AI engineer and…" />
      </label>
      <button type="submit" className="btn btn-primary">
        <Icon name="send" />
        {sent ? 'Transmitted, opening your mail app…' : 'Transmit'}
      </button>
      <p className="tip">Nothing is stored here. The relay opens your own mail app with the message ready to send.</p>
    </form>
  )
}

function CopyEmail() {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      className="channel"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(PROFILE.email)
          setOk(true)
          setTimeout(() => setOk(false), 1800)
        } catch {
          window.location.href = `mailto:${PROFILE.email}`
        }
      }}
    >
      <Icon name={ok ? 'check' : 'copy'} />
      <span>
        <b>{ok ? 'Copied' : 'Copy email'}</b>
        <small>{PROFILE.email}</small>
      </span>
    </button>
  )
}

function Channels() {
  return (
    <div className="channels">
      <a className="channel" href={`mailto:${PROFILE.email}`}>
        <Icon name="mail" />
        <span>
          <b>Email</b>
          <small>{PROFILE.email}</small>
        </span>
      </a>
      <CopyEmail />
      <a className="channel" href={PROFILE.github} target="_blank" rel="noreferrer">
        <Icon name="github" />
        <span>
          <b>GitHub</b>
          <small>{PROFILE.github.replace('https://', '')}</small>
        </span>
      </a>
      {PROFILE.linkedin && (
        <a className="channel" href={PROFILE.linkedin} target="_blank" rel="noreferrer">
          <Icon name="linkedin" />
          <span>
            <b>LinkedIn</b>
            <small>{PROFILE.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</small>
          </span>
        </a>
      )}
      <button type="button" className="channel" onClick={() => useStore.setState({ classic: true })}>
        <Icon name="file" />
        <span>
          <b>Résumé</b>
          <small>One page, printable</small>
        </span>
      </button>
      <button type="button" className="channel" onClick={() => useStore.setState({ command: true })}>
        <Icon name="mic" />
        <span>
          <b>Ask the agents</b>
          <small>Press / anywhere</small>
        </span>
      </button>
    </div>
  )
}

function Finale() {
  const visited = useStore((s) => s.visited.length)
  const signals = useStore((s) => s.signals.length)
  const ach = useStore((s) => s.achievements.length)
  return (
    <>
      <p className="lede">Thanks for flying through. If something here made you think “we need this person”, the relay is one beat back.</p>
      <dl className="metrics">
        <div>
          <dt>worlds visited</dt>
          <dd>{visited}/5</dd>
        </div>
        <div>
          <dt>signals found</dt>
          <dd>
            {signals}/{SIGNAL_ORDER.length}
          </dd>
        </div>
        <div>
          <dt>achievements</dt>
          <dd>
            {ach}/{ACHIEVEMENTS.length}
          </dd>
        </div>
      </dl>
      <div className="links">
        <button type="button" className="btn btn-primary" onClick={() => useStore.setState({ trophies: true })}>
          <Icon name="trophy" />
          Achievements
        </button>
        <button type="button" className="btn btn-ghost" onClick={backToHub}>
          Back to the Core
        </button>
      </div>
    </>
  )
}

// ---------- hand-offs ----------

function Handoff({ next, from }) {
  const a = agentById(next)
  return (
    <>
      {from === 'skills' && (
        <section>
          <h3>Learning right now</h3>
          <Chips items={LEARNING} />
        </section>
      )}
      {from === 'projects' && <p className="tip">One moon isn’t on the tour. It’s small, gold, and very far out. Drag the view to look around.</p>}
      {from === 'journey' && (
        <section>
          <h3>{NEXT.title}</h3>
          <p>{NEXT.text}</p>
        </section>
      )}
      <button type="button" className="handoff" style={{ '--c': a.color }} onClick={() => openAgent(next)}>
        <span className="chip">
          <Icon name={a.chip} />
        </span>
        <span>
          <small>Next stop</small>
          <b>
            {a.name}: {a.sub}
          </b>
          <i>{a.teaser}</i>
        </span>
        <Icon name="arrow" className="row-go" />
      </button>
      <button type="button" className="link-btn" onClick={backToHub}>
        or head back to the Core
      </button>
    </>
  )
}

// ---------- detail panels (open on top of a beat) ----------

export function Detail({ detail }) {
  if (detail.kind === 'skill') {
    const s = ALL_SKILLS.find((x) => x.id === detail.id)
    const used = s.used.map((id) => PROJECTS.find((p) => p.id === id)).filter(Boolean)
    return (
      <>
        <p className="eyebrow">{s.groupName}</p>
        <h2>{s.name}</h2>
        <Level n={s.level} />
        <p className="lede">{s.note}.</p>
        {used.length > 0 && (
          <section>
            <h3>Where you can see it</h3>
            <ul className="rows">
              {used.map((p) => (
                <li key={p.id}>
                  <button type="button" className="row-btn" onClick={() => openAgent('projects', { beat: p.id })}>
                    <span className="row-main">
                      <b>{p.name}</b>
                      <small>{p.kind}</small>
                    </span>
                    <Icon name="right" className="row-go" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    )
  }
  if (detail.kind === 'origin') {
    return (
      <>
        <p className="eyebrow">You found the oldest moon · {ORIGIN.year}</p>
        <h2>{ORIGIN.name}</h2>
        <ProjectBody p={ORIGIN} />
      </>
    )
  }
  if (detail.kind === 'all-signals') {
    return (
      <>
        <p className="eyebrow">Six of six signals</p>
        <h2>The last transmission</h2>
        <p className="lede">
          You found every signal in the galaxy. He’d really like to meet someone this curious. Send this and he’ll know exactly how you got here.
        </p>
        <a className="btn btn-primary" href={`mailto:${PROFILE.email}?subject=${encodeURIComponent('I found all six signals')}`}>
          <Icon name="mail" />
          “I found all six signals”
        </a>
      </>
    )
  }
  if (detail.kind === 'detour') {
    return (
      <>
        <p className="eyebrow">Off the trail</p>
        <h2>{DETOUR.title}</h2>
        <p className="lede">{DETOUR.text}</p>
      </>
    )
  }
  return null
}

export function Card({ card }) {
  switch (card.kind) {
    case 'skills-overview':
      return <SkillsOverview />
    case 'skill-group':
      return <SkillGroup group={card.group} demo={card.demo} />
    case 'projects-overview':
      return <ProjectsOverview />
    case 'project':
      return <Project project={card.project} />
    case 'experience-overview':
      return <ExperienceOverview />
    case 'role':
      return <Role role={card.role} />
    case 'principles':
      return <Principles />
    case 'milestone':
      return <Milestone milestone={card.milestone} />
    case 'handoff':
      return <Handoff next={card.next} from={card.from} />
    case 'connect-intro':
      return <ConnectIntro />
    case 'transmit':
      return <Transmit />
    case 'channels':
      return <Channels />
    case 'finale':
      return <Finale />
    default:
      return null
  }
}

// Titles for the card header, per beat.
export function cardTitle(agentId, beat) {
  const c = beat.card
  if (c.kind === 'project') return PROJECTS.find((p) => p.id === c.project).name
  if (c.kind === 'role') return ROLES.find((r) => r.id === c.role).title
  if (c.kind === 'milestone') return MILESTONES.find((m) => m.id === c.milestone).title
  if (c.kind === 'skill-group') return SKILL_GROUPS.find((g) => g.id === c.group).name
  if (c.kind === 'handoff')
    return { skills: 'Always learning', projects: 'One more thing', experience: 'The story behind it', journey: 'Where the path goes next' }[agentId] || 'Next stop'
  return (
    {
      'skills-overview': 'The stack, mapped as a sky',
      'projects-overview': 'The Archive',
      'experience-overview': 'Two years in production',
      principles: 'How he works',
      'connect-intro': 'Let’s build together',
      transmit: 'Send a signal',
      channels: 'Other frequencies',
      finale: 'That’s the galaxy',
    }[c.kind] || beat.label
  )
}

export { AGENT_INDEX }
