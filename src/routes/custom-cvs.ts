import { Elysia, t } from 'elysia'
import { customCvService } from '../services/custom-cv.service'

export const customCvRoutes = new Elysia({ prefix: '/custom-cvs' })
  .post('/', async ({ user, body }) => {
    if (!user) throw new Error('Unauthorized')
    return await customCvService.createCustomCV(body.cvId, {
      jobId: body.jobId,
      jobTitle: body.jobTitle,
      customizedData: body.customizedData,
      coverLetter: body.coverLetter,
      aiSuggestions: body.aiSuggestions
    })
  }, {
    as: 'authenticated',
    body: t.Object({
      cvId: t.String(),
      jobId: t.Optional(t.String()),
      jobTitle: t.Optional(t.String()),
      customizedData: t.Optional(t.Record(t.String(), t.Any())),
      coverLetter: t.Optional(t.String()),
      aiSuggestions: t.Optional(t.Record(t.String(), t.Any()))
    })
  })
  .get('/', async ({ user }) => {
    if (!user) throw new Error('Unauthorized')
    return await customCvService.getCustomCVsByUser(user.userId)
  }, { as: 'authenticated' })
  .get('/:id', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    const customCv = await customCvService.getCustomCV(user.userId, params.id)
    if (!customCv) throw new Error('Custom CV not found')
    return customCv
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() })
  })
  .put('/:id', async ({ user, params, body }) => {
    if (!user) throw new Error('Unauthorized')
    const customCv = await customCvService.updateCustomCV(user.userId, params.id, body)
    if (!customCv) throw new Error('Custom CV not found')
    return customCv
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() }),
    body: t.Object({
      jobId: t.Optional(t.String()),
      jobTitle: t.Optional(t.String()),
      customizedData: t.Optional(t.Record(t.String(), t.Any())),
      coverLetter: t.Optional(t.String()),
      aiSuggestions: t.Optional(t.Record(t.String(), t.Any()))
    })
  })
  .delete('/:id', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    const success = await customCvService.deleteCustomCV(user.userId, params.id)
    if (!success) throw new Error('Custom CV not found')
    return { success: true }
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() })
  })
  .post('/:id/analyze', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    const customCv = await customCvService.analyzeWithAI(user.userId, params.id)
    if (!customCv) throw new Error('Custom CV not found')
    return customCv
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() })
  })
