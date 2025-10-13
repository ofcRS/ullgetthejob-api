import { Elysia, t } from 'elysia'
import { cvService } from '../services/cv.service'
import { fileUploadService } from '../utils/file-upload'
import { cvParserService } from '../services/cv-parser.service'
import { authenticated } from '../middleware/auth'

export const cvRoutes = new Elysia({ prefix: '/cvs' })
  .use(authenticated)
  .post('/upload', async (ctx) => {
    const { user, body } = ctx as any
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

    // Attempt to parse CV (best-effort)
    let parsedData: Record<string, unknown> | null = null
    try {
      const parsed = await cvParserService.parseCV(file)
      parsedData = parsed as unknown as Record<string, unknown>
    } catch (error) {
      console.error('CV parsing failed:', error)
    }

    // Create CV record
    const cv = await cvService.createCV((user as any)!.userId, {
      name: originalFilename,
      filePath,
      originalFilename,
      contentType: file.type,
      parsedData: parsedData || undefined
    })

    return { success: true, cv, parsedData }
  }, {
    body: t.Object({
      file: t.File()
    })
  })
  .get('/', async (ctx) => {
    const { user } = ctx as any
    return await cvService.getUserCVs((user as any)!.userId)
  })
  .get('/:id', async (ctx) => {
    const { user, params } = ctx as any
    const cv = await cvService.getCV((user as any)!.userId, params.id)
    if (!cv) throw new Error('CV not found')
    return cv
  }, {
    params: t.Object({ id: t.String() })
  })
  .put('/:id', async (ctx) => {
    const { user, params, body } = ctx as any
    const cv = await cvService.updateCV((user as any)!.userId, params.id, body)
    if (!cv) throw new Error('CV not found')
    return cv
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      parsedData: t.Optional(t.Record(t.String(), t.Any()))
    })
  })
  .delete('/:id', async (ctx) => {
    const { user, params } = ctx as any
    const cv = await cvService.deleteCV((user as any)!.userId, params.id)
    if (!cv) throw new Error('CV not found')
    return { success: true }
  }, {
    params: t.Object({ id: t.String() })
  })
