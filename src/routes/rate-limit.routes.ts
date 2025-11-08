import { Elysia, t } from 'elysia'
import { env } from '../config/env'
import { authMiddleware } from '../middleware/auth'

export function registerRateLimitRoutes() {
  return new Elysia({ name: 'rate-limit-routes' })
    .use(authMiddleware())

    // Get rate limit status from Core
    .get('/api/rate-limit/status', async ({ userId, set }) => {
      try {
        const response = await fetch(`${env.CORE_URL}/api/rate-limit/status?user_id=${userId}`, {
          headers: {
            'X-Core-Secret': env.ORCHESTRATOR_SECRET
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch rate limit status')
        }

        const data = await response.json()
        return {
          success: true,
          rateLimit: data
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch rate limit'
        }
      }
    })
}
