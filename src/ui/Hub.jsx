import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { AGENTS } from '../agents'
import { PROFILE } from '../content/profile'
import { rig } from '../lib/rig'
import { openAgent } from '../lib/director'
import { sound } from '../lib/sound'
import { useStore } from '../store'
import { Icon } from './Icon'

// The hub overlay: name, role, and an HTML card under each orbiting agent.
export default function Hub() {
  const phase = useStore((s) => s.phase)
  const hovered = useStore((s) => s.hovered)
  const bubble = useStore((s) => s.bubble)
  const root = useRef()
  const shown = useRef(false)
  const live = phase === 'hub'

  // title choreography, the first time the hub appears
  useEffect(() => {
    if (!live || shown.current || !root.current) return
    shown.current = true
    if (rig.reduce) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.fromTo('.word > span', { yPercent: 115 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 }, 0)
      tl.fromTo('.hub-title p', { opacity: 0, letterSpacing: '1.1em' }, { opacity: 1, letterSpacing: '0.42em', duration: 1.5, ease: 'power4.out' }, 0.25)
      tl.fromTo('.sheen', { backgroundPosition: '100% 50%' }, { backgroundPosition: '0% 50%', duration: 1.6, ease: 'none' }, 1.1)
      tl.fromTo('.hint-line', { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'power2.inOut' }, 0.9)
      tl.fromTo('.hint-body', { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'sine.out' }, 1.15)
      tl.fromTo('.agent3d .agent-ui', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.08 }, 0.1)
    }, root)
    return () => ctx.revert()
  }, [live])

  const hover = (id, on) => {
    if (on && useStore.getState().hovered !== id) sound.tick()
    useStore.setState({ hovered: on ? id : useStore.getState().hovered === id ? null : useStore.getState().hovered })
  }

  return (
    <div ref={root} className={`hub${live ? ' is-live' : ''}`} aria-hidden={!live}>
      {AGENTS.map((a, i) => (
        <button
          key={a.id}
          ref={(el) => (rig.cards[i] = el)}
          type="button"
          className={`agent3d${hovered === a.id ? ' is-hot' : ''}`}
          style={{ '--c': a.color }}
          aria-label={`${a.name} agent: ${a.teaser}`}
          tabIndex={live ? 0 : -1}
          onMouseEnter={() => hover(a.id, true)}
          onMouseLeave={() => hover(a.id, false)}
          onFocus={() => hover(a.id, true)}
          onBlur={() => hover(a.id, false)}
          onClick={() => openAgent(a.id)}
        >
          <span className="agent-ui">
            {bubble?.agent === a.id && (
              <span className="hint-bubble" role="status">
                {bubble.text}
              </span>
            )}
            <span className="card">
              <span className="card-row">
                <span className="chip">
                  <Icon name={a.chip} />
                </span>
                <span className="card-name">{a.name}</span>
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </span>
              <span className="card-teaser">
                <span>{a.teaser}</span>
              </span>
            </span>
            <span className="card-sub">{a.sub}</span>
          </span>
        </button>
      ))}

      <div className="hub-title">
        <h1>
          <span className="word">
            <span>{PROFILE.first}</span>
          </span>{' '}
          <span className="word">
            <span className="grad">
              {PROFILE.last}
              <span className="sheen" aria-hidden="true">
                {PROFILE.last}
              </span>
            </span>
          </span>
        </h1>
        <p>{PROFILE.role}</p>
      </div>

      <div className="hint" aria-hidden="true">
        <span className="hint-line" />
        <span className="hint-body">
          Pick an agent to begin
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="5,9 12,16 19,9" />
          </svg>
        </span>
      </div>

      <div className="far-label" aria-hidden="true">
        <p className="far-eyebrow">The Galaxy of Agents</p>
        <p>Five worlds, five arms, one Core. Scroll back in to meet the agents.</p>
      </div>
    </div>
  )
}
