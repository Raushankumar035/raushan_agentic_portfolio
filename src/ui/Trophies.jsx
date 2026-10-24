import { ACHIEVEMENTS, SIGNALS, SIGNAL_ORDER } from '../content/secrets'
import { useStore } from '../store'
import { Icon } from './Icon'

export default function Trophies() {
  const open = useStore((s) => s.trophies)
  const got = useStore((s) => s.achievements)
  const signals = useStore((s) => s.signals)
  if (!open) return null
  const close = () => useStore.setState({ trophies: false })
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="trophies" role="dialog" aria-modal="true" aria-label="Achievements">
        <header>
          <div>
            <p className="eyebrow">Explorer’s log</p>
            <h2>
              {got.length} of {ACHIEVEMENTS.length} achievements
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" autoFocus>
            <Icon name="close" />
          </button>
        </header>
        <ul className="trophy-list">
          {ACHIEVEMENTS.map((a) => {
            const on = got.includes(a.id)
            return (
              <li key={a.id} className={on ? 'is-on' : ''}>
                <span className="trophy-icon">
                  <Icon name={on ? 'trophy' : 'question'} />
                </span>
                <span>
                  <b>{on ? a.title : '???'}</b>
                  <small>{a.hint}</small>
                </span>
              </li>
            )
          })}
        </ul>
        <section className="signal-log">
          <h3>
            Lost signals · {signals.length}/{SIGNAL_ORDER.length}
          </h3>
          <ul>
            {SIGNAL_ORDER.map((k) => (
              <li key={k} className={signals.includes(k) ? 'is-on' : ''} title={signals.includes(k) ? SIGNALS[k].where : 'Not found yet'}>
                <Icon name="signal" />
                <span>{signals.includes(k) ? SIGNALS[k].where : '· · ·'}</span>
              </li>
            ))}
          </ul>
        </section>
        <button
          type="button"
          className="link-btn trophy-reset"
          onClick={() => {
            useStore.setState({ achievements: [], signals: [], visited: [] })
            try {
              localStorage.removeItem('rk-galaxy-v1')
            } catch {
              // nothing to clear
            }
          }}
        >
          Reset progress
        </button>
      </div>
    </div>
  )
}
