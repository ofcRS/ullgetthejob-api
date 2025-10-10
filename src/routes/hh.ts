import { Elysia, t } from 'elysia'
import { hhService } from '../services/hh.service'
import { authenticated } from '../middleware/auth'

export const hhRoutes = new Elysia({ prefix: '/hh' })
  .use(authenticated)
  .get('/resumes', async ({ user }) => {
    return await hhService.getResumes(user!.userId)
  })
  .get('/resumes/:id', async ({ user, params }) => {
    return await hhService.getResume(params.id)
  }, {
    params: t.Object({ id: t.String() })
  })
  .put('/resumes/:id', async ({ user, params, body }) => {
    return await hhService.updateResume(params.id, body.content)
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ content: t.String() })
  })
  .post('/applications', async ({ user, body }) => {
    return await hhService.submitApplication(body.jobId, body.resumeId, body.coverLetter)
  }, {
    body: t.Object({
      jobId: t.String(),
      resumeId: t.String(),
      coverLetter: t.Optional(t.String())
    })
  })
  .get('/applications/:negotiationId', async ({ user, params }) => {
    return await hhService.getApplicationStatus(params.negotiationId)
  }, {
    params: t.Object({ negotiationId: t.String() })
  })
  .post('/auth/refresh', async ({ user }) => {
    return await hhService.refreshToken()
  })
