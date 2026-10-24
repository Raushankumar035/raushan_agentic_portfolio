// Pre-renders every line the agents narrate with Sarvam Bulbul v3, so browsing the galaxy
// never calls the API at runtime (and plays instantly).
//
//   npm run voices              English narration
//   npm run voices -- hi-IN     English + a Hindi narration track (Sarvam Translate → Bulbul)
//
// Needs SARVAM_API_KEY in the environment or .env. Re-run after editing src/content/chapters.js;
// unchanged lines are skipped. Output: public/voices/<lang>/*.mp3 + public/voices/manifest.json
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { CHAPTERS } from '../src/content/chapters.js'
import { EXTRA_LINES, VOICES } from '../server/voices.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'voices')
const manifestPath = path.join(outDir, 'manifest.json')

for (const line of (fs.existsSync(path.join(root, '.env')) ? fs.readFileSync(path.join(root, '.env'), 'utf8') : '').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
}
const KEY = process.env.SARVAM_API_KEY
if (!KEY) {
  console.error('SARVAM_API_KEY is not set (environment or .env).')
  process.exit(1)
}

const langs = ['en-IN', ...process.argv.slice(2).filter((l) => /^[a-z]{2}-IN$/.test(l) && l !== 'en-IN')]
const lines = [
  ...Object.entries(CHAPTERS).flatMap(([agent, ch]) => ch.beats.map((b) => ({ agent, text: b.say }))),
  ...EXTRA_LINES,
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function sarvam(pathname, body, tries = 4) {
  for (let k = 0; ; k++) {
    const r = await fetch(`https://api.sarvam.ai${pathname}`, {
      method: 'POST',
      headers: { 'api-subscription-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.ok) return r.json()
    const detail = await r.text().catch(() => '')
    if (k < tries - 1 && (r.status === 429 || r.status >= 500)) {
      await sleep(1500 * (k + 1))
      continue
    }
    throw new Error(`${pathname} ${r.status}: ${detail.slice(0, 200)}`)
  }
}

const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {}
const manifest = {}
let made = 0
let reused = 0

for (const lang of langs) {
  manifest[lang] = {}
  fs.mkdirSync(path.join(outDir, lang), { recursive: true })
  const queue = [...lines]
  const worker = async () => {
    while (queue.length) {
      const { agent, text } = queue.shift()
      const v = VOICES[agent] || VOICES.core
      const key = `${agent}|${text}`
      let spoken = text
      if (lang !== 'en-IN') {
        const prev = old[lang]?.[key]
        spoken =
          prev?.src === text
            ? prev.text
            : (
                await sarvam('/translate', {
                  input: text,
                  source_language_code: 'en-IN',
                  target_language_code: lang,
                  model: 'mayura:v1',
                  mode: 'modern-colloquial',
                  speaker_gender: v.gender,
                  numerals_format: 'international',
                })
              ).translated_text
      }
      const hash = crypto.createHash('sha1').update(`${v.speaker}|${v.pace}|${lang}|${spoken}`).digest('hex').slice(0, 16)
      const file = `${lang}/${hash}.mp3`
      const abs = path.join(outDir, file)
      if (fs.existsSync(abs)) reused++
      else {
        const data = await sarvam('/text-to-speech', {
          text: spoken,
          language_code: lang,
          model: 'bulbul:v3',
          speaker: v.speaker,
          pace: v.pace,
          temperature: 0.5,
          speech_sample_rate: 24000,
          output_audio_codec: 'mp3',
        })
        fs.writeFileSync(abs, Buffer.from(data.audios[0], 'base64'))
        made++
        process.stdout.write(`  ${lang} ${agent.padEnd(10)} ${spoken.slice(0, 60)}\n`)
      }
      manifest[lang][key] = { file, text: spoken, src: text }
    }
  }
  await Promise.all([worker(), worker(), worker()])
}

// drop audio no longer referenced
const used = new Set(Object.values(manifest).flatMap((m) => Object.values(m).map((e) => e.file)))
for (const lang of fs.readdirSync(outDir).filter((d) => fs.statSync(path.join(outDir, d)).isDirectory())) {
  for (const f of fs.readdirSync(path.join(outDir, lang))) if (!used.has(`${lang}/${f}`)) fs.unlinkSync(path.join(outDir, lang, f))
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1))
console.log(`voices: ${made} new, ${reused} reused, languages ${langs.join(', ')}`)
