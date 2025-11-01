import { Elysia, t } from 'elysia'
import { env } from '../config/env'

export function registerJobRoutes() {
  return new Elysia({ name: 'job-routes' })
    .post('/api/jobs/search', async ({ body, set }) => {
      const { text, area, experience, employment, schedule } = body as {
        text: string
        area?: string
        experience?: string
        employment?: string
        schedule?: string
      }

      const response = await fetch(`${env.CORE_URL}/api/jobs/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Core-Secret': env.ORCHESTRATOR_SECRET
        },
        body: JSON.stringify({ text, area, experience, employment, schedule })
      })

      if (!response.ok) {
        const errorText = await response.text()
        set.status = 502
        return { success: false, error: `Phoenix Core error: ${response.status} - ${errorText}`, jobs: [] }
      }

      const data = await response.json()
      return { success: true, jobs: data.jobs || [], total: data.jobs?.length || 0 }
    }, {
      body: t.Object({
        text: t.String(),
        area: t.Optional(t.String()),
        experience: t.Optional(t.String()),
        employment: t.Optional(t.String()),
        schedule: t.Optional(t.String())
      })
    })
    .get('/api/jobs/:id', async ({ params, set }) => {
      const { id } = params as { id: string }

      const response = await fetch(`${env.CORE_URL}/api/jobs/${encodeURIComponent(id)}`, {
        headers: {
          'X-Core-Secret': env.ORCHESTRATOR_SECRET
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        set.status = response.status === 404 ? 404 : 502
        return { success: false, error: `Phoenix Core error: ${response.status} - ${errorText}` }
      }

      const data = await response.json()
      return { success: true, job: data.job }
    })
}


