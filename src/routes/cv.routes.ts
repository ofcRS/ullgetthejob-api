import { Elysia, t } from 'elysia'
import { cvParserService } from '../services/cv-parser.service'
import { StorageService } from '../services/storage.service'

const storage = new StorageService()

export function registerCvRoutes() {
  return new Elysia({ name: 'cv-routes' })
    .post('/api/cv/upload', async ({ body }) => {
      const file = (body as any).file as File
      if (!file) throw new Error('No file provided')

      const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
        throw new Error('Invalid file type. Please upload PDF or DOCX')
      }

      const parsed = await cvParserService.parseCV(file)

      // Persist minimal record (MVP: no auth, demo user)
      const saved = await storage.createParsedCv({
        userId: null,
        parsedData: parsed,
        originalFilename: file.name,
        modelUsed: 'anthropic/claude-3.5-sonnet'
      })

      return { success: true, cv: parsed, id: saved?.id }
    }, {
      body: t.Object({ file: t.File() })
    })
}


