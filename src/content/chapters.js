// Each agent's story, beat by beat. `say` is what the agent speaks (keep it to one or two
// sentences, it is read aloud). `card` picks what the side panel shows (ui/cards.jsx).
// Lines are looked up by id, so adding or reordering items in the content files is safe.
import { SKILL_GROUPS } from './skills.js'
import { PROJECTS } from './projects.js'
import { ROLES } from './experience.js'
import { MILESTONES } from './journey.js'

const SKILL_LINES = {
  voice: 'This is the brightest corner of the sky: voice. LiveKit, speech in, speech out, and turn-taking that feels natural. Go on, try talking to me.',
  agents: 'Here’s where the agents live. LangGraph supervisors, MCP tools, and hand-offs to a human when it matters.',
  rag: 'Retrieval that shows its evidence. Hybrid search, reranking, and answers that cite their sources.',
  backend: 'Agents need plumbing. Python and FastAPI do the heavy lifting behind every call.',
  cloud: 'And it all has to run somewhere. Docker, AWS, and the guardrails and evals that make it trustworthy.',
}

const PROJECT_LINES = {
  hotel: 'This one is a hotel receptionist. It answers guests on web calls and phone calls, and can ring them back too.',
  hybridrag: 'This one searches company documents with semantic and keyword search together, and answers with a local model.',
  reliablerag: 'This one would rather say it doesn’t know than make something up. Every answer comes with evidence.',
  tripmate: 'A travel planner built from specialist agents. They call flight, hotel and weather tools through MCP.',
  dental: 'Book, cancel or reschedule a dental appointment by chatting. A supervisor agent picks who handles it.',
  sqleval: 'This moon benchmarks language models on writing SQL, and scores them by running the queries.',
  triage: 'A model decides, plain code controls the action, and an LLM drafts the reply. Support tickets, triaged.',
  reviews: 'It reads phone reviews and turns them into star ratings for camera, battery, display and more.',
}

const ROLE_LINES = {
  voice: 'The newest station: voice agents in production. This is where he works right now.',
  rag: 'Same company, different problem. A hybrid retrieval system that answers from internal documents.',
  mca: 'And this is where it started: a master’s degree in computer applications, finished with an 8.92.',
}

const MILESTONE_LINES = {
  bca: 'I’m Journey. Hop on, we’re flying the whole route. It starts in 2020 with a BCA in Ranchi.',
  mca: 'Then the MCA at KL University. Python, machine learning, and a lot of side projects.',
  agents: 'He finished the degree, and found agents. LLMs, retrieval and tool calling became the plan.',
  job: 'October 2025. His first role as an Agentic AI Engineer, building a voice receptionist for hotels.',
  now: 'And this is now. Voice, retrieval, MCP and evals, and the trail keeps going.',
}

const sayFor = (map, id, fallback) => map[id] || fallback

export const CHAPTERS = {
  skills: {
    world: 'The Constellation',
    beats: [
      {
        id: 'intro',
        label: 'The sky',
        say: 'Hey, I’m Skills. Everything he builds runs on the stars in this sky. Watch them light up.',
        card: { kind: 'skills-overview' },
      },
      ...SKILL_GROUPS.map((g) => ({
        id: g.id,
        label: g.name,
        say: sayFor(SKILL_LINES, g.id, g.blurb),
        card: { kind: 'skill-group', group: g.id, demo: g.id === 'voice' },
      })),
      {
        id: 'outro',
        label: 'Still learning',
        say: 'New stars appear every month. Want to see what he built with all this? Projects is waiting.',
        card: { kind: 'handoff', next: 'projects', from: 'skills' },
      },
    ],
  },

  projects: {
    world: 'The Archive Moons',
    beats: [
      {
        id: 'intro',
        label: 'Eight moons',
        say: 'I’m Projects. Every moon around this world is something he built, from voice agents to RAG systems and multi-agent workflows.',
        card: { kind: 'projects-overview' },
      },
      ...PROJECTS.map((p, i) => ({
        id: p.id,
        label: p.name,
        project: i,
        say: sayFor(PROJECT_LINES, p.id, p.oneLiner),
        card: { kind: 'project', project: p.id },
      })),
      {
        id: 'outro',
        label: 'Next',
        say: 'That’s the archive. Though there is one tiny moon I didn’t show you. Experience is up next.',
        card: { kind: 'handoff', next: 'experience', from: 'projects' },
      },
    ],
  },

  experience: {
    world: 'The Ring Stations',
    beats: [
      {
        id: 'intro',
        label: 'The ring',
        say: 'I’m Experience. Each station on this ring is a chapter of his work and study. The newest ones are agents in production.',
        card: { kind: 'experience-overview' },
      },
      ...ROLES.map((r, i) => ({
        id: r.id,
        label: r.title,
        role: i,
        say: sayFor(ROLE_LINES, r.id, r.summary),
        card: { kind: 'role', role: r.id },
      })),
      {
        id: 'principles',
        label: 'How he works',
        say: 'Titles change. These habits don’t.',
        card: { kind: 'principles' },
      },
      {
        id: 'outro',
        label: 'Next',
        say: 'Want the story behind the stations? Journey flies the whole route.',
        card: { kind: 'handoff', next: 'journey', from: 'experience' },
      },
    ],
  },

  journey: {
    world: 'The Flight Path',
    beats: [
      ...MILESTONES.map((m, i) => ({
        id: m.id,
        label: m.year,
        milestone: i,
        say: sayFor(MILESTONE_LINES, m.id, m.text),
        card: { kind: 'milestone', milestone: m.id },
      })),
      {
        id: 'next',
        label: 'Next',
        say: 'Where does the path go next? That depends a little on you. Connect can explain.',
        card: { kind: 'handoff', next: 'connect', from: 'journey' },
      },
    ],
  },

  connect: {
    world: 'The Relay',
    beats: [
      {
        id: 'intro',
        label: 'Hello',
        say: 'I’m Connect. If you’ve made it this far, I think you two should talk.',
        card: { kind: 'connect-intro' },
      },
      {
        id: 'transmit',
        label: 'Send a signal',
        say: 'Write him a message, and the relay will beam it straight to his inbox.',
        card: { kind: 'transmit' },
      },
      {
        id: 'channels',
        label: 'Frequencies',
        say: 'Prefer the usual channels? Here they all are.',
        card: { kind: 'channels' },
      },
      {
        id: 'outro',
        label: 'The end?',
        say: 'That’s the whole galaxy. Well, almost. There are signals hidden out there, if you’re the curious type.',
        card: { kind: 'finale' },
      },
    ],
  },
}
