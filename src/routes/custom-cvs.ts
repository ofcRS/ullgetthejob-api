import { Elysia, t } from 'elysia'
import { customCvService } from '../services/custom-cv.service'
import { authenticated } from '../middleware/auth'

export const customCvRoutes = new Elysia({ prefix: '/custom-cvs' })
  .use(authenticated)
  .post('/', async ({ user, body }) => {
    return await customCvService.createCustomCV(body.cvId, {
      jobId: body.jobId,
      jobTitle: body.jobTitle,
      customizedData: body.customizedData,
      coverLetter: body.coverLetter,
      aiSuggestions: body.aiSuggestions
    })
  }, {
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
    return await customCvService.getCustomCVsByUser(user!.userId)
  })
  .get('/:id', async ({ user, params }) => {
    const customCv = await customCvService.getCustomCV(user!.userId, params.id)
    if (!customCv) throw new Error('Custom CV not found')
    return customCv
  }, {
    params: t.Object({ id: t.String() })
  })
  .put('/:id', async ({ user, params, body }) => {
    const customCv = await customCvService.updateCustomCV(user!.userId, params.id, body)
    if (!customCv) throw new Error('Custom CV not found')
    return customCv
  }, {
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
    const success = await customCvService.deleteCustomCV(user!.userId, params.id)
    if (!success) throw new Error('Custom CV not found')
    return { success: true }
  }, {
    params: t.Object({ id: t.String() })
  })
  .post('/:id/analyze', async ({ user, params }) => {
    const customCv = await customCvService.analyzeWithAI(user!.userId, params.id)
    if (!customCv) throw new Error('Custom CV not found')
    return customCv
  }, {
    params: t.Object({ id: t.String() })
  })
