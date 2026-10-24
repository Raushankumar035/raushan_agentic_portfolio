// Things you only find by poking around.

// Lost signals: one in the hub, one hidden in each world. Find all six for the last message.
export const SIGNALS = {
  hub: {
    where: 'Behind the Core',
    text: 'Decoded: the galaxy behind you is 60,000 stars drawn in a single draw call. Your GPU says you’re welcome.',
  },
  skills: {
    where: 'The Constellation',
    text: 'Decoded: in human conversation the gap between turns is about 200 milliseconds. That is the bar a voice agent is judged against.',
  },
  projects: {
    where: 'The Archive Moons',
    text: 'Decoded: every planet surface here is painted by a shader while the page loads. Not a single image file was downloaded for them.',
  },
  experience: {
    where: 'The Ring Stations',
    text: 'Decoded: these agents speak with Sarvam Bulbul and think with GPT-OSS 120B on Groq. Press / and you can talk back.',
  },
  journey: {
    where: 'The Flight Path',
    text: 'Decoded: one tiny moon in the Archive holds an early machine learning project. It is easy to miss.',
  },
  connect: {
    where: 'The Relay',
    text: 'Decoded: ↑ ↑ ↓ ↓ ← → ← → B A. Try it anywhere in the galaxy.',
  },
}

export const SIGNAL_ORDER = ['hub', 'skills', 'projects', 'experience', 'journey', 'connect']

export const ACHIEVEMENTS = [
  { id: 'first', title: 'First contact', hint: 'Let an agent show you its world.' },
  { id: 'tour', title: 'Grand tour', hint: 'Visit all five worlds.' },
  { id: 'signals', title: 'Signal hunter', hint: 'Find all six lost signals.' },
  { id: 'origin', title: 'Archaeologist', hint: 'Some moons are older than others.' },
  { id: 'debugger', title: 'Debugger', hint: 'Something hides behind the Core. Catch it three times.' },
  { id: 'wish', title: 'Make a wish', hint: 'Catch a passing comet.' },
  { id: 'party', title: 'Party protocol', hint: 'An old code still works here.' },
  { id: 'voice', title: 'Voice activated', hint: 'Talk to the agents. Press / anywhere.' },
  { id: 'outside', title: 'Outside looking in', hint: 'Zoom all the way out from the Core.' },
  { id: 'transmit', title: 'Signal sent', hint: 'Send a message from the Relay.' },
  { id: 'chatty', title: 'Chatterbox', hint: 'Poke a guide until it complains.' },
]

// Agent 404 lives behind the Core and does not like being seen.
export const AGENT_404 = [
  'Eep! You weren’t supposed to see me.',
  'I’m Agent 404. I live where the bugs live. Most of his best work started with me.',
  'Fine, you win. A secret: press / anywhere and you can talk to all of us.',
]

// What a guide says when you keep clicking it.
export const POKES = ['Hi!', 'Yes?', 'Still here.', 'That tickles.', 'Okay, okay, I’m awake!']

export const JOKES = [
  'Why did the voice agent break up with the chatbot? It wanted someone who actually listens.',
  'Why did the RAG system get promoted? It always cited its sources.',
  'I told a joke at 700 milliseconds latency. Nobody laughed. Fifty milliseconds later, everybody did.',
  'How many voice agents does it take to change a light bulb? Sorry, could you repeat that?',
  'My favourite type of model is a full-duplex one. It finishes your sentences. Literally.',
]

// Little nudges an idle agent gives in the hub.
export const IDLE_HINTS = [
  { agent: 'journey', text: 'Psst. Drag the sky around. There’s more back there.' },
  { agent: 'skills', text: 'Scroll out. Way out.' },
  { agent: 'connect', text: 'Someone’s hiding behind the Core…' },
  { agent: 'projects', text: 'Press / and just ask us something.' },
  { agent: 'experience', text: 'Comets are worth catching, by the way.' },
]
