import { Elysia, t } from 'elysia'
import { cvParserService } from '../services/cv-parser.service'
import { StorageService } from '../services/storage.service'
import { aiService } from '../services/ai.service'
import { env } from '../config/env'
import { authMiddleware, optionalAuthMiddleware, checkResourceOwnership } from '../middleware/auth'
import { validateFileSize, validateFileType } from '../utils/validation'
import { fetchWithRetry } from '../utils/retry'
import { logger } from '../utils/logger'
import type { CVUploadRequest, CVCustomizeRequest, ParsedCV, AuthContext } from '../types'

const storage = new StorageService()

export function registerCvRoutes() {
  return new Elysia({ name: 'cv-routes' })
    // CV Upload - requires authentication
    .use(authMiddleware())
    .post('/api/cv/upload', async ({ body, set, userId }) => {
      const { file, clientId } = body as CVUploadRequest
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

      logger.info('CV upload started', { userId, filename: file.name, size: file.size })

      const parsed = await cvParserService.parseCV(file, (stage) => {
        // Notify client when possible
        try {
          const { realtime } = require('../services/realtime.service') as typeof import('../services/realtime.service')
          realtime.sendToClientId(clientId, { type: 'cv_progress', stage })
        } catch {}
      })

      // Persist parsed CV with proper user ownership
      const saved = await storage.createParsedCv({
        userId: userId, // Use authenticated user ID
        parsedData: parsed,
        originalFilename: file.name,
        modelUsed: 'anthropic/claude-3.5-sonnet'
      })

      logger.info('CV uploaded successfully', { userId, cvId: saved.id })

      return { success: true, cv: parsed, id: saved.id }
    }, {
      body: t.Object({ file: t.File(), clientId: t.Optional(t.String()) })
    })
    .post('/api/cv/import/hh/:id', async ({ params, session, userId, set }) => {
      const { id } = params as { id: string }

      logger.info('CV import from HH.ru started', { userId, hhResumeId: id })

      const res = await fetchWithRetry(`${env.CORE_URL}/api/hh/resumes/${encodeURIComponent(id)}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
          'X-Session-Id': session.id
        }
      }, {
        maxRetries: 3,
        retryableStatuses: [502, 503, 504],
        onRetry: (attempt, error) => {
          logger.warn('Retrying HH resume fetch', { attempt, userId, hhResumeId: id, error: error.message })
        }
      })

      const data = await res.json()
      if (!data.success) {
        logger.error('Failed to fetch HH resume', undefined, { userId, hhResumeId: id, error: data.error })
        return { success: false, error: data.error || 'Failed to fetch resume' }
      }

      const r = data.resume
      const parsed: ParsedCV = {
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

      const saved = await storage.createParsedCv({
        userId: userId, // Use authenticated user ID
        parsedData: parsed,
        originalFilename: `hh_${id}.json`,
        modelUsed: 'import'
      })

      logger.info('CV imported successfully from HH.ru', { userId, cvId: saved.id, hhResumeId: id })

      return { success: true, cv: parsed, id: saved.id }
    })
    // List user's CVs - requires authentication
    .get('/api/cv', async ({ userId }) => {
      logger.debug('Listing CVs', { userId })
      const items = await storage.listParsedCvsByUser(userId, 50)
      return { success: true, items, total: items.length }
    })
    // Get specific CV - requires authentication and ownership check
    .get('/api/cv/:id', async ({ params, set, userId }) => {
      const { id } = params as { id: string }
      const row = await storage.getCvById(id)

      if (!row) {
        set.status = 404
        return { success: false, error: 'CV not found' }
      }

      // Check ownership
      if (!checkResourceOwnership(row.userId, userId)) {
        logger.warn('Unauthorized CV access attempt', { userId, cvId: id, ownerId: row.userId })
        set.status = 403
        return { success: false, error: 'Forbidden: You do not have access to this CV' }
      }

      return { success: true, cv: row }
    })
    .post('/api/cv/customize', async ({ body, set, userId }) => {
      try {
        const { cv, jobDescription, model } = body as CVCustomizeRequest
        if (!cv || !jobDescription) {
          set.status = 400
          return { success: false, error: 'Missing CV or job description' }
        }

        logger.info('CV customization started', { userId, model: model || 'default' })

        // Extract job skills once and reuse to avoid duplicate AI calls
        const jobSkills = await aiService.extractJobSkills(jobDescription)

        // Pass pre-extracted skills to customizeCV to prevent redundant extraction
        const customizedCV = await aiService.customizeCV(cv, jobDescription, model, jobSkills)
        const coverLetter = await aiService.generateCoverLetter(customizedCV, jobDescription, 'Company', model)

        logger.info('CV customization completed', { userId, skillsMatched: customizedCV.matchedSkills?.length })

        return { success: true, customizedCV, coverLetter, modelUsed: model || 'anthropic/claude-3.5-sonnet', jobSkills }
      } catch (error) {
        logger.error('CV customization failed', error as Error, { userId })
        set.status = 500
        return { success: false, error: error instanceof Error ? error.message : 'Customization failed' }
      }
    }, {
      body: t.Object({
        cv: t.Object({
          firstName: t.Optional(t.String()),
          lastName: t.Optional(t.String()),
          email: t.Optional(t.String()),
          phone: t.Optional(t.String()),
          title: t.Optional(t.String()),
          summary: t.Optional(t.String()),
          experience: t.Optional(t.String()),
          education: t.Optional(t.String()),
          skills: t.Optional(t.Array(t.String())),
          projects: t.Optional(t.String())
        }),
        jobDescription: t.String({ minLength: 10 }),
        model: t.Optional(t.String())
      })
    })
}


