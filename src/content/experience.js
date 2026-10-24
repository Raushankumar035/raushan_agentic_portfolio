// The Experience agent's ring stations, newest first. Each station has exactly three bars (value 0 to 1).

export const ROLES = [
  {
    id: 'voice',
    title: 'Agentic AI Engineer · Voice Agent',
    org: 'GIT Software Technologies',
    when: 'Oct 2025 — Present',
    where: 'India',
    summary: 'Own the hotel voice agent end to end: from the audio pipeline to the services and workflows it triggers.',
    points: [
      'Designed a production-oriented voice receptionist for hotels that takes guest requests by web voice call and phone.',
      'Built the real-time pipeline: speech-to-text, LLM and text-to-speech on LiveKit, with Silero VAD for turn-taking.',
      'Added inbound and outbound calling, and tool calling so the agent triggers real hotel workflows instead of only chatting.',
      'Wrote the FastAPI and WebSocket services for sessions, integrations and HubSpot CRM updates; tuned the pipeline for low latency.',
    ],
    bars: [
      { label: 'Channels', value: 0.5, text: 'Web + phone' },
      { label: 'Request types', value: 0.8, text: '6+' },
      { label: 'Directions', value: 0.5, text: 'In + out' },
    ],
    stack: ['LiveKit', 'Python', 'FastAPI', 'WebSockets', 'WebRTC', 'Silero VAD', 'PostgreSQL', 'HubSpot'],
  },
  {
    id: 'rag',
    title: 'Agentic AI Engineer · Hybrid RAG',
    org: 'GIT Software Technologies',
    when: 'Oct 2025 — Present',
    where: 'India',
    summary: 'Built an internal document-question system that runs its language model locally.',
    points: [
      'Developed ingestion for PDF, DOCX and PPTX with Docling and OCR, BGE-M3 embeddings, Qdrant and Elasticsearch BM25.',
      'Added reranking and LangGraph orchestration, later reworked onto LlamaIndex with HyDE and reciprocal-rank fusion.',
      'Served Qwen2.5 through Ollama behind FastAPI, with PostgreSQL and Redis.',
      'Containerised the whole pipeline with Docker Compose, including logging, monitoring and health checks.',
    ],
    bars: [
      { label: 'Retrievers', value: 0.5, text: '2' },
      { label: 'Doc types', value: 0.75, text: '3' },
      { label: 'Rerank', value: 0.3, text: '1 stage' },
    ],
    stack: ['FastAPI', 'LangGraph', 'LlamaIndex', 'Qdrant', 'Elasticsearch', 'Ollama', 'Docker'],
  },
  {
    id: 'mca',
    title: 'Master of Computer Application',
    org: 'KL University, Vijayawada',
    when: '2023 — 2025',
    where: 'Andhra Pradesh',
    summary: 'Two years of postgraduate study, finishing with a CGPA of 8.92, right before moving into agentic AI full time.',
    points: [
      'Finished the MCA with a CGPA of 8.92, after a BCA at Yogoda Satsanga Mahavidyalaya, Ranchi (CGPA 8.8).',
      'Earned the Salesforce AI Associate and Oracle Data Science Professional certifications.',
      'Completed Great Learning’s Data Analytics using Python and IBM’s Python for Data Science.',
    ],
    bars: [
      { label: 'MCA CGPA', value: 0.892, text: '8.92' },
      { label: 'BCA CGPA', value: 0.88, text: '8.8' },
      { label: 'Certifications', value: 0.8, text: '4' },
    ],
    stack: ['Python', 'Machine learning', 'Data science', 'Salesforce AI'],
  },
]

export const PRINCIPLES = [
  { title: 'Ground every answer', text: 'If the evidence is not there, the agent should say so instead of guessing.' },
  { title: 'Let code own the rules', text: 'Models decide and draft. Plain, testable code controls actions and escalation.' },
  { title: 'Measure it', text: 'Golden datasets and execution-based scoring beat a gut feeling about a prompt.' },
  { title: 'Ship it in a container', text: 'If it only runs on my laptop, it is not finished.' },
]
