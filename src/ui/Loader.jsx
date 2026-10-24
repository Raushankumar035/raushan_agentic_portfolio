import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { PROFILE } from '../content/profile'
import { AGENTS } from '../agents'
import { Icon } from './Icon'

// Loading screen, then the gate: the whole galaxy turns behind it while you choose how to enter.
export default function Loader({ onEnter }) {
  const phase = useStore((s) => s.phase)
  const progress = useStore((s) => s.progress)
  const label = useStore((s) => s.progressLabel)
  const [gone, setGone] = useState(false)
  const leaving = phase !== 'loading' && phase !== 'gate'

  useEffect(() => {
    if (!leaving) return
    const id = setTimeout(() => setGone(true), 1100)
    return () => clearTimeout(id)
  }, [leaving])

  if (gone) return null
  const online = Math.min(AGENTS.length, Math.floor(progress * (AGENTS.length + 0.999)))

  return (
    <div className={`gate${phase === 'gate' ? ' is-gate' : ''}${leaving ? ' is-leaving' : ''}`}>
      <div className="gate-inner">
        <div className="gate-mark" aria-hidden="true">
          {PROFILE.initials}
        </div>
        {phase === 'loading' ? (
          <div className="boot" role="status" aria-live="polite">
            <div className="boot-bar">
              <span style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
            </div>
            <p>
              {label}
              <span className="boot-count">
                {online}/{AGENTS.length} agents online
              </span>
            </p>
            <ul className="boot-dots" aria-hidden="true">
              {AGENTS.map((a, i) => (
                <li key={a.id} className={i < online ? 'is-on' : ''} style={{ '--c': a.color }} />
              ))}
            </ul>
          </div>
        ) : (
          <div className="gate-body">
            <p className="gate-eyebrow">A galaxy of agents</p>
            <h1>
              {PROFILE.first} <span className="grad">{PROFILE.last}</span>
            </h1>
            <p className="gate-lede">Five agents run this galaxy. Each one knows a part of his story, and they’d love to show you around.</p>
            <div className="gate-actions">
              <button type="button" className="btn btn-primary" onClick={() => onEnter(true)} autoFocus>
                <Icon name="sound" />
                Enter with sound
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => onEnter(false)}>
                Enter quietly
              </button>
            </div>
            <button type="button" className="gate-skip" onClick={() => useStore.setState({ classic: true })}>
              In a hurry? Read the one-page résumé <Icon name="arrow" />
            </button>
            <p className="gate-tip">
              Best with headphones. Drag to look around, scroll to zoom, press <kbd>/</kbd> to talk to the agents.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
