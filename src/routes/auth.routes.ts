import { Elysia } from 'elysia'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env'
import { createSession, validateSession, extractSessionCookie, serializeSessionCookie } from '../middleware/session'

const CORE_URL = env.CORE_URL
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export function registerAuthRoutes() {
  return new Elysia({ name: 'auth-routes' })
    .get('/api/auth/hh/login', async () => {
      const res = await fetch(`${CORE_URL}/auth/hh/redirect`)
      return await res.json()
    })
    .get('/api/auth/hh/callback', async ({ query, request, set }) => {
      const code = (query as any)?.code as string | undefined
      if (!code) {
        set.status = 400
        return { success: false, error: 'Missing code' }
      }

      const existingCookieValue = extractSessionCookie(request.headers.get('cookie'))
      const existingSession = validateSession(existingCookieValue)
      const sessionId = existingSession.valid && existingSession.session
        ? existingSession.session.id
        : randomUUID()

      const callbackUrl = new URL(`${CORE_URL}/auth/hh/callback`)
      callbackUrl.searchParams.set('code', code)
      callbackUrl.searchParams.set('session_id', sessionId)

      const res = await fetch(callbackUrl.toString())
      const data = await res.json().catch(() => ({ success: false, error: 'Invalid response from core' }))

      if (res.ok && data?.success && data.tokens?.access_token) {
        let ttlMs: number | undefined
        const expiresAtRaw = data.tokens.expires_at || data.tokens.expiresAt
        if (expiresAtRaw) {
          const expiresAtMs = new Date(expiresAtRaw).getTime()
          if (!Number.isNaN(expiresAtMs)) {
            ttlMs = Math.max(expiresAtMs - Date.now(), 60_000)
          }
        }

        const { value, session } = createSession({
          token: data.tokens.access_token,
          refreshToken: data.tokens.refresh_token,
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
      const validation = validateSession(cookieValue)

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
        const res = await fetch(`${CORE_URL}/api/hh/status`, {
          headers: {
            Authorization: `Bearer ${validation.session.token}`,
            'X-Session-Id': validation.session.id
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
      const validation = validateSession(cookieValue)

      if (!validation.valid || !validation.session) {
        set.status = 401
        return { success: false, error: 'HH.ru account not connected' }
      }

      try {
        const res = await fetch(`${CORE_URL}/api/hh/resumes`, {
          headers: {
            Authorization: `Bearer ${validation.session.token}`,
            'X-Session-Id': validation.session.id
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
      const id = (params as any).id
      const cookieValue = extractSessionCookie(request.headers.get('cookie'))
      const validation = validateSession(cookieValue)

      if (!validation.valid || !validation.session) {
        set.status = 401
        return { success: false, error: 'HH.ru account not connected' }
      }

      try {
        const res = await fetch(`${CORE_URL}/api/hh/resumes/${encodeURIComponent(id)}`, {
          headers: {
            Authorization: `Bearer ${validation.session.token}`,
            'X-Session-Id': validation.session.id
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


