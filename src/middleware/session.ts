import { sign, unsign } from 'cookie-signature'
import { randomUUID } from 'node:crypto'

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev_session_secret'

if (!process.env.SESSION_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('SESSION_SECRET not set; falling back to insecure development secret')
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
export const SESSION_COOKIE_NAME = 'hh_session'

export interface SessionCookieOptions {
  maxAge?: number
  secure?: boolean
  path?: string
  sameSite?: 'lax' | 'strict' | 'none'
  httpOnly?: boolean
}

export interface SessionPayload {
  id: string
  token: string
  refreshToken?: string
  exp: number
}

interface CreateSessionOptions {
  token: string
  refreshToken?: string
  sessionId?: string
  ttlMs?: number
}

export function createSession({
  token,
  refreshToken,
  sessionId,
  ttlMs
}: CreateSessionOptions) {
  const id = sessionId ?? randomUUID()
  const exp = Date.now() + (ttlMs ?? DEFAULT_TTL_MS)

  const payload: SessionPayload = {
    id,
    token,
    refreshToken,
    exp
  }

  const signed = sign(JSON.stringify(payload), SESSION_SECRET)
  return { value: signed, session: payload }
}

export function validateSession(cookieValue?: string) {
  if (!cookieValue) {
    return { valid: false as const }
  }

  const unsigned = unsign(cookieValue, SESSION_SECRET)
  if (!unsigned) {
    return { valid: false as const }
  }

  try {
    const payload = JSON.parse(unsigned) as SessionPayload

    if (!payload?.exp || payload.exp <= Date.now()) {
      return { valid: false as const, expired: true as const }
    }

    if (!payload.token || !payload.id) {
      return { valid: false as const }
    }

    return { valid: true as const, session: payload }
  } catch (error) {
    console.error('Failed to parse session cookie', error)
    return { valid: false as const }
  }
}

export function serializeSessionCookie(value: string, options: SessionCookieOptions = {}) {
  const segments = [`${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`]

  const maxAge = options.maxAge ?? Math.floor(DEFAULT_TTL_MS / 1000)
  segments.push(`Max-Age=${maxAge}`)

  const path = options.path ?? '/'
  segments.push(`Path=${path}`)

  if (options.httpOnly ?? true) {
    segments.push('HttpOnly')
  }

  const sameSite = (options.sameSite ?? 'lax').toLowerCase()
  segments.push(`SameSite=${capitalize(sameSite)}`)

  if (options.secure) {
    segments.push('Secure')
  }

  return segments.join('; ')
}

export function extractSessionCookie(headerValue?: string | null) {
  if (!headerValue) return undefined

  const cookies = headerValue.split(/;\s*/)
  for (const cookie of cookies) {
    if (!cookie) continue
    const [name, ...rest] = cookie.split('=')
    if (name?.trim() === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return undefined
}

function capitalize(value: string) {
  if (!value) return value
  return value[0].toUpperCase() + value.slice(1)
}

