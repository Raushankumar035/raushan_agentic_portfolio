// A deliberately small intent router: the same shape as the routing layer in a real voice agent
// (normalise → match intents → answer + action), minus the LLM. Runs entirely in the browser.
import { ALL_SKILLS, SKILL_ALIASES } from '../content/skills'
import { PROFILE } from '../content/profile'
import { PROJECTS } from '../content/projects'
import { JOKES } from '../content/secrets'

const norm = (s) =>
  ` ${s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+./\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `

const has = (t, words) => words.some((w) => t.includes(` ${w} `) || (w.includes(' ') && t.includes(w)))

const NAV = [
  { agent: 'skills', words: ['skill', 'skills', 'stack', 'tech', 'tools', 'technologies', 'languages', 'know'] },
  { agent: 'projects', words: ['project', 'projects', 'built', 'build', 'portfolio', 'work samples', 'case study', 'shipped', 'demo'] },
  { agent: 'experience', words: ['experience', 'job', 'jobs', 'career', 'company', 'companies', 'worked', 'work history', 'role', 'roles', 'intern', 'internship'] },
  { agent: 'journey', words: ['journey', 'story', 'about', 'background', 'education', 'degree', 'path', 'history', 'who'] },
  { agent: 'connect', words: ['contact', 'hire', 'email', 'mail', 'connect', 'reach', 'available', 'availability', 'linkedin', 'github', 'call', 'interview'] },
]

const NAMES = { skills: 'Skills', projects: 'Projects', experience: 'Experience', journey: 'Journey', connect: 'Connect' }

function skillAnswer(t) {
  for (const s of ALL_SKILLS) {
    const words = [s.name.toLowerCase(), ...(SKILL_ALIASES[s.id] || [])]
    if (has(t, words)) {
      const level = ['', 'has dabbled with', 'is comfortable with', 'works with', 'is strong in', 'uses daily and knows deeply'][s.level]
      const where = s.used
        .map((id) => PROJECTS.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .slice(0, 2)
      return {
        reply: `Yes. He ${level} ${s.name}: ${s.note.toLowerCase()}.${where.length ? ` You can see it in ${where.join(' and ')}.` : ''}`,
        action: { type: 'open', agent: 'skills', beat: s.group },
        agent: 'skills',
      }
    }
  }
  return null
}

export function route(input) {
  const t = norm(input)
  if (t.trim().length === 0) return { reply: 'I’m listening. Try “show me your projects”.', agent: null }

  if (has(t, ['hello', 'hi', 'hey', 'namaste', 'yo', 'hola'])) {
    return { reply: `Hi! We’re ${PROFILE.first}’s agents. Ask about his skills, projects, experience, or how to reach him.`, action: { type: 'wave' } }
  }
  if (has(t, ['joke', 'funny', 'laugh'])) {
    return { reply: JOKES[Math.floor(Math.random() * JOKES.length)], agent: null }
  }
  if (has(t, ['party', 'dance', 'celebrate', 'konami'])) {
    return { reply: 'Party protocol engaged.', action: { type: 'party' } }
  }
  if (has(t, ['resume', 'cv', 'pdf', 'print', 'page view', 'plain'])) {
    return { reply: 'Opening the plain résumé view. It prints nicely too.', action: { type: 'classic' } }
  }
  if (has(t, ['secret', 'secrets', 'easter', 'hidden', 'signal', 'signals'])) {
    return { reply: 'There are six lost signals. One hides behind the Core, and one in every world. Listen for the hum.', agent: null }
  }
  if (has(t, ['home', 'back', 'galaxy', 'core', 'start', 'menu'])) {
    return { reply: 'Back to the Core.', action: { type: 'hub' } }
  }
  if (has(t, ['email address', 'your email', 'his email'])) {
    return { reply: `His email is ${PROFILE.email}. Connect can send it for you.`, action: { type: 'open', agent: 'connect' }, agent: 'connect' }
  }
  if (has(t, ['name', 'who are you', 'who is', 'whos'])) {
    return {
      reply: `${PROFILE.name} is an ${PROFILE.role}. ${PROFILE.headline}`,
      action: { type: 'open', agent: 'journey' },
      agent: 'journey',
    }
  }
  if (has(t, ['latency', 'fast', 'speed', 'milliseconds'])) {
    return {
      reply: 'Latency matters in voice. His hotel agent streams every stage, from speech to text to speech, and uses VAD for natural turn-taking.',
      action: { type: 'open', agent: 'skills', beat: 'voice' },
      agent: 'skills',
    }
  }

  const GENERIC = ['voice', 'agents', 'agent', 'system', 'analyzer', 'appointment', 'ticket', 'smartphone', 'review']
  const project = PROJECTS.find((p) =>
    has(t, [p.id, p.name.toLowerCase(), ...p.name.toLowerCase().split(/[\s:,]+/).filter((w) => w.length > 4 && !GENERIC.includes(w))]),
  )
  if (project) {
    return { reply: `${project.name}: ${project.oneLiner}`, action: { type: 'open', agent: 'projects', beat: project.id }, agent: 'projects' }
  }

  const skill = skillAnswer(t)
  if (skill) return skill

  for (const n of NAV) {
    if (has(t, n.words)) {
      return { reply: `Taking you to ${NAMES[n.agent]}.`, action: { type: 'open', agent: n.agent }, agent: n.agent }
    }
  }

  return {
    reply: 'I’m a small router with a small brain. Try “projects”, “do you know LangGraph?”, or “how do I contact him?”',
    agent: null,
  }
}

export const SUGGESTIONS = ['Show me your projects', 'Do you know LangGraph?', 'Tell me about the hotel voice agent', 'Tell me a joke', 'How do I hire him?']
