import { env } from '../config/env'

// NOTE: HH.ru integration is handled by Phoenix Core orchestrator
// This service proxies required operations to Core via internal API

export class HHService {
  async getJobsViaCore(searchParams: any) {
    const response = await fetch(`${env.CORE_URL}/api/jobs/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Core-Secret': env.ORCHESTRATOR_SECRET
      },
      body: JSON.stringify(searchParams)
    })

    if (!response.ok) {
      throw new Error('Failed to fetch jobs from Core')
    }

    return await response.json()
  }

  async submitApplicationViaCore(args: {
    userId: string
    jobExternalId: string
    customizedCv: any
    coverLetter?: string
  }) {
    const response = await fetch(`${env.CORE_URL}/api/applications/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Core-Secret': env.ORCHESTRATOR_SECRET
      },
      body: JSON.stringify({
        user_id: args.userId,
        job_external_id: args.jobExternalId,
        customized_cv: args.customizedCv,
        cover_letter: args.coverLetter ?? ''
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to submit application via Core: ${errorText}`)
    }

    return await response.json()
  }
}

export const hhService = new HHService()

