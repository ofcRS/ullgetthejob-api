import { Elysia, t } from 'elysia'
import { proxyToCore } from '../services/core.proxy'
import { logger } from '../utils/logger'
import type { JobSearchRequest } from '../types'

export function registerJobRoutes() {
  return new Elysia({ name: 'job-routes' })
    .post('/api/jobs/search', async ({ body, set }) => {
      const { text, area, experience, employment, schedule } = body as JobSearchRequest

      logger.debug('Job search request', { text, area })

      const response = await proxyToCore({
        path: '/api/jobs/search',
        method: 'POST',
        body: { text, area, experience, employment, schedule },
        retryOptions: {
          maxRetries: 3,
          retryableStatuses: [502, 503, 504],
          onRetry: (attempt, error) => {
            logger.warn('Retrying job search', { attempt, error: error.message })
          }
        }
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

      logger.debug('Fetching job details', { jobId: id })

      const response = await proxyToCore({
        path: `/api/jobs/${encodeURIComponent(id)}`,
        method: 'GET',
        retryOptions: {
          maxRetries: 3,
          retryableStatuses: [502, 503, 504],
          onRetry: (attempt, error) => {
            logger.warn('Retrying job fetch', { attempt, jobId: id, error: error.message })
          }
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


