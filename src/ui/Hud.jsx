import { AGENTS } from '../agents'
import { PROFILE } from '../content/profile'
import { ACHIEVEMENTS } from '../content/secrets'
import { backToHub, openAgent, say } from '../lib/director'
import { CHAPTERS } from '../content/chapters'
import { sound } from '../lib/sound'
import { voice } from '../lib/voice'
import { useStore } from '../store'
import { Icon } from './Icon'

const LANG_LABEL = {
  'en-IN': { short: 'EN', name: 'English' },
  'hi-IN': { short: 'हिं', name: 'हिंदी' },
  'ta-IN': { short: 'த', name: 'தமிழ்' },
  'bn-IN': { short: 'বা', name: 'বাংলা' },
}

function replayLine() {
  const s = useStore.getState()
  const b = CHAPTERS[s.agent]?.beats[s.beat]
  if (b) say(s.agent, b.say)
}

// Top bar: monogram, quick links, and the global toggles.
export default function Hud() {
  const phase = useStore((s) => s.phase)
  const on = useStore((s) => s.sound)
  const voiceOn = useStore((s) => s.voice)
  const got = useStore((s) => s.achievements.length)
  const langs = useStore((s) => s.langs)
  const lang = useStore((s) => s.lang)
  const hubLinks = phase === 'hub'
  const live = phase === 'hub' || phase === 'chapter' || phase === 'travel'

  return (
    <header className={`hud${live ? ' is-live' : ''}`}>
      <button type="button" className="mono" onClick={() => phase === 'chapter' && backToHub()} aria-label={`${PROFILE.name}, back to the Core`}>
        {PROFILE.initials}
      </button>
      <nav aria-label="Primary" className={`hud-links${hubLinks ? ' is-on' : ''}`}>
        <button type="button" onClick={() => openAgent('projects')}>
          Work
        </button>
        <button type="button" onClick={() => openAgent('journey')}>
          About
        </button>
        <button type="button" onClick={() => openAgent('connect')}>
          Contact
        </button>
        <button type="button" onClick={() => useStore.setState({ classic: true })}>
          Résumé
        </button>
      </nav>
      <div className="hud-tools">
        <button type="button" className="icon-btn" onClick={() => useStore.setState({ command: true })} aria-label="Ask the agents (press /)" title="Ask the agents  /">
          <Icon name="mic" />
        </button>
        <button type="button" className="icon-btn with-count" onClick={() => useStore.setState({ trophies: true })} aria-label={`Achievements: ${got} of ${ACHIEVEMENTS.length}`} title="Achievements">
          <Icon name="trophy" />
          {got > 0 && <span className="count">{got}</span>}
        </button>
        {langs.length > 1 && (
          <button
            type="button"
            className="icon-btn lang-btn"
            onClick={() => {
              const next = langs[(langs.indexOf(lang) + 1) % langs.length]
              useStore.getState().setLang(next)
              const s = useStore.getState()
              if (s.phase === 'chapter') replayLine()
            }}
            aria-label={`Narration language: ${LANG_LABEL[lang]?.name || lang}. Switch language`}
            title={`Narration: ${LANG_LABEL[lang]?.name || lang}`}
          >
            {LANG_LABEL[lang]?.short || 'EN'}
          </button>
        )}
        {voice.canSpeak && (
          <button
            type="button"
            className={`icon-btn${voiceOn && on ? '' : ' is-off'}`}
            onClick={() => {
              const v = !voiceOn
              useStore.getState().setVoice(v)
              if (!v) voice.cancel()
            }}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? 'Agent voices on' : 'Agent voices off'}
            title={voiceOn ? 'Agent voices: on' : 'Agent voices: off'}
          >
            <Icon name="voice" />
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            sound.init()
            useStore.getState().setSound(!on)
            if (on) voice.cancel()
          }}
          aria-pressed={on}
          aria-label={on ? 'Sound on' : 'Sound off'}
          title={on ? 'Sound: on (M)' : 'Sound: off (M)'}
        >
          <Icon name={on ? 'sound' : 'mute'} />
        </button>
      </div>
      <span className="sr-only">{AGENTS.length} agents</span>
    </header>
  )
}
