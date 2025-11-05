import { Elysia, t } from 'elysia'
import { env } from '../config/env'
import { validateSession, extractSessionCookie, serializeSessionCookie } from '../middleware/session'
import { validateEmail, validateRussianPhone } from '../utils/validation'
import type { ApplicationSubmitRequest, CustomizedCV } from '../types'

export function registerApplicationRoutes() {
  return new Elysia({ name: 'application-routes' })
    .post('/api/application/submit', async ({ body, set, request }) => {
      const { jobExternalId, customizedCV, coverLetter } = body as ApplicationSubmitRequest

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

      const response = await fetch(`${env.CORE_URL}/api/applications/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Core-Secret': env.ORCHESTRATOR_SECRET,
          Authorization: `Bearer ${session.token}`,
          'X-Session-Id': session.id
        },
        body: JSON.stringify({
          user_id: session.id,
          job_external_id: jobExternalId,
          customized_cv: sanitizedCV,
          cover_letter: coverLetter
        })
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
            missing_resume_id: 'We couldn’t determine a resume to submit. Please try again.',
            resume_not_available: 'Your HH resume isn’t available to apply. Please publish and verify it on HH (phone verification may be required), then retry.'
          }

          // Special-case HH bad_arguments to surface description when available
          if (normalized === 'bad_arguments') {
            const description = typeof errorPayload?.details?.description === 'string'
              ? errorPayload.details.description
              : undefined
            set.status = 422
            return {
              success: false,
              error: description
                ? `HH.ru rejected the request: ${description}`
                : 'HH.ru rejected the request due to invalid arguments.'
            }
          }

          set.status = 422
          return {
            success: false,
            error: mapped[normalized] || `Phoenix Core rejected the resume: ${normalized}`
          }
        }

        set.status = 502
        return {
          success: false,
          error: `Phoenix Core error: ${response.status} - ${errorString ?? 'Unknown error'}`
        }
      }

      const result = await response.json()
      return { success: true, result, message: 'Application submitted successfully!' }
    }, {
      body: t.Object({
        jobExternalId: t.String(),
        customizedCV: t.Any(),
        coverLetter: t.String()
      })
    })
}


