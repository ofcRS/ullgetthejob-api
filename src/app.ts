import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { cookie } from '@elysiajs/cookie'
import { env } from './config/env'
import { errorHandler } from './middleware/error-handler'
import { registerHealthRoutes } from './routes/health.routes'
import { registerModelRoutes } from './routes/model.routes'
import { registerCvRoutes } from './routes/cv.routes'
import { registerJobRoutes } from './routes/job.routes'
import { registerApplicationRoutes } from './routes/application.routes'
import { registerWsRoutes } from './routes/ws.routes'
import { registerAuthRoutes } from './routes/auth.routes'

export const app = new Elysia()
  .use(cors({
    origin: (request: Request) => {
      const requestOrigin = request.headers.get('origin')
      if (!requestOrigin) return false
      if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) return true
      if (env.ALLOWED_ORIGINS.includes('*')) return true
      return env.ALLOWED_ORIGINS.includes(requestOrigin)
    },
    credentials: true
  }))
  .use(cookie())
  .use(errorHandler())

  // Health and basic info
  .use(registerHealthRoutes())

  // Feature routes
  .use(registerModelRoutes())
  .use(registerCvRoutes())
  .use(registerJobRoutes())
  .use(registerApplicationRoutes())
  .use(registerAuthRoutes())

  // Realtime + broadcasts
  .use(registerWsRoutes())

  // Final error handling
  .onError(({ code, error, set }) => {
    console.error('Server error:', code, error)
    if (code === 'VALIDATION') {
      set.status = 400
      return { success: false, error: 'Validation error' }
    }
    set.status = 500
    return { success: false, error: error instanceof Error ? error.message : 'Internal server error' }
  })

export type AppType = typeof app


