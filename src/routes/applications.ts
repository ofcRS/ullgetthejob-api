import { Elysia, t } from 'elysia'
import { applicationService } from '../services/application.service'

export const applicationRoutes = new Elysia({ prefix: '/applications' })
  .post('/', async ({ user, body }) => {
    if (!user) throw new Error('Unauthorized')
    return await applicationService.createApplication(user.userId, body)
  }, {
    as: 'authenticated',
    body: t.Object({
      jobId: t.String(),
      customCvId: t.Optional(t.String()),
      jobExternalId: t.String(),
      coverLetter: t.Optional(t.String())
    })
  })
  .get('/', async ({ user, query }) => {
    if (!user) throw new Error('Unauthorized')
    return await applicationService.getUserApplications(user.userId, {
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined
    })
  }, {
    as: 'authenticated',
    query: t.Object({
      status: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String())
    })
  })
  .get('/:id', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    const application = await applicationService.getApplication(user.userId, params.id)
    if (!application) throw new Error('Application not found')
    return application
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() })
  })
  .put('/:id', async ({ user, params, body }) => {
    if (!user) throw new Error('Unauthorized')
    const application = await applicationService.updateApplication(user.userId, params.id, body)
    if (!application) throw new Error('Application not found')
    return application
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() }),
    body: t.Object({
      status: t.Optional(t.String()),
      submittedAt: t.Optional(t.Date()),
      responseData: t.Optional(t.Record(t.String(), t.Any())),
      errorMessage: t.Optional(t.String()),
      hhResumeId: t.Optional(t.String()),
      hhNegotiationId: t.Optional(t.String())
    })
  })
  .delete('/:id', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    const success = await applicationService.deleteApplication(user.userId, params.id)
    if (!success) throw new Error('Application not found')
    return { success: true }
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() })
  })
  .post('/:id/submit', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    const application = await applicationService.submitApplication(user.userId, params.id)
    if (!application) throw new Error('Application not found')
    return application
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() })
  })
