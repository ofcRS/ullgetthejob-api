import { Elysia } from 'elysia'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env'
import { createSession, validateSession, SESSION_COOKIE_NAME } from '../middleware/session'

const CORE_URL = env.CORE_URL
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

type SessionCookieHandle = {
  value?: string
  set?: (options: {
    value: string
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'lax' | 'strict' | 'none'
    path?: string
    maxAge?: number
  }) => void
  remove?: () => void
}

const getSessionCookie = (cookie: Record<string, unknown> | undefined) =>
  cookie?.[SESSION_COOKIE_NAME] as SessionCookieHandle | undefined

export function registerAuthRoutes() {
  return new Elysia({ name: 'auth-routes' })
    .get('/api/auth/hh/login', async () => {
      const res = await fetch(`${CORE_URL}/auth/hh/redirect`)
      return await res.json()
    })
    .get('/api/auth/hh/callback', async ({ query, cookie, set }) => {
      const code = (query as any)?.code as string | undefined
      if (!code) {
        set.status = 400
        return { success: false, error: 'Missing code' }
      }

      const sessionCookie = getSessionCookie(cookie)
      const existingSession = validateSession(sessionCookie?.value)
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

        sessionCookie?.set?.({
          value,
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: Math.min(maxAge, SESSION_MAX_AGE_SECONDS)
        })

        data.connected = true
        data.session_id = session.id
      } else if (res.status === 401 || res.status === 403) {
        sessionCookie?.remove?.()
      }

      return data
    })
    .get('/api/auth/hh/status', async ({ cookie }) => {
      const sessionCookie = getSessionCookie(cookie)
      const validation = validateSession(sessionCookie?.value)

      if (!validation.valid || !validation.session) {
        sessionCookie?.remove?.()
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
            sessionCookie?.remove?.()
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
    .get('/api/hh/resumes', async ({ cookie, set }) => {
      const sessionCookie = getSessionCookie(cookie)
      const validation = validateSession(sessionCookie?.value)

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
          sessionCookie?.remove?.()
        }

        set.status = res.status
        return await res.json().catch(() => ({ success: false, error: 'Invalid response from core' }))
      } catch (error) {
        console.error('Failed to load HH resumes:', error)
        set.status = 502
        return { success: false, error: 'Failed to reach core service' }
      }
    })
    .get('/api/hh/resumes/:id', async ({ params, cookie, set }) => {
      const id = (params as any).id
      const sessionCookie = getSessionCookie(cookie)
      const validation = validateSession(sessionCookie?.value)

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
          sessionCookie?.remove?.()
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


