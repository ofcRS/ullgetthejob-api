import { Elysia, t } from 'elysia'
import { env } from '../config/env'
import { realtime } from '../services/realtime.service'
import { validateSession, extractSessionCookie } from '../middleware/session'
import { logger } from '../utils/logger'

const wsClients = new Set<any>()

export function registerWsRoutes() {
  return new Elysia({ name: 'ws-routes' })
    .ws('/ws', {
      async open(ws) {
        // Extract and validate session from cookie header
        const cookieHeader = ws.data.headers?.get?.('cookie') ?? ws.data.headers?.cookie
        const cookieValue = extractSessionCookie(cookieHeader)
        const validation = await validateSession(cookieValue, false)

        if (!validation.valid || !validation.session) {
          logger.warn('WebSocket connection rejected - invalid session')
          ws.close(1008, 'Authentication required')
          return
        }

        // Store user ID in WebSocket data for later use
        ws.data.userId = validation.session.id
        ws.data.sessionId = validation.session.id

        wsClients.add(ws.raw)
        logger.info('WebSocket connection authenticated', { userId: validation.session.id })

        try {
          ws.send(JSON.stringify({
            type: 'connected',
            message: 'Ready to receive job updates',
            userId: validation.session.id
          }))
        } catch (error) {
          logger.error('Failed to send welcome message', error as Error)
        }
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

/**
 * Broadcast application progress during auto-apply
 */
export function broadcastApplicationProgress(
  userId: string,
  data: {
    workflowId: string
    completed: number
    total: number
    currentJob?: string
  }
) {
  const message = JSON.stringify({
    type: 'application_progress',
    data
  })

  realtime.broadcast({ type: 'application_progress', ...data })
}

/**
 * Broadcast rate limit updates
 */
export function broadcastRateLimitUpdate(
  userId: string,
  data: {
    tokens: number
    capacity: number
    nextRefill: string
    canApply: boolean
  }
) {
  const message = JSON.stringify({
    type: 'rate_limit_update',
    data
  })

  realtime.broadcast({ type: 'rate_limit_update', ...data })
}

/**
 * Broadcast application completed
 */
export function broadcastApplicationCompleted(
  userId: string,
  data: {
    jobTitle: string
    company: string
    status: 'success' | 'failed'
    errorMessage?: string
  }
) {
  const message = JSON.stringify({
    type: 'application_completed',
    data
  })

  realtime.broadcast({ type: 'application_completed', ...data })
}

/**
 * Broadcast batch customization progress
 */
export function broadcastCustomizationProgress(
  userId: string,
  data: {
    workflowId: string
    completed: number
    total: number
    currentJob?: string
  }
) {
  const message = JSON.stringify({
    type: 'customization_progress',
    data
  })

  realtime.broadcast({ type: 'customization_progress', ...data })
}


