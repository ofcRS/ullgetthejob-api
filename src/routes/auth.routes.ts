import { Elysia } from 'elysia'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env'
import { createSession, validateSession, extractSessionCookie, serializeSessionCookie } from '../middleware/session'
import { proxyToCore } from '../services/core.proxy'
import { logger } from '../utils/logger'
import type { OAuthCallbackQuery, OAuthCallbackResponse } from '../types'

const CORE_URL = env.CORE_URL
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export function registerAuthRoutes() {
  return new Elysia({ name: 'auth-routes' })
    .get('/api/auth/hh/login', async () => {
      const res = await proxyToCore({
        path: '/auth/hh/redirect',
        method: 'GET',
        skipSigning: true,
        retryOptions: {
          maxRetries: 2,
          retryableStatuses: [502, 503, 504]
        }
      })
      return await res.json()
    })
    .get('/api/auth/hh/callback', async ({ query, request, set }) => {
      const { code } = query as OAuthCallbackQuery
      if (!code) {
        set.status = 400
        return { success: false, error: 'Missing code' }
      }

      const existingCookieValue = extractSessionCookie(request.headers.get('cookie'))
      const existingSession = await validateSession(existingCookieValue, false)
      const sessionId = existingSession.valid && existingSession.session
        ? existingSession.session.id
        : randomUUID()

      const callbackUrl = new URL(`${CORE_URL}/auth/hh/callback`)
      callbackUrl.searchParams.set('code', code)
      callbackUrl.searchParams.set('session_id', sessionId)

      const res = await proxyToCore({
        path: `/auth/hh/callback?code=${encodeURIComponent(code)}&session_id=${sessionId}`,
        method: 'GET',
        skipSigning: true,
        retryOptions: {
          maxRetries: 2,
          retryableStatuses: [502, 503, 504],
          onRetry: (attempt) => {
            logger.warn('Retrying OAuth callback', { attempt, sessionId })
          }
        }
      })
      const data: OAuthCallbackResponse = await res.json().catch(() => ({ success: false, error: 'Invalid response from core' }))

      // Core now returns a JWT instead of OAuth tokens
      if (res.ok && data?.success && data.jwt) {
        // JWT typically has a standard expiration time (7 days default)
        const ttlMs = 7 * 24 * 60 * 60 * 1000 // 7 days

        const { value, session } = createSession({
          token: data.jwt,
          sessionId,
          ttlMs
        })

        const maxAge = Math.max(Math.floor((session.exp - Date.now()) / 1000), 60)
        set.headers['Set-Cookie'] = serializeSessionCookie(value, {
          maxAge: Math.min(maxAge, SESSION_MAX_AGE_SECONDS),
          secure: env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax'
        })

        data.connected = true
        data.session_id = session.id
      } else if (res.status === 401 || res.status === 403) {
        set.headers['Set-Cookie'] = serializeSessionCookie('', {
          maxAge: 0,
          secure: env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax'
        })
      }

      return data
    })
    .get('/api/auth/hh/status', async ({ request, set }) => {
      const cookieValue = extractSessionCookie(request.headers.get('cookie'))
      const validation = await validateSession(cookieValue)

      if (!validation.valid || !validation.session) {
        set.headers['Set-Cookie'] = serializeSessionCookie('', {
          maxAge: 0,
          secure: env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax'
        })
        return { connected: false }
      }

      try {
        const res = await proxyToCore({
          path: '/api/hh/status',
          method: 'GET',
          token: validation.session.token,
          sessionId: validation.session.id,
          skipSigning: true,
          retryOptions: {
            maxRetries: 2,
            retryableStatuses: [502, 503, 504]
          }
        })

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            set.headers['Set-Cookie'] = serializeSessionCookie('', {
              maxAge: 0,
              secure: env.NODE_ENV === 'production',
              httpOnly: true,
              sameSite: 'lax'
            })
          }
          return { connected: false }
        }

        const status = await res.json().catch(() => ({ connected: true }))
        return { connected: Boolean(status.connected ?? true) }
      } catch (error) {
        console.error('Failed to verify HH status:', error)
        return { connected: false }
      }
    })
    .get('/api/hh/resumes', async ({ request, set }) => {
      const cookieValue = extractSessionCookie(request.headers.get('cookie'))
      const validation = await validateSession(cookieValue)

      if (!validation.valid || !validation.session) {
        set.status = 401
        return { success: false, error: 'HH.ru account not connected' }
      }

      try {
        const res = await proxyToCore({
          path: '/api/hh/resumes',
          method: 'GET',
          token: validation.session.token,
          sessionId: validation.session.id,
          skipSigning: true,
          retryOptions: {
            maxRetries: 3,
            retryableStatuses: [502, 503, 504]
          }
        })

        if (res.status === 401 || res.status === 403) {
          set.headers['Set-Cookie'] = serializeSessionCookie('', {
            maxAge: 0,
            secure: env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'lax'
          })
        }

        set.status = res.status
        return await res.json().catch(() => ({ success: false, error: 'Invalid response from core' }))
      } catch (error) {
        console.error('Failed to load HH resumes:', error)
        set.status = 502
        return { success: false, error: 'Failed to reach core service' }
      }
    })
    .get('/api/hh/resumes/:id', async ({ params, request, set }) => {
      const { id } = params as { id: string }
      const cookieValue = extractSessionCookie(request.headers.get('cookie'))
      const validation = await validateSession(cookieValue)

      if (!validation.valid || !validation.session) {
        set.status = 401
        return { success: false, error: 'HH.ru account not connected' }
      }

      try {
        const res = await proxyToCore({
          path: `/api/hh/resumes/${encodeURIComponent(id)}`,
          method: 'GET',
          token: validation.session.token,
          sessionId: validation.session.id,
          skipSigning: true,
          retryOptions: {
            maxRetries: 3,
            retryableStatuses: [502, 503, 504]
          }
        })

        if (res.status === 401 || res.status === 403) {
          set.headers['Set-Cookie'] = serializeSessionCookie('', {
            maxAge: 0,
            secure: env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'lax'
          })
        }

        set.status = res.status
        return await res.json().catch(() => ({ success: false, error: 'Invalid response from core' }))
      } catch (error) {
        console.error('Failed to load HH resume details:', error)
        set.status = 502
        return { success: false, error: 'Failed to reach core service' }
      }
    })
}


