import { useStore } from '../store'
import { Icon } from './Icon'

const ICON = { achievement: 'trophy', signal: 'signal', note: 'sparkle' }

export default function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismiss)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast is-${t.kind}`}>
          <span className="toast-icon">
            <Icon name={ICON[t.kind] || 'sparkle'} />
          </span>
          <div>
            <p className="toast-title">
              {t.kind === 'achievement' && <small>Achievement unlocked</small>}
              {t.title}
            </p>
            <p className="toast-text">{t.text}</p>
          </div>
          <button type="button" className="toast-x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  )
}
