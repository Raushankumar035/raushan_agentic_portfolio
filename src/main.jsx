import { createRoot } from 'react-dom/client'
import '@fontsource-variable/sora'
import './styles.css'
import Classic from './ui/Classic'

// The galaxy needs WebGL2; anything without it (or ?lite) gets the plain résumé page,
// and never downloads the 3D code at all.
function canRender3D() {
  if (new URLSearchParams(location.search).has('lite')) return false
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

const root = createRoot(document.getElementById('root'))
if (canRender3D()) {
  import('./App').then(({ default: App, bootRig }) => {
    bootRig()
    root.render(<App />)
  })
} else {
  document.body.classList.add('is-lite')
  root.render(<Classic standalone />)
}
