import { Elysia, t } from 'elysia'
import { env } from '../config/env'
import { realtime } from '../services/realtime.service'
import { validateSession, extractSessionCookie } from '../middleware/session'
import { logger } from '../utils/logger'

const wsClients = new Set<any>()
const authenticatedSessions = new WeakMap<any, string>() // Map WebSocket to sessionId

export function registerWsRoutes() {
  return new Elysia({ name: 'ws-routes' })
    .ws('/ws', {
      async open(ws) {
        // SECURITY: Authenticate during handshake, not after connection
        // This prevents unauthenticated connections from being established
        try {
          // Extract session cookie from upgrade request headers
          const cookieHeader = ws.data?.headers?.get?.('cookie') || (ws.data as any)?.request?.headers?.cookie
          const cookieValue = extractSessionCookie(cookieHeader)

          const validation = await validateSession(cookieValue)

          if (!validation.valid || !validation.session) {
            logger.warn('WebSocket connection rejected: invalid session', {
              hasSession: !!validation.session,
              expired: 'expired' in validation && validation.expired
            })

            // Close with authentication error code
            ws.close(1008, 'Authentication required')
            return
          }

          // Store authenticated session for this connection
          authenticatedSessions.set(ws.raw, validation.session.id)
          wsClients.add(ws.raw)

          logger.info('WebSocket connection authenticated', {
            sessionId: validation.session.id
          })

          ws.send(JSON.stringify({
            type: 'connected',
            message: 'Ready to receive job updates',
            authenticated: true
          }))
        } catch (error) {
          logger.error('WebSocket authentication error', error as Error)
          ws.close(1011, 'Internal server error')
        }
      },
      message(ws, message) {
        // Verify connection is authenticated before processing messages
        const sessionId = authenticatedSessions.get(ws.raw)
        if (!sessionId) {
          logger.warn('Unauthenticated WebSocket message received')
          ws.close(1008, 'Authentication required')
          return
        }

        try {
          const data = JSON.parse(String(message)) as { type?: string; searchParams?: any; clientId?: string }

          if (data.type === 'register' && data.clientId) {
            realtime.registerClient(data.clientId, ws.raw)
            ws.send(JSON.stringify({ type: 'registered', clientId: data.clientId }))
            logger.debug('WebSocket client registered', { clientId: data.clientId, sessionId })
          } else if (data.type === 'subscribe' && data.searchParams) {
            ws.send(JSON.stringify({ type: 'subscribed', searchParams: data.searchParams }))
            logger.debug('WebSocket subscription created', { sessionId })
          } else {
            ws.send(JSON.stringify({ type: 'echo', message }))
          }
        } catch (error) {
          logger.error('WebSocket message handling error', error as Error, { sessionId })
        }
      },
      close(ws) {
        const sessionId = authenticatedSessions.get(ws.raw)
        authenticatedSessions.delete(ws.raw)
        wsClients.delete(ws.raw)
        realtime.unregisterBySocket(ws.raw)

        if (sessionId) {
          logger.info('WebSocket connection closed', { sessionId })
        }
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


