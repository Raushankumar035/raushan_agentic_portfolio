import { CanvasTexture, SRGBColorSpace } from 'three'

const cache = new Map()
const FONT = "'Sora Variable', 'Sora', system-ui, sans-serif"

function make(key, w, h, draw, srgb = false) {
  if (cache.has(key)) return cache.get(key)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  draw(g, w, h)
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  cache.set(key, t)
  return t
}

// Same glyphs as the DOM chips (24-unit grid).
export const ICON_PATHS = {
  code: 'M8 6 2 12 8 18 M16 6 22 12 16 18 M13.5 4 10.5 20',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  briefcase: 'M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M3 13h18',
  plane: 'M21 3 3 10.5l7 2.5 2.5 7z M10 13 21 3',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  question: 'M8.6 8.4a3.5 3.5 0 1 1 4.9 3.3c-.9.4-1.5 1.2-1.5 2.2v.6 M12 18.6v.2',
}

export function iconTexture(name) {
  return make(`icon-${name}`, 256, 256, (g, w) => {
    const s = (w / 24) * 0.78
    g.translate(w / 2 - 12 * s, w / 2 - 12 * s)
    g.scale(s, s)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = '#fff'
    const p = new Path2D(ICON_PATHS[name])
    g.shadowColor = 'rgba(255,255,255,0.9)'
    g.shadowBlur = 10
    g.lineWidth = 2.4
    g.stroke(p)
    g.shadowBlur = 0
    g.lineWidth = 2.1
    g.stroke(p)
  })
}

export function glowTexture() {
  return make('glow', 256, 256, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    r.addColorStop(0.6, 'rgba(255,255,255,0.08)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, w, w)
  })
}

export function padTexture() {
  return make('pad', 256, 256, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    r.addColorStop(0, 'rgba(255,255,255,0.55)')
    r.addColorStop(0.55, 'rgba(255,255,255,0.18)')
    r.addColorStop(0.92, 'rgba(255,255,255,0.4)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, w, w)
  })
}

