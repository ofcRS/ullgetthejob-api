import { Elysia, t } from 'elysia'
import { env } from '../config/env'

export function registerApplicationRoutes() {
  return new Elysia({ name: 'application-routes' })
    .post('/api/application/submit', async ({ body, set }) => {
      const { jobExternalId, customizedCV, coverLetter } = body as {
        jobExternalId: string
        customizedCV: any
        coverLetter: string
      }

      const response = await fetch(`${env.CORE_URL}/api/applications/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Core-Secret': env.ORCHESTRATOR_SECRET
        },
        body: JSON.stringify({
          user_id: 'mvp-demo-user',
          job_external_id: jobExternalId,
          customized_cv: customizedCV,
          cover_letter: coverLetter
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        set.status = 502
        return { success: false, error: `Phoenix Core error: ${response.status} - ${errorText}` }
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


