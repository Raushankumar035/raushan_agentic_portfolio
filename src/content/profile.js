// Everything a visitor reads lives in src/content. Edit these files to change the story;
// the galaxy, the agents' lines and the résumé page all read from here.

export const PROFILE = {
  name: 'Raushan Kumar',
  first: 'Raushan',
  last: 'Kumar',
  initials: 'RK',
  role: 'Agentic AI Engineer',
  location: 'Bengaluru, India',
  email: 'raushankumarv973@gmail.com',
  github: 'https://github.com/Raushankumar035',
  linkedin: 'https://www.linkedin.com/in/raushan-kumar-908a21303/',
  headline: 'I build AI agents that talk, retrieve and take action: voice receptionists, RAG systems and multi-agent workflows that hold up in production.',
  summary:
    'Agentic AI engineer building LLM-powered applications, voice AI agents, RAG pipelines and multi-agent systems for real business use cases. I work across the whole stack of an agent: speech, retrieval, tool calling, orchestration and the FastAPI services and Docker setups it runs on.',
  status: 'Open to agentic AI, voice AI and LLM engineering roles. Based in Bengaluru, India.',
  stats: [
    { value: '1', unit: 'yr', label: 'building production AI agents' },
    { value: '8', unit: '', label: 'agent and RAG projects built' },
    { value: '4', unit: '', label: 'AI and data certifications' },
  ],
}

export const EDUCATION = [
  { id: 'mca', degree: 'Master of Computer Application (MCA)', school: 'KL University, Vijayawada', when: '2023 – 2025', score: 'CGPA 8.92' },
  { id: 'bca', degree: 'Bachelor of Computer Application (BCA)', school: 'Yogoda Satsanga Mahavidyalaya, Ranchi', when: '2020 – 2023', score: 'CGPA 8.8' },
]

export const CERTIFICATIONS = [
  { name: 'Certified Salesforce AI Associate', by: 'Salesforce' },
  { name: 'Oracle Certified Data Science Professional', by: 'Oracle' },
  { name: 'Data Analytics using Python', by: 'Great Learning' },
  { name: 'Python for Data Science', by: 'IBM' },
]

// The order the agents hand you along when you follow the story end to end.
export const STORY_ORDER = ['skills', 'projects', 'experience', 'journey', 'connect']