export function hatTexture(color) {
  return make(`hat-${color}`, 128, 128, (g, w, h) => {
    g.fillStyle = '#fff7ed'
    g.fillRect(0, 0, w, h)
    g.fillStyle = color
    for (let k = -2; k < 8; k++) {
      g.beginPath()
      g.moveTo(k * 24, 0)
      g.lineTo(k * 24 + 12, 0)
      g.lineTo(k * 24 + 12 + 40, h)
      g.lineTo(k * 24 + 40, h)
      g.fill()
    }
  }, true)
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

// Holo panel UIs on the robots: white-on-transparent, tinted per agent by the material.
const PANELS = {
  chart(g, w, h) {
    g.lineWidth = 7
    g.beginPath()
    ;[
      [60, 250],
      [130, 190],
      [190, 215],
      [260, 130],
      [330, 160],
      [420, 80],
    ].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.stroke()
    for (let i = 0; i < 7; i++) {
      const bh = 26 + ((i * 37) % 70)
      g.globalAlpha = 0.45 + i * 0.07
      g.fillRect(56 + i * 56, h - 40 - bh, 30, bh)
    }
    g.globalAlpha = 1
  },
  code(g) {
    g.lineWidth = 9
    g.beginPath()
    g.moveTo(110, 120)
    g.lineTo(70, 160)
    g.lineTo(110, 200)
    g.moveTo(170, 120)
    g.lineTo(210, 160)
    g.lineTo(170, 200)
    g.stroke()
    ;[
      [250, 130, 190],
      [250, 175, 140],
      [70, 250, 360],
      [70, 290, 260],
    ].forEach(([x, y, l], i) => {
      g.globalAlpha = 0.85 - i * 0.15
      g.fillRect(x, y, l, 12)
    })
    g.globalAlpha = 1
  },
  image(g, w, h) {
    g.lineWidth = 6
    g.globalAlpha = 0.7
    roundRect(g, 50, 80, w - 100, h - 120, 14)
    g.stroke()
    g.globalAlpha = 1
    g.beginPath()
    g.arc(150, 150, 26, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 8
    g.beginPath()
    g.moveTo(70, h - 60)
    g.lineTo(190, 190)
    g.lineTo(270, 250)
    g.lineTo(340, 200)
    g.lineTo(w - 70, h - 60)
    g.stroke()
  },
  profile(g) {
    g.beginPath()
    g.arc(120, 150, 46, 0, Math.PI * 2)
    g.globalAlpha = 0.7
    g.fill()
    g.beginPath()
    g.arc(120, 290, 78, Math.PI, 0)
    g.globalAlpha = 0.5
    g.fill()
    g.globalAlpha = 1
    ;[
      [210, 120, 220, 16],
      [210, 165, 160, 12],
      [210, 205, 200, 12],
      [210, 245, 120, 12],
    ].forEach(([x, y, l, t], i) => {
      g.globalAlpha = 0.95 - i * 0.18
      g.fillRect(x, y, l, t)
    })
    g.globalAlpha = 1
  },
  map(g, w, h) {
    g.lineWidth = 4
    g.globalAlpha = 0.5
    g.beginPath()
    g.moveTo(40, 100)
    g.lineTo(170, 70)
    g.lineTo(320, 100)
    g.lineTo(w - 40, 70)
    g.lineTo(w - 40, h - 40)
    g.lineTo(320, h - 10)
    g.lineTo(170, h - 40)
    g.lineTo(40, h - 10)
    g.closePath()
    g.stroke()
    g.globalAlpha = 1
    g.lineWidth = 7
    g.setLineDash([4, 16])
    g.beginPath()
    g.moveTo(80, h - 60)
    g.bezierCurveTo(200, h - 70, 160, 200, 280, 190)
    g.bezierCurveTo(380, 180, 340, 120, 380, 110)
    g.stroke()
    g.setLineDash([])
    g.beginPath()
    g.moveTo(380, 150)
    g.bezierCurveTo(350, 110, 340, 80, 380, 60)
    g.bezierCurveTo(420, 80, 410, 110, 380, 150)
    g.fill()
  },
  contact(g, w, h) {
    PANELS.profile(g, w, h)
    g.globalAlpha = 0.9
    roundRect(g, 210, 275, 150, 40, 20)
    g.fill()
    g.globalAlpha = 1
  },
  bars(g, w, h) {
    ;[50, 75, 110, 95, 150, 190, 235].forEach((bh, i) => {
      g.globalAlpha = 0.45 + i * 0.08
      g.fillRect(58 + i * 58, h - 36 - bh, 34, bh)
    })
    g.globalAlpha = 1
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(70, h - 120)
    g.lineTo(200, h - 150)
    g.lineTo(320, h - 210)
    g.lineTo(440, h - 280)
    g.stroke()
  },
}

export function panelTexture(kind) {
  return make(`panel-${kind}`, 512, 352, (g, w, h) => {
    roundRect(g, 6, 6, w - 12, h - 12, 26)
    g.fillStyle = 'rgba(255,255,255,0.09)'
    g.fill()
    g.lineWidth = 5
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.85)'
    ;[34, 56, 78].forEach((x) => {
      g.beginPath()
      g.arc(x, 34, 7, 0, Math.PI * 2)
      g.fill()
    })
    g.fillRect(100, 30, 120, 8)
    g.strokeStyle = '#fff'
    g.fillStyle = '#fff'
    g.lineCap = 'round'
    g.lineJoin = 'round'
    PANELS[kind](g, w, h)
  })
}

// ---------- project holo screens (Projects world) ----------

function text(g, s, x, y, size, weight = 400, alpha = 1, align = 'left') {
  g.globalAlpha = alpha
  g.font = `${weight} ${size}px ${FONT}`
  g.textAlign = align
  g.fillText(s, x, y)
  g.globalAlpha = 1
}

function pill(g, x, y, w, h, label, fill = 0.16) {
  roundRect(g, x, y, w, h, h / 2)
  g.globalAlpha = fill
  g.fill()
  g.globalAlpha = 0.85
  g.lineWidth = 2
  g.stroke()
  g.globalAlpha = 1
  text(g, label, x + w / 2, y + h * 0.68, h * 0.5, 600, 1, 'center')
}

function wave(g, x, y, w, h, seed, n = 46, alpha = 0.9) {
  for (let k = 0; k < n; k++) {
    const t = k / n
    const a = Math.abs(Math.sin(t * 9 + seed) * Math.sin(t * 23 + seed * 2)) * 0.8 + 0.12
    const bh = a * h * Math.sin(Math.PI * t) ** 0.6
    g.globalAlpha = alpha * (0.5 + 0.5 * a)
    roundRect(g, x + t * w, y - bh / 2, (w / n) * 0.55, bh, 3)
    g.fill()
  }
  g.globalAlpha = 1
}

function bubble(g, x, y, w, label, body, right) {
  const h = 74
  roundRect(g, x, y, w, h, 18)
  g.globalAlpha = right ? 0.22 : 0.1
  g.fill()
  g.globalAlpha = 0.7
  g.lineWidth = 2
  g.stroke()
  g.globalAlpha = 1
  text(g, label, x + 20, y + 26, 17, 700, 0.75)
  text(g, body, x + 20, y + 56, 22, 400, 1)
}

const SCREENS = {
  call(g, w, h) {
    // caller
    g.beginPath()
    g.arc(130, 190, 62, 0, Math.PI * 2)
    g.globalAlpha = 0.18
    g.fill()
    g.globalAlpha = 1
    g.lineWidth = 3
    g.stroke()
    text(g, '412', 130, 202, 40, 700, 1, 'center')
    text(g, 'Incoming · Room 412', 220, 168, 30, 600)
    text(g, 'SIP trunk → LiveKit → agent', 220, 206, 22, 400, 0.7)
    wave(g, 220, 262, 560, 70, 1.3)
    pill(g, 800, 140, 170, 44, '712 ms')
    pill(g, 800, 196, 170, 44, 'HI · EN', 0.08)
    bubble(g, 60, 330, 620, 'GUEST', 'Can I get a late checkout tomorrow?', false)
    bubble(g, 340, 420, 620, 'AGENT', 'Done. Checkout moved to 2 PM, Room 412.', true)
    bubble(g, 60, 510, 520, 'TOOL', 'pms.update_checkout(room=412, time=14:00)', false)
  },
  payment(g, w, h) {
    roundRect(g, 60, 120, 420, 440, 26)
    g.globalAlpha = 0.12
    g.fill()
    g.globalAlpha = 0.8
    g.lineWidth = 3
    g.stroke()
    g.globalAlpha = 1
    text(g, 'Payment link', 100, 182, 26, 600, 0.8)
    text(g, '₹ 4,500', 100, 262, 72, 700)
    pill(g, 100, 300, 160, 48, 'PAID ✓')
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 12; c++) {
        if ((r * 7 + c * 13) % 5 < 2) continue
        g.globalAlpha = 0.6
        g.fillRect(100 + c * 28, 390 + r * 26, 20, 18)
      }
    g.globalAlpha = 1
    const steps = [
      ['00:00', 'Order confirmed on the call'],
      ['00:02', 'PayU link created'],
      ['00:03', 'Sent over WhatsApp'],
      ['01:41', 'Paid by caller'],
      ['01:42', 'HubSpot deal → Won'],
    ]
    steps.forEach(([t, s], i) => {
      const y = 170 + i * 84
      g.beginPath()
      g.arc(560, y, 12, 0, Math.PI * 2)
      g.fill()
      if (i < steps.length - 1) g.fillRect(558, y + 14, 4, 58)
      text(g, t, 596, y - 6, 20, 600, 0.6)
      text(g, s, 596, y + 22, 26, 500)
    })
  },
  crm(g, w, h) {
    text(g, 'Transcript', 60, 150, 24, 600, 0.7)
    const lines = [460, 380, 420, 300, 440, 360, 410, 260, 390]
    lines.forEach((l, i) => {
      g.globalAlpha = 0.25 + (i % 3) * 0.15
      roundRect(g, 60, 180 + i * 40, l, 16, 8)
      g.fill()
    })
    g.globalAlpha = 1
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(560, 330)
    g.lineTo(620, 330)
    g.moveTo(600, 310)
    g.lineTo(620, 330)
    g.lineTo(600, 350)
    g.stroke()
    text(g, 'CRM record', 650, 150, 24, 600, 0.7)
    const fields = [
      ['intent', 'booking'],
      ['check-in', '12 Oct'],
      ['guests', '2 adults'],
      ['sentiment', 'positive'],
      ['follow-up', 'send menu'],
    ]
    fields.forEach(([k, v], i) => {
      const y = 196 + i * 72
      roundRect(g, 650, y, 330, 56, 14)
      g.globalAlpha = 0.12
      g.fill()
      g.globalAlpha = 0.6
      g.lineWidth = 2
      g.stroke()
      g.globalAlpha = 1
      text(g, k, 670, y + 36, 19, 500, 0.65)
      text(g, v, 800, y + 36, 22, 700)
      text(g, '✓', 950, y + 37, 24, 700, 0.9)
    })
  },
  rag(g, w, h) {
    bubble(g, 60, 130, 700, 'QUESTION', 'How many days of paid annual leave?', false)
    text(g, 'retrieved evidence', 60, 262, 22, 600, 0.7)
    const rows = [
      ['employee_handbook.md · “24 days of paid annual leave…”', '0.54', 1],
      ['it_security_policy.txt · “Passwords must be…”', '0.21', 0.45],
      ['product_faq.md · “How do I reset my…”', '0.12', 0.3],
    ]
    rows.forEach(([label, score, a], i) => {
      const y = 282 + i * 58
      roundRect(g, 60, y, 740, 46, 14)
      g.globalAlpha = 0.1 * a + 0.04
      g.fill()
      g.globalAlpha = 0.7 * a
      g.lineWidth = 2
      g.stroke()
      g.globalAlpha = 1
      text(g, label, 80, y + 31, 20, 500, 0.95 * a)
      pill(g, 830, y + 3, 130, 40, score, 0.1 * a + 0.04)
    })
    g.setLineDash([8, 8])
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(60, 474)
    g.lineTo(964, 474)
    g.stroke()
    g.setLineDash([])
    text(g, 'similarity gate', 964, 466, 18, 600, 0.7, 'right')
    bubble(g, 60, 490, 904, 'ANSWER', '24 days of paid annual leave per year. [1]   ✓ quote verified', true)
  },
  hybrid(g, w, h) {
    pill(g, 60, 128, 260, 44, 'query', 0.1)
    text(g, 'semantic · Qdrant · BGE-M3', 60, 232, 22, 600, 0.75)
    ;[0.9, 0.7, 0.55, 0.4, 0.3].forEach((v, i) => {
      roundRect(g, 60, 250 + i * 30, 480 * v, 18, 9)
      g.globalAlpha = 0.85 - i * 0.12
      g.fill()
    })
    g.globalAlpha = 1
    text(g, 'keyword · Elasticsearch BM25', 60, 432, 22, 600, 0.75)
    ;[0.8, 0.75, 0.5, 0.45, 0.25].forEach((v, i) => {
      roundRect(g, 60, 450 + i * 30, 480 * v, 18, 9)
      g.globalAlpha = 0.85 - i * 0.12
      g.fill()
    })
    g.globalAlpha = 1
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(570, 330)
    g.lineTo(640, 330)
    g.moveTo(570, 520)
    g.lineTo(640, 520)
    g.moveTo(640, 330)
    g.lineTo(640, 520)
    g.moveTo(640, 425)
    g.lineTo(690, 425)
    g.lineTo(676, 411)
    g.moveTo(690, 425)
    g.lineTo(676, 439)
    g.stroke()
    pill(g, 700, 270, 290, 50, 'RRF fusion', 0.12)
    pill(g, 700, 350, 290, 50, 'rerank', 0.12)
    pill(g, 700, 430, 290, 50, 'Qwen2.5 · Ollama', 0.12)
    text(g, 'cited answer', 845, 540, 22, 600, 0.8, 'center')
  },
  mcp(g, w, h) {
    ;['flights', 'hotels', 'weather', 'itinerary'].forEach((label, i) => {
      pill(g, 60 + i * 232, 128, 208, 46, label, 0.12)
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(164 + i * 232, 176)
      g.lineTo(164 + i * 232, 242)
      g.stroke()
    })
    roundRect(g, 60, 242, 904, 54, 16)
    g.globalAlpha = 0.14
    g.fill()
    g.globalAlpha = 0.8
    g.lineWidth = 2
    g.stroke()
    g.globalAlpha = 1
    text(g, 'MCP · standard tool interface', 512, 277, 26, 700, 1, 'center')
    ;[
      ['Tavily', 'remote MCP'],
      ['AviationStack', 'stdio MCP'],
      ['Weather', 'custom MCP server'],
    ].forEach(([a, b], i) => {
      const x = 60 + i * 312
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(x + 140, 298)
      g.lineTo(x + 140, 342)
      g.stroke()
      roundRect(g, x, 342, 280, 76, 16)
      g.globalAlpha = 0.1
      g.fill()
      g.globalAlpha = 0.7
      g.lineWidth = 2
      g.stroke()
      g.globalAlpha = 1
      text(g, a, x + 20, 376, 26, 700)
      text(g, b, x + 20, 404, 19, 400, 0.7)
    })
    bubble(g, 60, 450, 904, 'PLAN', 'Day 1: fly in, check in near the beach. Weather: 31°C, clear.', true)
  },
  agents(g, w, h) {
    pill(g, 362, 128, 300, 52, 'supervisor', 0.2)
    ;[
      ['info', 'slots'],
      ['booking', 'create'],
      ['cancel', 'remove'],
      ['reschedule', 'move'],
    ].forEach(([a, b], i) => {
      const x = 60 + i * 235
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(512, 182)
      g.bezierCurveTo(512, 240, x + 105, 220, x + 105, 290)
      g.stroke()
      pill(g, x, 290, 210, 50, a, 0.12)
      text(g, `tool: ${b}`, x + 105, 372, 19, 400, 0.7, 'center')
    })
    bubble(g, 60, 420, 620, 'PATIENT', 'Move my Friday slot to Monday, please.', false)
    bubble(g, 340, 510, 624, 'AGENT', 'Done. You are now booked for Monday, 10:30.', true)
  },
  sql(g, w, h) {
    bubble(g, 60, 128, 700, 'QUESTION', 'Who scored the most runs in IPL 2023?', false)
    roundRect(g, 60, 232, 904, 130, 18)
    g.globalAlpha = 0.1
    g.fill()
    g.globalAlpha = 0.7
    g.lineWidth = 2
    g.stroke()
    g.globalAlpha = 1
    text(g, 'SELECT batter, SUM(runs)', 90, 276, 24, 600)
    text(g, 'FROM deliveries WHERE season = 2023', 90, 314, 24, 400, 0.85)
    text(g, 'GROUP BY batter ORDER BY 2 DESC LIMIT 1;', 90, 352, 24, 400, 0.85)
    text(g, 'run on SQLite, compared with the golden result', 60, 410, 22, 600, 0.75)
    ;[
      ['model A', '✓ result matches', 1],
      ['model B', '✗ result differs', 0.5],
      ['model C', '✓ result matches', 1],
    ].forEach(([m, r, a], i) => {
      const y = 434 + i * 54
      roundRect(g, 60, y, 904, 44, 14)
      g.globalAlpha = 0.08 * a + 0.03
      g.fill()
      g.globalAlpha = 0.6 * a
      g.lineWidth = 2
      g.stroke()
      g.globalAlpha = 1
      text(g, m, 84, y + 30, 22, 600, a)
      text(g, r, 940, y + 30, 22, 500, 0.9 * a, 'right')
    })
  },
  reviews(g, w, h) {
    text(g, 'per-topic rating from review text', 60, 150, 24, 600, 0.75)
    pill(g, 610, 118, 354, 44, '14 questions · 7 topics', 0.1)
    ;[
      ['Camera', 0.84, '★★★★☆'],
      ['Battery', 0.58, '★★★☆☆'],
      ['Display', 0.76, '★★★★☆'],
      ['Design', 0.7, '★★★★☆'],
      ['Performance', 0.9, '★★★★★'],
      ['Build quality', 0.52, '★★★☆☆'],
      ['Value for money', 0.66, '★★★★☆'],
    ].forEach(([label, v, stars], i) => {
      const y = 196 + i * 58
      text(g, label, 60, y + 28, 22, 600, 0.9)
      roundRect(g, 290, y + 8, 440, 24, 12)
      g.globalAlpha = 0.14
      g.fill()
      g.globalAlpha = 0.9
      roundRect(g, 290, y + 8, 440 * v, 24, 12)
      g.fill()
      g.globalAlpha = 1
      text(g, stars, 760, y + 30, 26, 500, 0.95)
    })
  },
  duplex(g, w, h) {
    text(g, 'caller', 60, 190, 22, 600, 0.7)
    wave(g, 160, 180, 800, 90, 0.4, 70)
    text(g, 'agent', 60, 330, 22, 600, 0.7)
    wave(g, 160, 320, 800, 90, 2.1, 70, 0.6)
    g.lineWidth = 3
    g.setLineDash([10, 10])
    g.beginPath()
    g.moveTo(560, 120)
    g.lineTo(560, 380)
    g.stroke()
    g.setLineDash([])
    pill(g, 480, 96, 170, 40, 'barge-in')
    text(g, 'GPU', 60, 470, 22, 600, 0.7)
    ;[0.41, 0.66, 0.38, 0.52].forEach((v, i) => {
      roundRect(g, 160 + i * 205, 440, 180, 26, 13)
      g.globalAlpha = 0.15
      g.fill()
      g.globalAlpha = 0.9
      roundRect(g, 160 + i * 205, 440, 180 * v, 26, 13)
      g.fill()
      g.globalAlpha = 1
      text(g, `${Math.round(v * 100)}%`, 160 + i * 205, 500, 20, 500, 0.75)
    })
    text(g, 'listening while speaking', 60, 570, 26, 600)
  },
  dashboard(g, w, h) {
    roundRect(g, 60, 130, 300, 420, 22)
    g.globalAlpha = 0.12
    g.fill()
    g.globalAlpha = 0.8
    g.lineWidth = 3
    g.stroke()
    g.globalAlpha = 1
    text(g, 'Sign in', 90, 190, 30, 700)
    ;[230, 300].forEach((y) => {
      roundRect(g, 90, y, 240, 50, 12)
      g.globalAlpha = 0.5
      g.lineWidth = 2
      g.stroke()
      g.globalAlpha = 1
    })
    pill(g, 90, 380, 240, 52, 'Continue')
    text(g, 'or Google', 210, 480, 20, 500, 0.6, 'center')
    ;[
      [400, 130, 270, 200],
      [690, 130, 280, 200],
      [400, 350, 570, 200],
    ].forEach(([x, y, ww, hh], i) => {
      roundRect(g, x, y, ww, hh, 20)
      g.globalAlpha = 0.1
      g.fill()
      g.globalAlpha = 0.6
      g.lineWidth = 2
      g.stroke()
      g.globalAlpha = 1
      if (i < 2) {
        text(g, i ? 'Sessions' : 'Users', x + 24, y + 46, 22, 600, 0.7)
        text(g, i ? '9.2k' : '1,284', x + 24, y + 120, 54, 700)
      } else {
        g.lineWidth = 5
        g.beginPath()
        ;[0, 1, 2, 3, 4, 5, 6, 7].forEach((k) => {
          const px = x + 30 + k * 72
          const py = y + 160 - (Math.sin(k * 0.9) * 0.4 + 0.5 + k * 0.05) * 110
          k ? g.lineTo(px, py) : g.moveTo(px, py)
        })
        g.stroke()
      }
    })
  },
  galaxy(g, w, h) {
    const cx = w / 2
    const cy = h / 2 + 20
    for (let k = 0; k < 900; k++) {
      const arm = k % 5
      const r = Math.pow((k % 180) / 180, 0.8) * 250
      const a = arm * ((Math.PI * 2) / 5) + r * 0.018 + Math.sin(k * 12.9) * 0.25
      g.globalAlpha = 0.25 + 0.6 * (1 - r / 260)
      g.fillRect(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 0.75, 3, 3)
    }
    g.globalAlpha = 1
    ;[0, 1, 2, 3, 4].forEach((k) => {
      const a = k * ((Math.PI * 2) / 5) + 2.6
      g.beginPath()
      g.arc(cx + Math.cos(a) * 300, cy + Math.sin(a) * 140, 16, 0, Math.PI * 2)
      g.fill()
    })
    g.beginPath()
    g.arc(cx, cy, 34, 0, Math.PI * 2)
    g.fill()
    text(g, 'you are here', cx + 46, cy - 44, 22, 600, 0.85)
  },
  shop(g, w, h) {
    text(g, 'shop', 60, 160, 40, 800)
    pill(g, 820, 116, 160, 50, 'Cart · 1')
    ;[0, 1, 2, 3].forEach((k) => {
      const x = 60 + k * 232
      roundRect(g, x, 200, 210, 330, 18)
      g.globalAlpha = 0.1
      g.fill()
      g.globalAlpha = 0.6
      g.lineWidth = 2
      g.stroke()
      g.globalAlpha = 0.3
      roundRect(g, x + 20, 220, 170, 140, 10)
      g.fill()
      g.globalAlpha = 1
      roundRect(g, x + 20, 380, 150, 14, 7)
      g.fill()
      g.globalAlpha = 0.6
      roundRect(g, x + 20, 404, 100, 12, 6)
      g.fill()
      g.globalAlpha = 1
      text(g, '★★★★☆', x + 20, 448, 20, 400, 0.8)
      text(g, ['₹95,000', '₹1,038', '₹6,299', '₹1,500'][k], x + 20, 500, 26, 700)
    })
    pill(g, 60, 560, 260, 46, 'Proceed to checkout')
  },
}

export function screenTexture(kind) {
  return make(`screen-${kind}`, 1024, 640, (g, w, h) => {
    roundRect(g, 8, 8, w - 16, h - 16, 34)
    g.fillStyle = 'rgba(255,255,255,0.07)'
    g.fill()
    g.lineWidth = 5
    g.strokeStyle = 'rgba(255,255,255,0.9)'
    g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.9)'
    ;[44, 72, 100].forEach((x) => {
      g.beginPath()
      g.arc(x, 46, 9, 0, Math.PI * 2)
      g.fill()
    })
    g.globalAlpha = 0.5
    g.fillRect(130, 42, 160, 9)
    g.globalAlpha = 1
    g.strokeStyle = '#fff'
    g.fillStyle = '#fff'
    g.lineCap = 'round'
    g.lineJoin = 'round'
    SCREENS[kind](g, w, h)
  })
}
