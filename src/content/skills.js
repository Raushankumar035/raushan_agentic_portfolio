// The Skills agent's sky: one constellation per domain, one star per skill.
// level: 1-5 (how bright the star burns). used: project ids from projects.js.

export const SKILL_GROUPS = [
  {
    id: 'voice',
    name: 'Voice AI',
    blurb: 'Real-time speech in, speech out: LiveKit, STT, TTS and turn-taking tuned until it feels natural.',
    hue: '#c4b5fd',
    skills: [
      { id: 'livekit', name: 'LiveKit Agents', level: 5, note: 'Voice sessions, rooms and agent workers', used: ['hotel'] },
      { id: 'sip', name: 'SIP calling', level: 4, note: 'Inbound and outbound phone calls', used: ['hotel'] },
      { id: 'stt', name: 'Speech-to-text', level: 4, note: 'Streaming STT in the voice loop', used: ['hotel'] },
      { id: 'tts', name: 'Text-to-speech', level: 4, note: 'Low-latency spoken replies', used: ['hotel'] },
      { id: 'vad', name: 'VAD & turn-taking', level: 4, note: 'Silero VAD, start and stop of speech', used: ['hotel'] },
      { id: 'webrtc', name: 'WebRTC', level: 4, note: 'Browser voice calls', used: ['hotel'] },
      { id: 's2s', name: 'Full-duplex speech models', level: 3, note: 'Listening while speaking', used: [] },
    ],
  },
  {
    id: 'agents',
    name: 'Agentic AI',
    blurb: 'Agents that decide, call tools and hand off: LangGraph supervisors, MCP tools and human-in-the-loop.',
    hue: '#a78bfa',
    skills: [
      { id: 'langgraph', name: 'LangGraph', level: 5, note: 'Stateful multi-agent workflows', used: ['dental', 'tripmate', 'hybridrag'] },
      { id: 'agents', name: 'AI agents', level: 5, note: 'Supervisor and specialist agents', used: ['dental', 'tripmate'] },
      { id: 'tools', name: 'Tool / function calling', level: 5, note: 'Agents that act, not just chat', used: ['hotel', 'tripmate', 'dental'] },
      { id: 'mcp', name: 'MCP', level: 4, note: 'Standard tool interfaces, custom MCP server', used: ['tripmate'] },
      { id: 'crewai', name: 'CrewAI', level: 3, note: 'Role-based agent crews', used: [] },
      { id: 'hitl', name: 'Human in the loop', level: 4, note: 'Escalation to a person when unsure', used: ['triage'] },
      { id: 'multi', name: 'Multi-agent systems', level: 4, note: 'Routing, orchestration, shared state', used: ['dental', 'tripmate'] },
    ],
  },
  {
    id: 'rag',
    name: 'GenAI & RAG',
    blurb: 'Retrieval that shows its evidence: hybrid search, reranking, citations and honest refusals.',
    hue: '#8b5cf6',
    skills: [
      { id: 'llms', name: 'LLMs', level: 5, note: 'Groq, Ollama and local models', used: ['hybridrag', 'reliablerag', 'sqleval'] },
      { id: 'prompt', name: 'Prompt engineering', level: 5, note: 'Grounded, structured, injection-aware prompts', used: ['reliablerag', 'triage'] },
      { id: 'ragpipe', name: 'RAG pipelines', level: 5, note: 'Ingest, chunk, retrieve, rerank, answer', used: ['hybridrag', 'reliablerag'] },
      { id: 'vectordb', name: 'Vector databases', level: 4, note: 'Qdrant and ChromaDB', used: ['hybridrag', 'reliablerag'] },
      { id: 'embeddings', name: 'Embeddings', level: 4, note: 'BGE-M3, FastEmbed', used: ['hybridrag', 'reliablerag'] },
      { id: 'langchain', name: 'LangChain & LlamaIndex', level: 4, note: 'Chains, retrievers, query fusion', used: ['hybridrag', 'reliablerag', 'triage'] },
      { id: 'hf', name: 'Hugging Face', level: 3, note: 'Models and tooling', used: [] },
    ],
  },
  {
    id: 'backend',
    name: 'Backend & APIs',
    blurb: 'The plumbing behind every agent: typed APIs, sockets, queues and databases.',
    hue: '#ddd6fe',
    skills: [
      { id: 'python', name: 'Python', level: 5, note: 'Agents, services, data tooling', used: ['hotel', 'hybridrag', 'reliablerag', 'sqleval'] },
      { id: 'fastapi', name: 'FastAPI', level: 5, note: 'REST APIs and agent backends', used: ['hotel', 'hybridrag', 'reliablerag', 'triage'] },
      { id: 'ws', name: 'WebSockets', level: 4, note: 'Streaming audio and events', used: ['hotel'] },
      { id: 'pydantic', name: 'Pydantic', level: 5, note: 'Validated, typed schemas', used: ['dental', 'reliablerag'] },
      { id: 'postgres', name: 'PostgreSQL', level: 4, note: 'State, sessions, records', used: ['hotel', 'hybridrag', 'tripmate'] },
      { id: 'redis', name: 'Redis', level: 3, note: 'Caching and queues', used: ['hybridrag'] },
      { id: 'integrations', name: 'API integrations', level: 4, note: 'HubSpot CRM, third-party APIs', used: ['hotel', 'tripmate'] },
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud & Reliability',
    blurb: 'Where it runs and how you trust it: Docker, AWS, guardrails, evals and tracing.',
    hue: '#7c3aed',
    skills: [
      { id: 'docker', name: 'Docker & Compose', level: 5, note: 'Every service containerised', used: ['hybridrag', 'reliablerag'] },
      { id: 'aws', name: 'AWS', level: 4, note: 'EC2 deployments', used: ['hybridrag'] },
      { id: 'linux', name: 'Linux', level: 4, note: 'Servers and debugging', used: ['hybridrag'] },
      { id: 'guardrails', name: 'AI guardrails', level: 4, note: 'Similarity gates, citation checks', used: ['reliablerag', 'triage'] },
      { id: 'evals', name: 'Evaluation', level: 4, note: 'Golden datasets and scoring', used: ['sqleval', 'reliablerag'] },
      { id: 'observability', name: 'Observability', level: 4, note: 'Logging, tracing, health checks', used: ['hybridrag'] },
      { id: 'git', name: 'Git & GitHub', level: 5, note: 'Version control and collaboration', used: [] },
    ],
  },
]

// Edit freely: things you are actively exploring right now.
export const LEARNING = ['Full-duplex speech models', 'Agent evals and tracing', 'Custom MCP servers']

export const ALL_SKILLS = SKILL_GROUPS.flatMap((g) => g.skills.map((s) => ({ ...s, group: g.id, groupName: g.name })))

// Extra words visitors might use when they ask "do you know X?"
export const SKILL_ALIASES = {
  livekit: ['livekit'],
  sip: ['sip', 'telephony', 'phone calls', 'twilio'],
  stt: ['stt', 'speech to text', 'asr', 'transcription', 'whisper', 'deepgram', 'sarvam'],
  tts: ['tts', 'text to speech', 'voice synthesis', 'elevenlabs'],
  vad: ['vad', 'silero', 'turn taking', 'barge in', 'endpointing'],
  webrtc: ['webrtc'],
  s2s: ['full duplex', 'duplex', 'moshi', 'unmute', 'speech to speech'],
  langgraph: ['langgraph', 'graph', 'orchestration'],
  agents: ['agent', 'agents', 'agentic', 'supervisor'],
  tools: ['tool calling', 'function calling', 'tools'],
  mcp: ['mcp', 'model context protocol'],
  crewai: ['crewai', 'crew ai', 'crew'],
  hitl: ['hitl', 'human in the loop', 'escalation'],
  multi: ['multi agent', 'multi-agent', 'handoff'],
  llms: ['llm', 'llms', 'gpt', 'groq', 'ollama', 'qwen', 'language model'],
  prompt: ['prompt', 'prompting', 'prompt engineering'],
  ragpipe: ['rag', 'retrieval', 'hybrid rag', 'reranking'],
  vectordb: ['vector', 'qdrant', 'chroma', 'chromadb', 'vector database'],
  embeddings: ['embedding', 'embeddings', 'bge', 'fastembed'],
  langchain: ['langchain', 'llamaindex', 'llama index'],
  hf: ['hugging face', 'huggingface'],
  python: ['python'],
  fastapi: ['fastapi', 'rest', 'api', 'apis'],
  ws: ['websocket', 'websockets', 'realtime'],
  pydantic: ['pydantic'],
  postgres: ['sql', 'postgres', 'postgresql', 'database'],
  redis: ['redis', 'cache', 'queue'],
  integrations: ['hubspot', 'crm', 'integrations'],
  docker: ['docker', 'compose', 'containers', 'deployment'],
  aws: ['aws', 'amazon web services', 'ec2', 'cloud'],
  linux: ['linux', 'server'],
  guardrails: ['guardrails', 'safety', 'hallucination'],
  evals: ['evals', 'evaluation', 'benchmark'],
  observability: ['observability', 'logging', 'tracing', 'monitoring'],
  git: ['git', 'github'],
}
