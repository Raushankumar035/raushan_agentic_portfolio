import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// In dev, the same /api routes the production server exposes run inside Vite, reading keys from .env.
function agentApi(env) {
  return {
    name: 'galaxy-api',
    async configureServer(server) {
      const { createApi } = await import(pathToFileURL(path.resolve('server/api.js')).href)
      const api = createApi(env, { dev: true })
      server.middlewares.use(async (req, res, next) => {
        if (!(await api(req, res))) next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [react(), agentApi(env)],
  }
})
