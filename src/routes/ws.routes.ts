import { Elysia, t } from 'elysia'
import { env } from '../config/env'
import { realtime } from '../services/realtime.service'

const wsClients = new Set<any>()

export function registerWsRoutes() {
  return new Elysia({ name: 'ws-routes' })
    .ws('/ws', {
      open(ws) {
        wsClients.add(ws.raw)
        try {
          ws.send(JSON.stringify({ type: 'connected', message: 'Ready to receive job updates' }))
        } catch {}
      },
      message(ws, message) {
        try {
          const data = JSON.parse(String(message)) as { type?: string; searchParams?: any; clientId?: string }
          if (data.type === 'register' && data.clientId) {
            realtime.registerClient(data.clientId, ws.raw)
            ws.send(JSON.stringify({ type: 'registered', clientId: data.clientId }))
          } else if (data.type === 'subscribe' && data.searchParams) {
            ws.send(JSON.stringify({ type: 'subscribed', searchParams: data.searchParams }))
          } else {
            ws.send(JSON.stringify({ type: 'echo', message }))
          }
        } catch {}
      },
      close(ws) {
        realtime.unregisterBySocket(ws.raw)
      }
    })
    .post('/api/v1/jobs/broadcast', ({ headers, body, set }) => {
      const secret = (headers['x-core-secret'] ?? headers['x-orchestrator-secret']) as string | undefined
      if (!secret || secret !== env.ORCHESTRATOR_SECRET) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const data = body as { jobs?: any[]; stats?: any }
      const jobs = data.jobs ?? []

      realtime.broadcast({ type: 'new_jobs', jobs, stats: data.stats })
      return { ok: true }
    }, {
      body: t.Object({
        jobs: t.Array(t.Object({
          id: t.String(),
          externalId: t.String(),
          title: t.String(),
          company: t.Optional(t.String()),
          salary: t.Optional(t.String()),
          area: t.Optional(t.String()),
          url: t.Optional(t.String()),
          description: t.Optional(t.String()),
          source: t.Optional(t.String())
        }), { default: [] }),
        stats: t.Optional(t.Record(t.String(), t.Unknown()))
      })
    })
}


