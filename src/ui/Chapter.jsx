import { useEffect, useRef } from 'react'
import { agentById } from '../agents'
import { CHAPTERS } from '../content/chapters'
import { rig } from '../lib/rig'
import { backToHub, goBeat, say } from '../lib/director'
import { useStore } from '../store'
import { Card, Detail, cardTitle } from './cards'
import { Icon } from './Icon'
import Typed from './Typed'

// Everything on screen while an agent tells its story: header, speech bubble, beat nav, card.
export default function Chapter() {
  const phase = useStore((s) => s.phase)
  const agentId = useStore((s) => s.agent)
  const beat = useStore((s) => s.beat)
  const line = useStore((s) => s.line)
  const detail = useStore((s) => s.detail)
  const narr = useRef()
  const cardRef = useRef()
  const live = phase === 'chapter' && !!agentId
  const shown = (phase === 'chapter' || phase === 'travel') && !!agentId

  useEffect(() => {
    rig.narratorEl = narr.current
  }, [])

  // a new beat starts at the top of the card
  useEffect(() => {
    cardRef.current?.scrollTo?.({ top: 0 })
  }, [beat, agentId, detail])

  if (!agentId) return <div ref={narr} className="chapter" aria-hidden="true" />
  const a = agentById(agentId)
  const ch = CHAPTERS[agentId]
  const b = ch.beats[beat]
  const last = beat === ch.beats.length - 1

  return (
    <div ref={narr} className={`chapter${shown ? ' is-shown' : ''}${live ? ' is-live' : ''}`} style={{ '--c': a.color }}>
      <header className="chapter-head">
        <button type="button" className="back-btn" onClick={backToHub}>
          <Icon name="back" />
          <span>Galaxy</span>
          <kbd>Esc</kbd>
        </button>
        <p className="crumb">
          <span className="chip">
            <Icon name={a.chip} />
          </span>
          <b>{a.name}</b>
          <span>{ch.world}</span>
        </p>
      </header>

      <div className="speech" aria-live="polite">
        <p className="speech-tag">{a.name} agent</p>
        <p className="speech-line">{line ? <Typed key={line} text={line} /> : ' '}</p>
        <button type="button" className="speech-replay" onClick={() => say(agentId, b.say)} aria-label="Say that again">
          <Icon name="replay" />
        </button>
      </div>

      <aside className="panel" aria-label={`${a.name}: ${b.label}`}>
        <div className="panel-scroll" ref={cardRef}>
          {detail ? (
            <div className="panel-body" key={`d-${detail.kind}-${detail.id || ''}`}>
              <button type="button" className="link-btn panel-backlink" onClick={() => useStore.getState().setDetail(null)}>
                <Icon name="back" /> Back to {b.label}
              </button>
              <Detail detail={detail} />
            </div>
          ) : (
            <div className="panel-body" key={`${agentId}-${beat}`}>
              <p className="eyebrow">
                {String(beat + 1).padStart(2, '0')} / {String(ch.beats.length).padStart(2, '0')} · {b.label}
              </p>
              <h2>{cardTitle(agentId, b)}</h2>
              <Card card={b.card} />
            </div>
          )}
        </div>
        <nav className="beats" aria-label="Story steps">
          <button type="button" className="beat-arrow" onClick={() => goBeat(beat - 1)} disabled={beat === 0} aria-label="Previous">
            <Icon name="left" />
          </button>
          <ol>
            {ch.beats.map((x, k) => (
              <li key={x.id}>
                <button type="button" className={k === beat ? 'is-on' : k < beat ? 'is-past' : ''} onClick={() => goBeat(k)} aria-label={x.label} aria-current={k === beat ? 'step' : undefined}>
                  <span className="beat-tip">{x.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="beat-arrow" onClick={() => goBeat(beat + 1)} disabled={last} aria-label="Next">
            <Icon name="right" />
          </button>
        </nav>
      </aside>
    </div>
  )
}
