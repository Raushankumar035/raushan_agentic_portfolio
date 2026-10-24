// Each agent's voice on Sarvam Bulbul v3: one distinct Indian voice per agent.
export const VOICES = {
  skills: { speaker: 'simran', pace: 1.05, gender: 'Female' },
  projects: { speaker: 'rohan', pace: 1.0, gender: 'Male' },
  experience: { speaker: 'kabir', pace: 0.98, gender: 'Male' },
  journey: { speaker: 'pooja', pace: 1.02, gender: 'Female' },
  connect: { speaker: 'shreya', pace: 1.04, gender: 'Female' },
  core: { speaker: 'dev', pace: 1.0, gender: 'Male' },
}

// Lines spoken outside the chapters, pre-rendered too.
export const EXTRA_LINES = [{ agent: 'core', text: 'You’re through to Raushan’s agents. What would you like to know?' }]
