import { Elysia, t } from 'elysia'
import { hhService } from '../services/hh.service'

export const hhRoutes = new Elysia({ prefix: '/hh' })
  .get('/resumes', async ({ user }) => {
    if (!user) throw new Error('Unauthorized')
    return await hhService.getResumes(user.userId)
  }, { as: 'authenticated' })
  .get('/resumes/:id', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    return await hhService.getResume(params.id)
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() })
  })
  .put('/resumes/:id', async ({ user, params, body }) => {
    if (!user) throw new Error('Unauthorized')
    return await hhService.updateResume(params.id, body.content)
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() }),
    body: t.Object({ content: t.String() })
  })
  .post('/applications', async ({ user, body }) => {
    if (!user) throw new Error('Unauthorized')
    return await hhService.submitApplication(body.jobId, body.resumeId, body.coverLetter)
  }, {
    as: 'authenticated',
    body: t.Object({
      jobId: t.String(),
      resumeId: t.String(),
      coverLetter: t.Optional(t.String())
    })
  })
  .get('/applications/:negotiationId', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    return await hhService.getApplicationStatus(params.negotiationId)
  }, {
    as: 'authenticated',
    params: t.Object({ negotiationId: t.String() })
  })
  .post('/auth/refresh', async ({ user }) => {
    if (!user) throw new Error('Unauthorized')
    return await hhService.refreshToken()
  }, { as: 'authenticated' })
