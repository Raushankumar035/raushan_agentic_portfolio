import { useEffect, useState } from 'react'
import { rig } from '../lib/rig'

// Types a line out like a terminal; screen readers get the whole line at once.
export default function Typed({ text, speed = 22 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (rig.reduce) {
      setN(text.length)
      return
    }
    setN(0)
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) clearInterval(id)
        return Math.min(v + 1, text.length)
      })
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])
  return (
    <>
      <span aria-hidden="true">
        {text.slice(0, n)}
        {n < text.length && <span className="caret" />}
      </span>
      <span className="sr-only">{text}</span>
    </>
  )
}
