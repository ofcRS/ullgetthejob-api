import { Elysia, t } from 'elysia'
import { cvService } from '../services/cv.service'
import { fileUploadService } from '../utils/file-upload'

export const cvRoutes = new Elysia({ prefix: '/cvs' })
  .post('/upload', async ({ user, body }) => {
    if (!user) throw new Error('Unauthorized')

    const file = body.file
    if (!file) throw new Error('No file provided')

    // Validate file type
    if (!fileUploadService.validateFileType(file.type)) {
      throw new Error('Unsupported file type')
    }

    // Validate file size
    if (!fileUploadService.validateFileSize(file.size)) {
      throw new Error('File too large')
    }

    // Save file
    const { filePath, originalFilename } = await fileUploadService.saveFile(file)

    // Create CV record
    const cv = await cvService.createCV(user.userId, {
      name: originalFilename,
      filePath,
      originalFilename,
      contentType: file.type
    })

    return { success: true, cv }
  }, {
    as: 'authenticated',
    body: t.Object({
      file: t.File()
    })
  })
  .get('/', async ({ user }) => {
    if (!user) throw new Error('Unauthorized')
    return await cvService.getUserCVs(user.userId)
  }, { as: 'authenticated' })
  .get('/:id', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    const cv = await cvService.getCV(user.userId, params.id)
    if (!cv) throw new Error('CV not found')
    return cv
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() })
  })
  .put('/:id', async ({ user, params, body }) => {
    if (!user) throw new Error('Unauthorized')
    const cv = await cvService.updateCV(user.userId, params.id, body)
    if (!cv) throw new Error('CV not found')
    return cv
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      parsedData: t.Optional(t.Record(t.String(), t.Any()))
    })
  })
  .delete('/:id', async ({ user, params }) => {
    if (!user) throw new Error('Unauthorized')
    const cv = await cvService.deleteCV(user.userId, params.id)
    if (!cv) throw new Error('CV not found')
    return { success: true }
  }, {
    as: 'authenticated',
    params: t.Object({ id: t.String() })
  })
