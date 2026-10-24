// The five agents of the galaxy. Order = clockwise slot on the Core's orbit, starting top-left.
// `world` describes each agent's home planet (positions are galaxy space, units ~ metres of nothing).

export const AGENTS = [
  {
    id: 'skills',
    name: 'Skills',
    sub: 'Tools, Tech & More',
    teaser: "I'll show you what he builds with.",
    color: '#a78bfa',
    deep: '#3b1a8f',
    icon: 'code',
    chip: 'bars',
    voice: { pitch: 1.2, rate: 1.05 },
    world: {
      name: 'The Constellation',
      pos: [150, 34, 18],
      radius: 9,
      style: 0, // crystal
      colors: ['#120a33', '#5b21b6', '#c4b5fd', '#67e8f9'],
      atmosphere: '#a78bfa',
      spin: 0.05,
      tilt: 0.3,
    },
  },
  {
    id: 'projects',
    name: 'Projects',
    sub: 'Things He Shipped',
    teaser: 'Let me show you what he builds.',
    color: '#38bdf8',
    deep: '#123a8c',
    icon: 'folder',
    chip: 'folder',
    voice: { pitch: 1.0, rate: 1.04 },
    world: {
      name: 'The Archive Moons',
      pos: [-160, -30, -150],
      radius: 10,
      style: 1, // ocean
      colors: ['#03122e', '#0c4a9e', '#38bdf8', '#e0f2fe'],
      atmosphere: '#38bdf8',
      spin: 0.04,
      tilt: -0.2,
    },
  },
  {
    id: 'journey',
    name: 'Journey',
    sub: 'My Path So Far',
    teaser: 'Walk with me through how he got here.',
    color: '#34d399',
    deep: '#05573f',
    icon: 'plane',
    chip: 'plane',
    voice: { pitch: 1.08, rate: 1.03 },
    world: {
      name: 'The Flight Path',
      pos: [-160, 22, 46],
      radius: 8.5,
      style: 3, // forest
      colors: ['#03231c', '#0f766e', '#34d399', '#d1fae5'],
      atmosphere: '#34d399',
      spin: 0.05,
      tilt: 0.25,
    },
  },
  {
    id: 'connect',
    name: 'Connect',
    sub: "Let's Build Together",
    teaser: "Ready to talk? I'll make the intro.",
    color: '#fb7185',
    deep: '#8c1446',
    icon: 'heart',
    chip: 'people',
    voice: { pitch: 1.28, rate: 1.06 },
    world: {
      name: 'The Relay',
      pos: [24, 46, 175],
      radius: 9,
      style: 4, // rose dunes
      colors: ['#2a0614', '#9f1239', '#fb7185', '#ffe4e6'],
      atmosphere: '#fb7185',
      spin: 0.045,
      tilt: -0.15,
    },
  },
  {
    id: 'experience',
    name: 'Experience',
    sub: 'Internships, Work & Impact',
    teaser: "I'll take you through where he's worked.",
    color: '#fbbf24',
    deep: '#8a3c06',
    icon: 'briefcase',
    chip: 'briefcase',
    voice: { pitch: 0.92, rate: 1.0 },
    world: {
      name: 'The Ring Stations',
      pos: [68, -108, -171],
      radius: 13,
      style: 2, // gas giant
      colors: ['#2b1203', '#9a4d0b', '#fbbf24', '#fef3c7'],
      atmosphere: '#fbbf24',
      spin: 0.03,
      tilt: 0.42,
      ring: true,
    },
  },
]

export const AGENT_INDEX = Object.fromEntries(AGENTS.map((a, i) => [a.id, i]))
export const agentById = (id) => AGENTS[AGENT_INDEX[id]]
