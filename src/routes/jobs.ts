import { Elysia, t } from 'elysia'
import { jobService } from '../services/job.service'

export const jobRoutes = new Elysia({ prefix: '/jobs' })
  .get('/', async ({ query }) => {
    return await jobService.getJobs({
      search: query.search,
      area: query.area,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined
    })
  }, {
    query: t.Object({
      search: t.Optional(t.String()),
      area: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String())
    })
  })
  .get('/statistics', async () => {
    return await jobService.getStatistics()
  })
  .get('/:id', async ({ params }) => {
    const job = await jobService.getJob(params.id)
    if (!job) throw new Error('Job not found')
    return job
  }, {
    params: t.Object({ id: t.String() })
  })
