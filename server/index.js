// Production server: serves the built site from dist/ and the /api routes, with no dependencies.
//   npm run build && npm start
// Set SERVE_STATIC=false to run it as an API-only service next to a static host.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi } from './api.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
loadDotEnv(path.join(root, '.env'))

const api = createApi(process.env)
const serveStatic = process.env.SERVE_STATIC !== 'false'
const port = Number(process.env.PORT || 8787)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

function sendFile(res, file, cache) {
  const type = TYPES[path.extname(file)] || 'application/octet-stream'
  res.statusCode = 200
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', cache)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  fs.createReadStream(file).pipe(res)
}

const server = http.createServer(async (req, res) => {
  if (await api(req, res)) return
  if (!serveStatic) {
    res.statusCode = 404
    return res.end('not found')
  }
  const url = new URL(req.url, 'http://local')
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
  const file = path.join(dist, rel)
  if (!file.startsWith(dist)) {
    res.statusCode = 400
    return res.end()
  }
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) {
      const immutable = rel.startsWith('assets/') || rel.startsWith('voices/')
      return sendFile(res, file, immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300')
    }
    // single-page app: everything else is the galaxy
    sendFile(res, path.join(dist, 'index.html'), 'no-cache')
  })
})

server.listen(port, () => {
  const h = []
  if (process.env.SARVAM_API_KEY) h.push('Sarvam speech')
  if (process.env.GROQ_API_KEY || process.env.XAI_API_KEY || process.env.LLM_API_KEY) h.push('LLM')
  console.log(`galaxy on :${port}${serveStatic ? ' (site + api)' : ' (api only)'} · ${h.length ? h.join(' + ') : 'no keys: browser fallbacks only'}`)
})

// Minimal .env reader so `npm start` works locally without extra packages. Real env vars win.
function loadDotEnv(file) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m || process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}
