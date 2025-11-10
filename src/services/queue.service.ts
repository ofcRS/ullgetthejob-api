import { db } from '../db/client'
import { applicationQueue, jobs, customCvs } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../config/env'
import { matchingService } from './matching.service'
import { logger } from '../utils/logger'
import type { ParsedCV, JobItem } from '../types'

export class QueueService {
  constructor(private db: typeof db) {}

  /**
   * Add multiple jobs to application queue
   */
  async addJobsToQueue(userId: string, cvId: string, jobIds: string[]) {
    const workflowId = uuidv4()

    // Fetch job details
    const jobDetails = await this.db
      .select()
      .from(jobs)
      .where(inArray(jobs.id, jobIds))

    if (jobDetails.length === 0) {
      throw new Error('No valid jobs found')
    }

    // Create queue items
    const queueItems = jobDetails.map(job => ({
      workflowId,
      userId,
      cvId,
      jobId: job.id,
      jobExternalId: job.hhVacancyId || job.externalId,
      status: 'pending',
      priority: 0,
      attempts: 0,
      payload: {
        jobTitle: job.title,
        company: job.company,
        addedAt: new Date().toISOString()
      }
    }))

    // Insert into database
    await this.db.insert(applicationQueue).values(queueItems)

    return {
      workflowId,
      queuedCount: queueItems.length
    }
  }

  /**
   * Get queue items for user
   */
  async getQueue(
    userId: string,
    filters: { workflowId?: string; status?: string } = {}
  ) {
    let conditions = [eq(applicationQueue.userId, userId)]

    if (filters.workflowId) {
      conditions.push(eq(applicationQueue.workflowId, filters.workflowId))
    }

    if (filters.status) {
      conditions.push(eq(applicationQueue.status, filters.status))
    }

    const results = await this.db
      .select({
        id: applicationQueue.id,
        workflowId: applicationQueue.workflowId,
        status: applicationQueue.status,
        priority: applicationQueue.priority,
        attempts: applicationQueue.attempts,
        nextRunAt: applicationQueue.nextRunAt,
        lastError: applicationQueue.lastError,
        createdAt: applicationQueue.createdAt,
        payload: applicationQueue.payload,
        job: {
          id: jobs.id,
          title: jobs.title,
          company: jobs.company,
          salary: jobs.salary,
          area: jobs.area,
          description: jobs.description,
          skills: jobs.skills,
          url: jobs.url
        },
        customCv: {
          id: customCvs.id,
          customizedData: customCvs.customizedData,
          coverLetter: customCvs.coverLetter
        }
      })
      .from(applicationQueue)
      .leftJoin(jobs, eq(applicationQueue.jobId, jobs.id))
      .leftJoin(customCvs, and(
        eq(customCvs.cvId, applicationQueue.cvId),
        eq(customCvs.jobId, applicationQueue.jobId)
      ))
      .where(and(...conditions))

    return results
  }

  /**
   * Remove item from queue
   */
  async removeFromQueue(itemId: string) {
    await this.db
      .delete(applicationQueue)
      .where(eq(applicationQueue.id, itemId))
  }

  /**
   * Start batch customization for workflow
   */
  async startBatchCustomize(workflowId: string, userId: string) {
    // Fetch queue items
    const items = await this.db
      .select({
        queueItem: applicationQueue,
        job: jobs
      })
      .from(applicationQueue)
      .leftJoin(jobs, eq(applicationQueue.jobId, jobs.id))
      .where(and(
        eq(applicationQueue.workflowId, workflowId),
        eq(applicationQueue.userId, userId),
        eq(applicationQueue.status, 'pending')
      ))

    if (items.length === 0) {
      throw new Error('No pending jobs in workflow')
    }

    // Call Core to trigger batch customization
    const response = await fetch(`${env.CORE_URL}/api/queue/batch-customize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Core-Secret': env.ORCHESTRATOR_SECRET
      },
      body: JSON.stringify({
        workflowId,
        userId,
        jobCount: items.length
      })
    })

    if (!response.ok) {
      throw new Error('Failed to start batch customization in Core')
    }

    return {
      workflowId,
      jobCount: items.length
    }
  }

  /**
   * Start auto-apply workflow
   */
  async startAutoApply(workflowId: string, userId: string) {
    // Verify all jobs are in workflow
    const items = await this.db
      .select()
      .from(applicationQueue)
      .where(and(
        eq(applicationQueue.workflowId, workflowId),
        eq(applicationQueue.userId, userId)
      ))

    if (items.length === 0) {
      throw new Error('No jobs found in workflow')
    }

    // Get job IDs that are not null
    const jobIds = items.map(i => i.jobId).filter((id): id is string => id !== null)

    if (jobIds.length === 0) {
      throw new Error('No valid job IDs in workflow')
    }

    // Verify customization exists
    const customizedCount = await this.db
      .select()
      .from(customCvs)
      .where(and(
        eq(customCvs.cvId, items[0].cvId),
        inArray(customCvs.jobId, jobIds)
      ))

    if (customizedCount.length < items.length) {
      throw new Error('Not all jobs are customized. Run batch-customize first.')
    }

    // Call Core to start auto-apply
    const response = await fetch(`${env.CORE_URL}/api/queue/start-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Core-Secret': env.ORCHESTRATOR_SECRET
      },
      body: JSON.stringify({
        workflowId,
        userId
      })
    })

    if (!response.ok) {
      throw new Error('Failed to start auto-apply workflow in Core')
    }

    const data = await response.json()

    return {
      workflowId,
      estimatedCompletion: data.estimatedCompletion
    }
  }

  /**
   * Calculate match score between CV and job
   * Uses enhanced semantic matching with fallback to basic keyword matching
   */
  async calculateMatchScore(cv: ParsedCV, job: JobItem): Promise<number> {
    try {
      // Try enhanced semantic matching
      const result = await matchingService.calculateEnhancedMatchScore(cv, job)

      logger.debug('Enhanced match score calculated', {
        cvId: cv.id,
        jobId: job.id,
        score: result.totalScore,
        confidence: result.confidence
      })

      return result.totalScore
    } catch (error) {
      // Fallback to basic keyword matching if enhanced matching fails
      logger.warn('Enhanced matching failed, using basic keyword matching', {
        cvId: cv.id,
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return this.calculateBasicMatchScore(cv, job)
    }
  }

  /**
   * Legacy keyword matching (fallback only)
   */
  private calculateBasicMatchScore(cv: ParsedCV, job: JobItem): number {
    const cvSkills = new Set((cv.skills || []).map(s => s.toLowerCase()))
    const jobSkills = new Set((job.skills || []).map(s => s.toLowerCase()))

    if (jobSkills.size === 0) return 0

    let matches = 0
    for (const skill of jobSkills) {
      if (cvSkills.has(skill)) matches++
    }

    return Math.round((matches / jobSkills.size) * 100)
  }
}
