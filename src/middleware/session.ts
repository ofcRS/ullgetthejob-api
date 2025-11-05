import { sign, unsign } from 'cookie-signature'
import { randomUUID } from 'node:crypto'
import { db } from '../db/client'
import { sessions } from '../db/schema'
import { eq, and, gt, isNull } from 'drizzle-orm'

const SESSION_SECRET = process.env.SESSION_SECRET

if (!SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production')
  }
  throw new Error('SESSION_SECRET environment variable is required for secure session management')
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

export async function validateSession(cookieValue?: string, checkDatabase = true) {
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

    // Check database for session validity
    if (checkDatabase) {
      const [dbSession] = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.sessionId, payload.id),
            gt(sessions.expiresAt, new Date()),
            isNull(sessions.revokedAt)
          )
        )
        .limit(1)

      if (!dbSession) {
        return { valid: false as const, reason: 'session_not_found_or_revoked' as const }
      }

      // Update last activity
      await db
        .update(sessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(sessions.sessionId, payload.id))
    }

    return { valid: true as const, session: payload }
  } catch (error) {
    console.error('Failed to validate session', error)
    return { valid: false as const }
  }
}

export async function createSessionInDb(sessionId: string, token: string, refreshToken: string | undefined, expiresAt: Date, userId?: string | null, metadata?: { ipAddress?: string; userAgent?: string }) {
  try {
    await db.insert(sessions).values({
      sessionId,
      userId: userId ?? null,
      token,
      refreshToken: refreshToken ?? null,
      expiresAt,
      ipAddress: metadata?.ipAddress ?? null,
      userAgent: metadata?.userAgent ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  } catch (error) {
    console.error('Failed to create session in database', error)
    throw new Error('Failed to persist session')
  }
}

export async function revokeSession(sessionId: string) {
  try {
    await db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.sessionId, sessionId))
    return true
  } catch (error) {
    console.error('Failed to revoke session', error)
    return false
  }
}

export async function revokeAllUserSessions(userId: string) {
  try {
    await db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt)
      ))
    return true
  } catch (error) {
    console.error('Failed to revoke user sessions', error)
    return false
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

