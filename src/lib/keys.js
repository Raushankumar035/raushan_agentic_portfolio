// Global keyboard: navigation, shortcuts, and two old codes.
import { useStore } from '../store'
import { backToHub, nextBeat, prevBeat, togglePartyMode, waveAll } from './director'
import { sound } from './sound'
import { voice } from './voice'

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']

export function installKeys() {
  let seq = []
  let typed = ''
  const onKey = (e) => {
    const tag = e.target?.tagName
    const editing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable
    const k = e.key.toLowerCase()
    const s = useStore.getState()

    // the old code works anywhere outside a text field
    if (!editing) {
      seq = [...seq, k].slice(-KONAMI.length)
      if (seq.join() === KONAMI.join()) {
        seq = []
        togglePartyMode()
      }
      if (k.length === 1) {
        typed = (typed + k).slice(-5)
        if (typed === 'hello') waveAll()
      }
    }

    if (k === 'escape') {
      if (s.command) return useStore.setState({ command: false })
      if (s.trophies) return useStore.setState({ trophies: false })
      if (s.classic) return useStore.setState({ classic: false })
      if (s.detail) return s.setDetail(null)
      if (s.phase === 'chapter') return backToHub()
      return
    }
    if (editing || s.command || s.trophies || s.classic) return
    if (k === '/') {
      e.preventDefault()
      useStore.setState({ command: true })
    } else if (k === 'm') {
      sound.init()
      s.setSound(!s.sound)
      if (s.sound) voice.cancel()
    } else if (s.phase === 'chapter') {
      if (k === 'arrowright' || k === 'pagedown') {
        e.preventDefault()
        nextBeat()
      } else if (k === 'arrowleft' || k === 'pageup') {
        e.preventDefault()
        prevBeat()
      }
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}

export function consoleHello() {
  const big = 'font: 600 16px Sora, system-ui; color: #c4b5fd'
  const small = 'font: 13px Sora, system-ui; color: #a3acd0'
  // eslint-disable-next-line no-console
  console.log('%cHey, you opened the console. %cYou’re exactly who the agents hoped would visit.', big, small)
  // eslint-disable-next-line no-console
  console.log('%cA few things to try: press / and ask something · type “hello” · catch a comet · the Konami code still works.', small)
}
