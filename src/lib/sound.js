// Every sound in the galaxy is synthesised here with WebAudio: no audio files.

const PENTA = [0, 2, 4, 7, 9] // major pentatonic, semitones
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
const pentaNote = (root, step) => root + PENTA[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)

class Sound {
  ctx = null
  enabled = true
  timers = []

  init() {
    if (this.ctx) {
      this.ctx.resume?.()
      return
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = (this.ctx = new AC())
    this.master = ctx.createGain()
    this.master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 3
    comp.attack.value = 0.01
    comp.release.value = 0.25
    this.master.connect(comp).connect(ctx.destination)

    this.verb = ctx.createConvolver()
    this.verb.buffer = this.impulse(3.4, 2.6)
    this.verbIn = ctx.createGain()
    this.verbIn.gain.value = 0.42
    this.verbIn.connect(this.verb).connect(this.master)

    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.8
    this.sfx.connect(this.master)
    this.sfx.connect(this.verbIn)

    this.amb = ctx.createGain()
    this.amb.gain.value = 0
    this.amb.connect(this.master)
    this.amb.connect(this.verbIn)

    // agent voices: their own bus with an analyser, so visors and waveforms follow the real audio
    this.voiceGain = ctx.createGain()
    this.voiceGain.gain.value = 1
    this.voiceAnalyser = ctx.createAnalyser()
    this.voiceAnalyser.fftSize = 256
    this.voiceAnalyser.smoothingTimeConstant = 0.5
    this.voiceGain.connect(this.voiceAnalyser).connect(this.master)

    this.noise = this.noiseBuffer(2)
    this.startAmbient()
    this.startWarp()
    this.startHum()
    this.setEnabled(this.enabled)
  }

  impulse(seconds, decay) {
    const ctx = this.ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  noiseBuffer(seconds) {
    const ctx = this.ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    // pinkish: smoothed white noise
    let b = 0
    for (let i = 0; i < len; i++) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1)
      d[i] = b * 6
    }
    return buf
  }

