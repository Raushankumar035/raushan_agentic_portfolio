// The ears: records one utterance from the mic and stops on its own when you stop talking.
// A small energy-based VAD calibrates to the room, waits for speech, then ends after a pause.
// The live levels feed rig.audio so the 3D waveform moves with your voice.
import { rig } from './rig'

const MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export const canRecord = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

let active = null

export function stopRecording() {
  active?.finish()
}

// Resolves to { blob, speech, endedAt } (endedAt = when speech stopped, for latency maths).
export async function recordUtterance({ maxMs = 14000, silenceMs = 700, waitMs = 7000, onLevel } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()
  const src = ctx.createMediaStreamSource(stream)
  const an = ctx.createAnalyser()
  an.fftSize = 512
  an.smoothingTimeConstant = 0.6
  src.connect(an)
  const time = new Uint8Array(an.fftSize)
  const freq = new Uint8Array(an.frequencyBinCount)
  const mimeType = MIME.find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
  const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined)
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)

  return new Promise((resolve, reject) => {
    const t0 = performance.now()
    let floor = 0.01
    let samples = 0
    let speech = false
    let lastVoice = 0
    let endedAt = 0
    let raf = 0
    let done = false

    const cleanup = () => {
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((t) => t.stop())
      ctx.close()
      rig.audio.live = false
      rig.audio.level = 0
      rig.audio.bins.fill(0)
      active = null
    }
    const finish = () => {
      if (done) return
      done = true
      endedAt = endedAt || performance.now()
      if (rec.state !== 'inactive') rec.stop()
      else {
        cleanup()
        resolve({ blob: null, speech: false, endedAt })
      }
    }
    rec.onstop = () => {
      cleanup()
      resolve({ blob: speech ? new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) : null, speech, endedAt })
    }
    rec.onerror = (e) => {
      cleanup()
      reject(e.error || new Error('recorder failed'))
    }
    active = { finish }

    const tick = () => {
      if (done) return
      const now = performance.now()
      an.getByteTimeDomainData(time)
      let sum = 0
      for (let k = 0; k < time.length; k++) {
        const v = (time[k] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / time.length)
      // learn the room's noise for the first ~300 ms
      if (now - t0 < 300) {
        floor = (floor * samples + rms) / (samples + 1)
        samples++
      }
      const threshold = Math.max(0.018, floor * 2.6)
      if (rms > threshold) {
        if (!speech) speech = true
        lastVoice = now
      }
      an.getByteFrequencyData(freq)
      const bins = rig.audio.bins
      for (let k = 0; k < bins.length; k++) bins[k] = freq[Math.min(freq.length - 1, 2 + Math.floor(Math.pow(k / bins.length, 1.5) * 80))] / 255
      rig.audio.level = rms
      rig.audio.live = true
      onLevel?.(Math.min(1, rms * 6), speech)

      if (speech && now - lastVoice > silenceMs) {
        endedAt = lastVoice
        return finish()
      }
      if (!speech && now - t0 > waitMs) return finish()
      if (now - t0 > maxMs) return finish()
      raf = requestAnimationFrame(tick)
    }
    rec.start(250)
    tick()
  })
}
