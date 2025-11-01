import { Elysia, t } from 'elysia'
import { env } from '../config/env'
import { validateSession, SESSION_COOKIE_NAME } from '../middleware/session'

type SessionCookieHandle = {
  value?: string
  remove?: () => void
}

const getSessionCookie = (cookie: Record<string, unknown> | undefined) =>
  cookie?.[SESSION_COOKIE_NAME] as SessionCookieHandle | undefined

export function registerApplicationRoutes() {
  return new Elysia({ name: 'application-routes' })
    .post('/api/application/submit', async ({ body, set, cookie }) => {
      const { jobExternalId, customizedCV, coverLetter } = body as {
        jobExternalId: string
        customizedCV: any
        coverLetter: string
      }

      const sessionCookie = getSessionCookie(cookie)
      const sessionValidation = validateSession(sessionCookie?.value)
      if (!sessionValidation.valid || !sessionValidation.session) {
        set.status = 401
        return { success: false, error: 'HH.ru account not connected' }
      }

      const session = sessionValidation.session

      if (!jobExternalId || !customizedCV) {
        set.status = 400
        return { success: false, error: 'Missing job data for submission' }
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
          customized_cv: customizedCV,
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
        set.status = 502
        const errorMessage = typeof errorPayload === 'string' ? errorPayload : errorPayload?.error
        return { success: false, error: `Phoenix Core error: ${response.status} - ${errorMessage ?? 'Unknown error'}` }
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


