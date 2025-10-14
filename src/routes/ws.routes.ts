import { Elysia, t } from 'elysia'
import { env } from '../config/env'

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
          const data = JSON.parse(String(message)) as { type?: string; searchParams?: any }
          if (data.type === 'subscribe' && data.searchParams) {
            ws.send(JSON.stringify({ type: 'subscribed', searchParams: data.searchParams }))
          } else {
            ws.send(JSON.stringify({ type: 'echo', message }))
          }
        } catch {}
      },
      close() {
        // Remove closed clients
        // Note: ws.raw not available here; Set will be cleaned by broadcast loop on failure
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

      let delivered = 0
      for (const client of wsClients) {
        try {
          client.send(JSON.stringify({ type: 'new_jobs', jobs, stats: data.stats }))
          delivered++
        } catch {
          // drop failed clients silently
          wsClients.delete(client)
        }
      }

      return { ok: true, delivered }
    }, {
      body: t.Object({ jobs: t.Array(t.Any(), { default: [] }), stats: t.Optional(t.Record(t.String(), t.Any())) })
    })
}


