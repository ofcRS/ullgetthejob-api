import { Elysia } from 'elysia'
import { authService } from '../services/auth.service'

export const authMiddleware = new Elysia()
  .derive(({ headers }) => {
    const authHeader = headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null }
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    const payload = authService.verifyToken(token)

    if (!payload) {
      return { user: null }
    }

    return { user: payload }
  })

export const authenticated = new Elysia()
  .use(authMiddleware)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
  })
