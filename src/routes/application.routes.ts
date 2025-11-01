import { Elysia, t } from 'elysia'
import { env } from '../config/env'
import { validateSession, extractSessionCookie, serializeSessionCookie } from '../middleware/session'

export function registerApplicationRoutes() {
  return new Elysia({ name: 'application-routes' })
    .post('/api/application/submit', async ({ body, set, request }) => {
      const { jobExternalId, customizedCV, coverLetter } = body as {
        jobExternalId: string
        customizedCV: any
        coverLetter: string
      }

      const cookieValue = extractSessionCookie(request.headers.get('cookie'))
      const sessionValidation = validateSession(cookieValue)
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

      const email = typeof customizedCV.email === 'string' ? customizedCV.email.trim() : ''
      const phoneRaw = typeof customizedCV.phone === 'string' ? customizedCV.phone.trim() : ''
      const phoneDigits = phoneRaw.replace(/[^\d]/g, '')

      if (!email || !email.includes('@')) {
        set.status = 400
        return { success: false, error: 'Your CV needs a valid email address before you can submit. Please edit the CV details.' }
      }

      if (!phoneDigits || phoneDigits.length < 7) {
        set.status = 400
        return { success: false, error: 'Your CV needs a valid phone number before you can submit. Please edit the CV details.' }
      }

      // Sanitize CV: drop blank hh_resume_id to avoid short-circuiting with empty id in Core
      const sanitizedCV = { ...(customizedCV as any) }
      if (typeof (sanitizedCV as any)?.hh_resume_id === 'string' && (sanitizedCV as any).hh_resume_id.trim() === '') {
        delete (sanitizedCV as any).hh_resume_id
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


