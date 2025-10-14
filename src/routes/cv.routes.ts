import { Elysia, t } from 'elysia'
import { cvParserService } from '../services/cv-parser.service'
import { StorageService } from '../services/storage.service'
import { aiService } from '../services/ai.service'

const storage = new StorageService()

export function registerCvRoutes() {
  return new Elysia({ name: 'cv-routes' })
    .post('/api/cv/upload', async ({ body }) => {
      const file = (body as any).file as File
      const clientId = (body as any).clientId as string | undefined
      if (!file) throw new Error('No file provided')

      const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
        throw new Error('Invalid file type. Please upload PDF or DOCX')
      }

      const parsed = await cvParserService.parseCV(file, (stage) => {
        // Notify client when possible
        try {
          const { realtime } = require('../services/realtime.service') as typeof import('../services/realtime.service')
          realtime.sendToClientId(clientId, { type: 'cv_progress', stage })
        } catch {}
      })

      // Persist parsed CV (MVP: no auth, demo user)
      const saved = await storage.createParsedCv({
        userId: null,
        parsedData: parsed,
        originalFilename: file.name,
        modelUsed: 'anthropic/claude-3.5-sonnet'
      })

      return { success: true, cv: parsed, id: saved?.id }
    }, {
      body: t.Object({ file: t.File(), clientId: t.Optional(t.String()) })
    })
    .get('/api/cv', async () => {
      const items = await storage.listParsedCvs(50)
      return { success: true, items }
    })
    .get('/api/cv/:id', async ({ params, set }) => {
      const { id } = params as { id: string }
      const row = await storage.getCvById(id)
      if (!row) {
        set.status = 404
        return { success: false, error: 'Not found' }
      }
      return { success: true, cv: row }
    })
    .post('/api/cv/customize', async ({ body, set }) => {
      try {
        const { cv, jobDescription, model } = body as { cv: any; jobDescription: string; model?: string }
        if (!cv || !jobDescription) {
          set.status = 400
          return { success: false, error: 'Missing CV or job description' }
        }

        const customizedCV = await aiService.customizeCV(cv, jobDescription, model)
        const coverLetter = await aiService.generateCoverLetter(customizedCV, jobDescription, 'Company', model)
        const jobSkills = await aiService.extractJobSkills(jobDescription)

        return { success: true, customizedCV, coverLetter, modelUsed: model || 'anthropic/claude-3.5-sonnet', jobSkills }
      } catch (error) {
        set.status = 500
        return { success: false, error: error instanceof Error ? error.message : 'Customization failed' }
      }
    }, {
      body: t.Object({ cv: t.Any(), jobDescription: t.String(), model: t.Optional(t.String()) })
    })
}