  setEnabled(on) {
    this.enabled = on
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.25)
    this.amb.gain.setTargetAtTime(on ? 1 : 0, t, 1.2)
  }

  get live() {
    return !!this.ctx && this.enabled && this.ctx.state === 'running'
  }

  // Duck the ambient bed while an agent talks.
  duck(on) {
    if (!this.ctx) return
    this.amb.gain.setTargetAtTime(this.enabled ? (on ? 0.35 : 1) : 0, this.ctx.currentTime, on ? 0.08 : 0.6)
  }

  // ---------- beds ----------

  startAmbient() {
    const ctx = this.ctx
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 340
    lp.Q.value = 0.6
    const drone = ctx.createGain()
    drone.gain.value = 0.05
    lp.connect(drone).connect(this.amb)
    ;[
      [45, 'sawtooth', -6],
      [45, 'sawtooth', 7],
      [52, 'triangle', 0],
      [57, 'sine', 3],
    ].forEach(([m, type, det]) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = hz(m - 12)
      o.detune.value = det
      o.connect(lp)
      o.start()
    })
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.045
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 140
    lfo.connect(lfoGain).connect(lp.frequency)
    lfo.start()

    // slow swells and far-off twinkles, scheduled lazily
    const swell = () => {
      if (this.live) {
        const t = ctx.currentTime
        const root = 57
        const steps = [0, 2, 4, 5, 7]
        const n = pentaNote(root, steps[Math.floor(Math.random() * steps.length)])
        this.tone({ f: hz(n), type: 'sine', a: 2.5, d: 5, peak: 0.018, bus: this.amb, at: t })
        this.tone({ f: hz(n + 7), type: 'triangle', a: 3, d: 5, peak: 0.008, bus: this.amb, at: t + 0.4 })
      }
      this.timers.push(setTimeout(swell, 5200 + Math.random() * 5000))
    }
    const twinkle = () => {
      if (this.live) {
        const n = pentaNote(81, Math.floor(Math.random() * 8))
        this.tone({ f: hz(n), type: 'sine', a: 0.01, d: 1.6, peak: 0.012, bus: this.amb })
      }
      this.timers.push(setTimeout(twinkle, 1600 + Math.random() * 3800))
    }
    swell()
    setTimeout(twinkle, 1200)
  }

  startWarp() {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 300
    bp.Q.value = 0.9
    const g = ctx.createGain()
    g.gain.value = 0
    src.connect(bp).connect(g).connect(this.sfx)
    src.start()
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 48
    const sg = ctx.createGain()
    sg.gain.value = 0
    sub.connect(sg).connect(this.sfx)
    sub.start()
    this.warpNodes = { bp, g, sub, sg }
  }

  startHum() {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = 523.25
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = 784.9
    const trem = ctx.createOscillator()
    trem.frequency.value = 5.5
    const tg = ctx.createGain()
    tg.gain.value = 0.5
    const g = ctx.createGain()
    g.gain.value = 0
    const out = ctx.createGain()
    out.gain.value = 0
    trem.connect(tg).connect(g.gain)
    o.connect(g)
    o2.connect(g)
    g.connect(out).connect(this.sfx)
    o.start()
    o2.start()
    trem.start()
    this.humOut = out
  }

  // called every frame with 0..1 values
  update(warp, hum) {
    if (!this.ctx || !this.warpNodes) return
    const t = this.ctx.currentTime
    const w = this.warpNodes
    w.g.gain.setTargetAtTime(warp * 0.22, t, 0.08)
    w.bp.frequency.setTargetAtTime(260 + warp * 2400, t, 0.1)
    w.sg.gain.setTargetAtTime(warp * 0.12, t, 0.1)
    w.sub.frequency.setTargetAtTime(42 + warp * 30, t, 0.1)
    this.humOut.gain.setTargetAtTime(hum * 0.035, t, 0.15)
  }

  // ---------- primitives ----------

  tone({ f, f2, type = 'sine', a = 0.005, d = 0.2, peak = 0.1, at, bus, q }) {
    if (!this.live) return
    const ctx = this.ctx
    const t = at ?? ctx.currentTime
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
    let node = o
    if (q) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = q
      o.connect(lp)
      node = lp
    }
    node.connect(g).connect(bus ?? this.sfx)
    o.start(t)
    o.stop(t + a + d + 0.05)
  }

  burst({ from = 400, to = 3000, dur = 0.6, peak = 0.2, at, q = 1.2 }) {
    if (!this.live) return
    const ctx = this.ctx
    const t = at ?? ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = q
    bp.frequency.setValueAtTime(from, t)
    bp.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6)
    bp.frequency.exponentialRampToValueAtTime(Math.max(80, from * 0.6), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp).connect(g).connect(this.sfx)
    src.start(t, Math.random())
    src.stop(t + dur + 0.05)
  }

  // ---------- vocabulary ----------

  tick() {
    this.tone({ f: 2100, f2: 1500, a: 0.002, d: 0.05, peak: 0.025 })
  }

  click() {
    this.tone({ f: 660, a: 0.003, d: 0.08, peak: 0.05 })
    this.tone({ f: 990, a: 0.003, d: 0.1, peak: 0.04, at: this.ctx && this.ctx.currentTime + 0.05 })
  }

  select(i = 0) {
    if (!this.live) return
    const t = this.ctx.currentTime
    const root = 60 + [0, 2, 4, 7, 9][i % 5]
    ;[0, 4, 7, 12].forEach((s, k) => this.tone({ f: hz(root + s), type: 'triangle', a: 0.005, d: 0.45, peak: 0.05, at: t + k * 0.06 }))
  }

  whoosh(dur = 2.6) {
    if (!this.live) return
    this.burst({ from: 220, to: 2600, dur, peak: 0.14, q: 0.8 })
    this.tone({ f: 70, f2: 160, type: 'sine', a: dur * 0.5, d: dur * 0.5, peak: 0.07 })
  }

  arrive() {
    if (!this.live) return
    const t = this.ctx.currentTime
    ;[57, 64, 69, 76].forEach((m, k) => this.tone({ f: hz(m), type: 'sine', a: 0.4, d: 2.4, peak: 0.03, at: t + k * 0.08 }))
  }

  chirp(pitch = 1, n = 4) {
    if (!this.live) return
    const t = this.ctx.currentTime
    let at = t
    for (let k = 0; k < n; k++) {
      const f = (900 + Math.random() * 1300) * pitch
      const d = 0.04 + Math.random() * 0.07
      this.tone({ f, f2: f * (0.7 + Math.random() * 0.8), type: k % 2 ? 'square' : 'sine', a: 0.004, d, peak: 0.022, at, q: 3200 })
      at += d + 0.015 + Math.random() * 0.03
    }
  }

  note(step) {
    this.tone({ f: hz(pentaNote(69, step)), type: 'sine', a: 0.01, d: 1.1, peak: 0.035 })
    this.tone({ f: hz(pentaNote(69, step) + 12), type: 'sine', a: 0.01, d: 0.5, peak: 0.01 })
  }

  collect() {
    if (!this.live) return
    const t = this.ctx.currentTime
    ;[72, 76, 79, 84, 88].forEach((m, k) => this.tone({ f: hz(m), type: 'triangle', a: 0.004, d: 0.6, peak: 0.05, at: t + k * 0.07 }))
  }

  achievement() {
    if (!this.live) return
    const t = this.ctx.currentTime + 0.05
    ;[60, 64, 67, 71, 74].forEach((m, k) => this.tone({ f: hz(m), type: 'sine', a: 0.05, d: 2.2, peak: 0.035, at: t + k * 0.03 }))
    ;[84, 88, 91].forEach((m, k) => this.tone({ f: hz(m), type: 'triangle', a: 0.005, d: 0.4, peak: 0.02, at: t + 0.25 + k * 0.09 }))
  }

  pop() {
    this.tone({ f: 900, f2: 260, a: 0.004, d: 0.18, peak: 0.07 })
  }

  transmit() {
    if (!this.live) return
    const t = this.ctx.currentTime
    this.tone({ f: 180, f2: 2400, type: 'sawtooth', a: 0.02, d: 0.9, peak: 0.035, q: 2600 })
    this.burst({ from: 600, to: 5000, dur: 1.1, peak: 0.12, at: t + 0.05 })
    this.tone({ f: 70, f2: 38, type: 'sine', a: 0.01, d: 1.2, peak: 0.16, at: t + 0.12 })
  }

  party() {
    if (!this.live) return
    const t = this.ctx.currentTime
    const seq = [72, 76, 79, 76, 81, 79, 84, 88]
    seq.forEach((m, k) => this.tone({ f: hz(m), type: 'square', a: 0.004, d: 0.12, peak: 0.025, at: t + k * 0.11, q: 3000 }))
  }
}

export const sound = new Sound()
