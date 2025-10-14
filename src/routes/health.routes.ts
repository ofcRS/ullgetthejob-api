import { Elysia } from 'elysia'

export function registerHealthRoutes() {
  return new Elysia({ name: 'health-routes' })
    .get('/api/health', () => ({
      status: 'ok',
      service: 'UllGetTheJob API',
      features: ['cv-parsing', 'ai-customization', 'job-fetching', 'websocket']
    }))
}


