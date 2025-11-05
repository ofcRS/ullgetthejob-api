/**
 * Authentication middleware for protected routes
 */

import { Elysia } from 'elysia'
import { validateSession, extractSessionCookie, serializeSessionCookie } from './session'
import { env } from '../config/env'
import { logger } from '../utils/logger'
import type { SessionPayload } from '../types'

/**
 * Authentication result with user context
 */
export interface AuthContext {
  session: SessionPayload
  userId: string | null
}

/**
 * Authentication middleware that validates session and attaches user context
 */
export function authMiddleware() {
  return new Elysia({ name: 'auth-middleware' })
    .derive(async ({ request, set }) => {
      const cookieValue = extractSessionCookie(request.headers.get('cookie'))
      const validation = await validateSession(cookieValue)

      if (!validation.valid || !validation.session) {
        logger.warn('Unauthorized access attempt', {
          path: new URL(request.url).pathname,
          hasSession: !!validation.session,
          expired: 'expired' in validation && validation.expired
        })

        set.status = 401
        set.headers['Set-Cookie'] = serializeSessionCookie('', {
          maxAge: 0,
          secure: env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax'
        })

        throw new Error('Authentication required')
      }

      // Attach auth context to request
      const authContext: AuthContext = {
        session: validation.session,
        userId: validation.session.id // For now, use session ID as user ID
      }

      logger.debug('Request authenticated', {
        sessionId: validation.session.id,
        path: new URL(request.url).pathname
      })

      return authContext
    })
}

/**
 * Optional authentication middleware - doesn't throw if no session
 */
export function optionalAuthMiddleware() {
  return new Elysia({ name: 'optional-auth-middleware' })
    .derive(async ({ request }) => {
      const cookieValue = extractSessionCookie(request.headers.get('cookie'))
      const validation = await validateSession(cookieValue)

      if (validation.valid && validation.session) {
        const authContext: AuthContext = {
          session: validation.session,
          userId: validation.session.id
        }
        return authContext
      }

      // No session - return null context
      return {
        session: null,
        userId: null
      } as { session: null; userId: null }
    })
}

/**
 * Check if user has permission to access a resource
 */
export function checkResourceOwnership(resourceUserId: string | null, currentUserId: string | null): boolean {
  // If resource has no owner (userId is null), allow access for now (MVP behavior)
  if (resourceUserId === null) {
    logger.warn('Resource accessed with no owner', { resourceUserId, currentUserId })
    return true // Allow for backward compatibility
  }

  // Check ownership
  return resourceUserId === currentUserId
}

/**
 * Middleware to verify resource ownership
 */
export function requireOwnership(getResourceUserId: (context: any) => Promise<string | null>) {
  return async (context: any) => {
    const { userId } = context as AuthContext
    const resourceUserId = await getResourceUserId(context)

    if (!checkResourceOwnership(resourceUserId, userId)) {
      logger.warn('Unauthorized resource access attempt', {
        userId,
        resourceUserId,
        path: new URL(context.request.url).pathname
      })

      context.set.status = 403
      throw new Error('Forbidden: You do not have access to this resource')
    }
  }
}
