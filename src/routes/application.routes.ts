import { Elysia, t } from 'elysia'
import { authMiddleware } from '../middleware/auth'
import { validateEmail, validateRussianPhone } from '../utils/validation'
import { proxyToCore } from '../services/core.proxy'
import { logger } from '../utils/logger'
import type { ApplicationSubmitRequest, CustomizedCV } from '../types'

export function registerApplicationRoutes() {
  return new Elysia({ name: 'application-routes' })
    .use(authMiddleware())
    .post('/api/application/submit', async ({ body, set, userId, session }) => {
      const { jobExternalId, customizedCV, coverLetter } = body as ApplicationSubmitRequest

      logger.info('Application submission started', { userId, jobExternalId })

      if (!jobExternalId || !customizedCV) {
        set.status = 400
        return { success: false, error: 'Missing job data for submission' }
      }

      // Validate email
      const email = typeof customizedCV.email === 'string' ? customizedCV.email : ''
      const emailValidation = validateEmail(email)
      if (!emailValidation.valid) {
        set.status = 400
        return { success: false, error: emailValidation.error || 'Invalid email address' }
      }

      // Validate phone number
      const phone = typeof customizedCV.phone === 'string' ? customizedCV.phone : ''
      const phoneValidation = validateRussianPhone(phone)
      if (!phoneValidation.valid) {
        set.status = 400
        return { success: false, error: phoneValidation.error || 'Invalid phone number' }
      }

      // Use formatted phone number
      if (phoneValidation.formatted) {
        customizedCV.phone = phoneValidation.formatted
      }

      // Sanitize CV: drop blank hh_resume_id to avoid short-circuiting with empty id in Core
      const sanitizedCV = { ...customizedCV } as CustomizedCV & { hh_resume_id?: string }
      if (typeof sanitizedCV.hh_resume_id === 'string' && sanitizedCV.hh_resume_id.trim() === '') {
        delete sanitizedCV.hh_resume_id
      }

      try {
        const response = await proxyToCore({
          path: '/api/applications/submit',
          method: 'POST',
          body: {
            job_external_id: jobExternalId,
            customized_cv: sanitizedCV,
            cover_letter: coverLetter
          },
          token: session.token,
          sessionId: session.id,
          retryOptions: {
            maxRetries: 2,
            retryableStatuses: [502, 503, 504],
            onRetry: (attempt, error) => {
              logger.warn('Retrying application submission', { attempt, userId, jobExternalId, error: error.message })
            }
          }
        })

        if (!response.ok) {
          let errorPayload: any = null
          try {
            errorPayload = await response.json()
          } catch {
            errorPayload = await response.text()
          }
          const errorString = typeof errorPayload === 'string' ? errorPayload : errorPayload?.error

          if (response.status === 422 && errorString) {
            const normalized = String(errorString).replace(/^:/, '')
            const mapped: Record<string, string> = {
              missing_email: 'Your CV is missing an email address. Please add one before submitting.',
              missing_phone: 'Your CV is missing a phone number. Please add one before submitting.',
              missing_resume_id: 'We could not determine a resume to submit. Please try again.',
              resume_not_available: 'Your HH resume is not available to apply. Please publish and verify it on HH (phone verification may be required), then retry.'
            }

            // Special-case HH bad_arguments to surface description when available
            if (normalized === 'bad_arguments') {
              const description = typeof errorPayload?.details?.description === 'string'
                ? errorPayload.details.description
                : undefined
              logger.warn('HH.ru rejected application', { userId, jobExternalId, reason: 'bad_arguments', description })
              set.status = 422
              return {
                success: false,
                error: description
                  ? `HH.ru rejected the request: ${description}`
                  : 'HH.ru rejected the request due to invalid arguments.'
              }
            }

            logger.warn('Application submission rejected', { userId, jobExternalId, reason: normalized })
            set.status = 422
            return {
              success: false,
              error: mapped[normalized] || `Phoenix Core rejected the resume: ${normalized}`
            }
          }

          logger.error('Application submission failed', undefined, { userId, jobExternalId, status: response.status, error: errorString })
          set.status = 502
          return {
            success: false,
            error: `Phoenix Core error: ${response.status} - ${errorString ?? 'Unknown error'}`
          }
        }

        const result = await response.json()
        logger.info('Application submitted successfully', { userId, jobExternalId })
        return { success: true, result, message: 'Application submitted successfully!' }
      } catch (error) {
        logger.error('Application submission error', error as Error, { userId, jobExternalId })
        set.status = 500
        return { success: false, error: error instanceof Error ? error.message : 'Submission failed' }
      }
    }, {
      body: t.Object({
        jobExternalId: t.String({ minLength: 1 }),
        customizedCV: t.Object({
          firstName: t.Optional(t.String()),
          lastName: t.Optional(t.String()),
          email: t.Optional(t.String()),
          phone: t.Optional(t.String()),
          title: t.Optional(t.String()),
          summary: t.Optional(t.String()),
          experience: t.Optional(t.String()),
          education: t.Optional(t.String()),
          skills: t.Optional(t.Array(t.String())),
          projects: t.Optional(t.String()),
          birthDate: t.Optional(t.String()),
          area: t.Optional(t.String()),
          matchedSkills: t.Optional(t.Array(t.String())),
          addedKeywords: t.Optional(t.Array(t.String()))
        }),
        coverLetter: t.String({ minLength: 1 })
      })
    })
}


