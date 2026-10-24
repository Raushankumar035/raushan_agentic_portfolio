# Raushan Kumar · A Galaxy of Agents

An interactive portfolio for an Agentic AI Engineer. Five AI agents orbit the Core (that's me).
Pick one and it flies you to its own world and tells its part of the story:

| Agent | World | What it shows |
| --- | --- | --- |
| **Skills** | The Constellation | Five constellations (Voice AI, Agentic AI, GenAI & RAG, Backend, Cloud & Reliability). Every skill is a star, brighter = used more. Includes a live voice pipeline you can talk to. |
| **Projects** | The Archive Moons | Eight moons: Hotel Voice Agent, Hybrid RAG, Reliable RAG API, TripMate AI, Dental Appointment Agents, IPL Text-to-SQL Eval, Support Ticket Triage, Smartphone Review Analyzer. Each opens a holo-screen and a case study. |
| **Experience** | The Ring Stations | GIT Software Technologies (voice agent, hybrid RAG) and the MCA. |
| **Journey** | The Flight Path | 2020 to now, beacon by beacon. |
| **Connect** | The Relay | Write a message and the relay opens your mail app. |

## Run it

```bash
npm install
cp .env.example .env   # add SARVAM_API_KEY and GROQ_API_KEY for the live voice agent
npm run dev            # http://localhost:5173 (the /api routes run inside Vite)
```

## Run it in Docker (recommended for deploying)

```bash
cp .env.example .env   # fill in SARVAM_API_KEY and GROQ_API_KEY
docker compose up --build -d
# site + API on http://localhost:8787
```

One container builds the site and serves it together with the `/api` routes. Keys stay on the server.
On Render, `render.yaml` defines the same thing as a single Docker web service.

## The live voice agent (Sarvam + Groq GPT-OSS 120B)

| Hop | With keys | Without keys |
| --- | --- | --- |
| Ears | **Sarvam Saaras** speech-to-text, auto-detects Indian languages, `codemix` for Hinglish | Browser speech recognition |
| Brain | **Groq · `openai/gpt-oss-120b`** (falls back to `openai/gpt-oss-20b` on rate limits), JSON output with an action that can fly the visitor to any world or step | Small local intent router |
| Voice | **Sarvam Bulbul v3**, a distinct Indian voice per agent; visors and waveforms follow the real audio | Browser speech engine |

- Press `/` anywhere (or the mic in the top bar): type, tap to talk, or start a hands-free call.
- The brain's prompt is built from `src/content`, so it only knows what the site says.
- Change models with `LLM_MODEL` in `.env` (comma separated, tried in order).
- Per-visitor rate limits, a daily cap (`DAILY_LIMIT`) and an origin allow-list protect your free tiers.

### Pre-rendered narration (do this once)

`public/voices/` is empty on purpose: the old narration belonged to the original portfolio. Generate yours:

```bash
npm run voices            # every chapter line in each agent's Sarvam voice → public/voices/
npm run voices -- hi-IN   # plus a Hindi track; adds an EN/हिं toggle
```

Commit `public/voices/`. Re-run after editing `src/content/chapters.js` (unchanged lines are skipped).
Until you do, narration is synthesised live through `/api/tts` (needs the key) or the browser voice.

## Make it yours

All the words live in `src/content/`:

- `profile.js`: name, email, GitHub, LinkedIn, headline, stats, education, certifications
- `skills.js`: the five constellations and their stars (level 1-5), `LEARNING`
- `projects.js`: the eight project moons, plus the hidden early-ML moon
- `experience.js`: ring stations and "how he works" principles
- `journey.js`: milestones on the flight path
- `chapters.js`: what each agent says (short lines, they're read aloud)
- `secrets.js`: hidden signals, achievements and easter eggs

Things worth reviewing before you share it:

- **Portrait.** `public/portrait.webp` is an "RK" monogram placeholder. Replace it with a square photo, then in
  `src/three/Core.jsx` set `PORTRAIT.crop` (try `[0.13, 0.19, 0.74, 0.74]`) and `grade` (try `0.8` for a plain backdrop).
- **Link previews.** In `index.html`, change `og:image` and `twitter:image` to absolute URLs on your domain.
- **Phone number.** It is deliberately not on the site. Add it to `profile.js` and `cards.jsx` if you want it.
- **Numbers.** The stats ("1 yr", "8 projects", "4 certifications") come from your résumé and repo list. The bars on the
  Experience stations are decorative scales; edit them freely.
- **Project dates.** Open-source projects are marked 2026; correct them in `projects.js` if the dates are different.

## How it's built

three.js through React Three Fiber (shader-painted planets, a ~60k-star galaxy in one draw call), one camera rig with
spring-damped moves (`src/lib/director.js`), WebAudio-synthesised sound, adaptive resolution, and a plain résumé view
(`Résumé` in the top bar, or `?lite`) for recruiters in a hurry and for browsers without WebGL2.
Keyboard: ←/→, Esc, `/`, `M`.

## Hidden things (spoilers)

<details>
<summary>Reveal</summary>

- Six lost signals: one behind the Core (drag the view), one in each world.
- Agent 404 hides behind the Core. Catch it three times.
- Comets cross the hub sky. Click one.
- A tiny gold moon in the Archive holds your earliest ML project.
- Zoom all the way out from the Core: your initials, RK, are drawn in the stars.
- The Konami code gives every agent a party hat. Typing `hello` makes them wave.
- Eleven achievements in total (trophy icon, top right).

</details>
