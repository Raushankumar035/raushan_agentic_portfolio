// The one-page résumé: everything in the galaxy, as plain readable (and printable) HTML.
import { useEffect, useRef } from 'react'
import { CERTIFICATIONS, EDUCATION, PROFILE } from '../content/profile'
import { SKILL_GROUPS } from '../content/skills'
import { ORIGIN, PROJECTS } from '../content/projects'
import { ROLES } from '../content/experience'
import { MILESTONES } from '../content/journey'
import { useStore } from '../store'
import { Icon } from './Icon'

export default function Classic({ standalone = false }) {
  const open = useStore((s) => s.classic)
  const root = useRef()
  useEffect(() => {
    if (open || standalone) root.current?.focus()
  }, [open, standalone])
  if (!open && !standalone) return null
  const close = () => useStore.setState({ classic: false })

  return (
    <div ref={root} className={`classic${standalone ? ' is-standalone' : ''}`} tabIndex={-1} role={standalone ? 'main' : 'dialog'} aria-label="Résumé">
      <div className="classic-bar">
        {!standalone && (
          <button type="button" className="btn btn-ghost btn-small" onClick={close}>
            <Icon name="back" />
            <span>
              <span className="long">Back to the </span>galaxy
            </span>
          </button>
        )}
        <button type="button" className="btn btn-small" onClick={() => window.print()}>
          <Icon name="file" />
          <span>
            Print<span className="long"> or save as PDF</span>
          </span>
        </button>
      </div>

      <article className="cv">
        <header className="cv-head">
          <img className="cv-photo" src="/portrait.webp" alt={PROFILE.name} width="112" height="112" />
          <div className="cv-intro">
            <h1>{PROFILE.name}</h1>
            <p className="cv-role">{PROFILE.role}</p>
            <p className="cv-headline">{PROFILE.headline}</p>
          </div>
          <ul className="cv-contact">
            <li>
              <Icon name="mail" />
              <a href={`mailto:${PROFILE.email}`}>{PROFILE.email}</a>
            </li>
            <li>
              <Icon name="github" />
              <a href={PROFILE.github} target="_blank" rel="noreferrer">
                {PROFILE.github.replace('https://', '')}
              </a>
            </li>
            {PROFILE.linkedin && (
              <li>
                <Icon name="linkedin" />
                <a href={PROFILE.linkedin} target="_blank" rel="noreferrer">
                  {PROFILE.linkedin.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              </li>
            )}
            <li>
              <Icon name="home" />
              {PROFILE.location}
            </li>
          </ul>
        </header>

        <section className="cv-summary">
          <p>{PROFILE.summary}</p>
          <p className="cv-status">{PROFILE.status}</p>
        </section>

        <section>
          <h2>Experience</h2>
          {ROLES.map((r) => (
            <div key={r.id} className="cv-item">
              <div className="cv-item-head">
                <h3>
                  {r.title} <span>· {r.org}</span>
                </h3>
                <p>{r.when}</p>
              </div>
              <ul>
                {r.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="cv-stack">{r.stack.join(' · ')}</p>
            </div>
          ))}
        </section>

        <section>
          <h2>Selected projects</h2>
          <div className="cv-grid">
            {[...PROJECTS, ORIGIN].map((p) => (
              <div key={p.id} className="cv-project">
                <h3>{p.name}</h3>
                <p className="cv-kind">
                  {[p.kind, p.year].filter(Boolean).join(' · ')}
                </p>
                <p>{p.oneLiner}</p>
                <p className="cv-stack">{p.stack.join(' · ')}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Skills</h2>
          <dl className="cv-skills">
            {SKILL_GROUPS.map((g) => (
              <div key={g.id}>
                <dt>{g.name}</dt>
                <dd>{g.skills.map((s) => s.name).join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2>Education</h2>
          {EDUCATION.map((e) => (
            <div key={e.id} className="cv-item">
              <div className="cv-item-head">
                <h3>
                  {e.degree} <span>· {e.school}</span>
                </h3>
                <p>{e.when}</p>
              </div>
              <p className="cv-stack">{e.score}</p>
            </div>
          ))}
        </section>

        <section>
          <h2>Certifications</h2>
          <ul>
            {CERTIFICATIONS.map((c) => (
              <li key={c.name}>
                {c.name} · {c.by}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Path so far</h2>
          <ol className="cv-path">
            {MILESTONES.map((m) => (
              <li key={m.id}>
                <b>{m.year}</b> {m.title}
              </li>
            ))}
          </ol>
        </section>

        <footer className="cv-foot">
          <p>
            This page is the quiet version of an interactive galaxy of agents.
            {!standalone && (
              <>
                {' '}
                <button type="button" className="link-btn" onClick={close}>
                  Go back and explore it
                </button>
                .
              </>
            )}
          </p>
        </footer>
      </article>
    </div>
  )
}
