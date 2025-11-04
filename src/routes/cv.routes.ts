import { Elysia, t } from 'elysia'
import { cvParserService } from '../services/cv-parser.service'
import { StorageService } from '../services/storage.service'
import { aiService } from '../services/ai.service'
import { env } from '../config/env'
import { validateSession, extractSessionCookie, serializeSessionCookie } from '../middleware/session'
import { validateFileSize, validateFileType } from '../utils/validation'

const storage = new StorageService()

export function registerCvRoutes() {
  return new Elysia({ name: 'cv-routes' })
    .post('/api/cv/upload', async ({ body, set }) => {
      const file = (body as any).file as File
      const clientId = (body as any).clientId as string | undefined
      if (!file) {
        set.status = 400
        return { success: false, error: 'No file provided' }
      }

      // Validate file size
      const sizeValidation = validateFileSize(file, env.MAX_FILE_SIZE)
      if (!sizeValidation.valid) {
        set.status = 400
        return { success: false, error: sizeValidation.error }
      }

      // Validate file type using magic bytes
      const typeValidation = await validateFileType(file)
      if (!typeValidation.valid) {
        set.status = 400
        return { success: false, error: typeValidation.error }
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
    .post('/api/cv/import/hh/:id', async ({ params, request, set }) => {
      const id = (params as any).id as string
      const cookieValue = extractSessionCookie(request.headers.get('cookie'))
      const sessionValidation = await validateSession(cookieValue)

      if (!sessionValidation.valid || !sessionValidation.session) {
        set.status = 401
        set.headers['Set-Cookie'] = serializeSessionCookie('', {
          maxAge: 0,
          secure: env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax'
        })
        return { success: false, error: 'HH.ru account not connected' }
      }

      const session = sessionValidation.session

      const res = await fetch(`${env.CORE_URL}/api/hh/resumes/${encodeURIComponent(id)}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
          'X-Session-Id': session.id
        }
      })

      const data = await res.json()
      if (!data.success) return { success: false, error: data.error || 'Failed to fetch resume' }

      const r = data.resume
      const parsed: any = {
        firstName: r?.first_name || r?.firstName,
        lastName: r?.last_name || r?.lastName,
        email: r?.contact?.email || r?.email,
        phone: r?.contact?.phone || r?.phone,
        title: r?.title || r?.position,
        summary: r?.summary || r?.skills_description,
        experience: Array.isArray(r?.experience) ? r.experience.map((e: any) => `• ${e.position} @ ${e.company}\n${e.description || ''}`).join('\n\n') : (r?.experience || ''),
        education: Array.isArray(r?.education) ? r.education.map((e: any) => `${e.school} — ${e.result || ''}`).join('\n') : (r?.education || ''),
        skills: Array.isArray(r?.skills) ? r.skills.map((s: any) => (s.name || s).toString()) : [],
        projects: '',
        fullText: ''
      }

      const storage = new StorageService()
      const saved = await storage.createParsedCv({ userId: null, parsedData: parsed, originalFilename: `hh_${id}.json`, modelUsed: 'import' })
      return { success: true, cv: parsed, id: saved?.id }
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


