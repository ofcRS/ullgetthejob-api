import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { env } from './config/env'
import { authMiddleware } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { cvRoutes } from './routes/cvs'
import { jobRoutes } from './routes/jobs'
import { applicationRoutes } from './routes/applications'
import { customCvRoutes } from './routes/custom-cvs'
import { hhRoutes } from './routes/hh'

type Job = Record<string, unknown>

// In-memory websocket client registry
const clients = new Set<WebSocket>()

export const app = new Elysia()
  .use(cors({
    origin: (requestOrigin) => {
      if (!requestOrigin) return false
      if (env.ALLOWED_ORIGINS.includes('*')) return true
      return env.ALLOWED_ORIGINS.includes(requestOrigin)
    },
    credentials: true
  }))
  .use(authMiddleware)
  .use(authRoutes)
  .use(cvRoutes)
  .use(jobRoutes)
  .use(applicationRoutes)
  .use(customCvRoutes)
  .use(hhRoutes)
  .get('/api/v1/system/health', () => ({ status: 'ok' }))
  .ws('/ws', {
    open(ws) {
      clients.add(ws.raw)
    },
    message(ws, message) {
      // Echo for smoke testing
      try {
        ws.send(JSON.stringify({ type: 'echo', message }))
      } catch {}
    },
    close(ws) {
      clients.delete(ws.raw)
    }
  })
  .post('/api/v1/jobs/broadcast', ({ headers, body, set }) => {
    const secret = headers['x-orchestrator-secret']
    if (!secret || secret !== env.ORCHESTRATOR_SECRET) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    const data = body as { jobs?: Job[]; stats?: Record<string, unknown> }
    const payload = JSON.stringify({ type: 'new_jobs', jobs: data.jobs ?? [], stats: data.stats ?? {} })

    let delivered = 0
    for (const client of clients) {
      try {
        client.send(payload)
        delivered++
      } catch {}
    }
    return { ok: true, delivered }
  }, {
    body: t.Object({
      jobs: t.Array(t.Any(), { default: [] }),
      stats: t.Optional(t.Record(t.String(), t.Any()))
    })
  })

