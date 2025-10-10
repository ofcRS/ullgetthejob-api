import { Elysia, t } from 'elysia'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { applicationQueue, applications } from '../db/schema'
import { cvService } from '../services/cv.service'
import { aiService } from '../services/ai.service'
import { hhService } from '../services/hh.service'
import { authenticated } from '../middleware/auth'

export const workflowRoutes = new Elysia({ prefix: '/workflow' })
  .use(authenticated)
  .post('/start', async ({ user, body }) => {
    const { cvId, searchParams, maxApplications = 50 } = body

    // 1. Get user's CV
    const cv = await cvService.getCV(user!.userId, cvId)
    if (!cv) {
      throw new Error('CV not found')
    }

    // Parse CV data for customization
    const parsedData = cv.parsedData as any
    if (!parsedData) {
      throw new Error('CV has not been parsed yet')
    }

    // 2. Create workflow ID
    const workflowId = crypto.randomUUID()

    // 3. Fetch matching jobs from Core orchestrator
    const jobsResponse = await fetch(`${process.env.VITE_ORCHESTRATOR_URL || 'http://localhost:4000'}/api/jobs/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Core-Secret': process.env.ORCHESTRATOR_SECRET || 'dev_orchestrator_secret'
      },
      body: JSON.stringify(searchParams)
    })

    if (!jobsResponse.ok) {
      throw new Error('Failed to fetch jobs from orchestrator')
    }

    const { jobs } = await jobsResponse.json()

    // 4. Queue applications (limit to maxApplications)
    const applicationsToQueue = jobs.slice(0, maxApplications)

    for (const job of applicationsToQueue) {
      await db.insert(applicationQueue).values({
        workflowId,
        userId: user!.userId,
        cvId,
        jobId: job.id,
        jobExternalId: job.id,
        status: 'pending',
        payload: {
          jobDescription: job.description,
          jobTitle: job.title,
          company: job.company,
          searchParams
        },
        nextRunAt: new Date(),
        priority: 0
      })
    }

    return {
      workflowId,
      queued: applicationsToQueue.length,
      status: 'processing',
      totalJobs: jobs.length
    }
  }, {
    body: t.Object({
      cvId: t.String(),
      searchParams: t.Object({
        text: t.String(),
        area: t.String(),
        experience: t.String(),
        employment: t.String(),
        schedule: t.String()
      }),
      maxApplications: t.Number({ default: 50 })
    })
  })

  .get('/status/:workflowId', async ({ user, params }) => {
    const workflowId = params.workflowId

    // Get stats from applications table
    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        submitted: sql<number>`count(case when ${applications.status} = 'submitted' then 1 end)`,
        failed: sql<number>`count(case when ${applications.status} = 'failed' then 1 end)`,
        pending: sql<number>`count(case when ${applications.status} = 'pending' then 1 end)`,
        processing: sql<number>`count(case when ${applications.status} = 'processing' then 1 end)`,
        rate_limited: sql<number>`count(case when ${applications.status} = 'rate_limited' then 1 end)`
      })
      .from(applications)
      .where(eq(applications.userId, user!.userId))
      .then(result => result[0])

    // Get queue stats
    const queueStats = await db
      .select({
        pending: sql<number>`count(case when ${applicationQueue.status} = 'pending' then 1 end)`,
        processing: sql<number>`count(case when ${applicationQueue.status} = 'processing' then 1 end)`,
        failed: sql<number>`count(case when ${applicationQueue.status} = 'failed' then 1 end)`,
        rate_limited: sql<number>`count(case when ${applicationQueue.status} = 'rate_limited' then 1 end)`
      })
      .from(applicationQueue)
      .where(and(eq(applicationQueue.userId, user!.userId), eq(applicationQueue.workflowId, workflowId)))
      .then(result => result[0])

    return {
      workflowId,
      stats,
      queueStats,
      status: 'active'
    }
  }, {
    params: t.Object({ workflowId: t.String() })
  })

  .post('/stop/:workflowId', async ({ user, params }) => {
    const workflowId = params.workflowId

    // Mark all pending items in queue as cancelled
    await db
      .update(applicationQueue)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(and(
        eq(applicationQueue.userId, user!.userId),
        eq(applicationQueue.workflowId, workflowId),
        eq(applicationQueue.status, 'pending')
      ))

    return { status: 'stopped', workflowId }
  }, {
    params: t.Object({ workflowId: t.String() })
  })
