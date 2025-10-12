import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { applicationQueue, applications } from '../db/schema'
import { cvService } from '../services/cv.service'
import { aiService } from '../services/ai.service'
import { hhService } from '../services/hh.service'
import { env } from '../config/env'

// Rate limiting configuration (HH.ru limits: ~200 applications/day)
const RATE_LIMITS = {
  DAILY: 200,
  HOURLY: 8,
  CAPACITY: 20, // Token bucket capacity
  REFILL_RATE: 8 // Tokens per hour
}

export class QueueWorker {
  private isRunning = false
  private pollInterval = 5000 // 5 seconds

  async start() {
    if (this.isRunning) return
    this.isRunning = true
    console.log('Queue worker started')

    while (this.isRunning) {
      try {
        await this.processQueue()
        await new Promise(resolve => setTimeout(resolve, this.pollInterval))
      } catch (error) {
        console.error('Queue worker error:', error)
        await new Promise(resolve => setTimeout(resolve, this.pollInterval * 2))
      }
    }
  }

  async stop() {
    this.isRunning = false
    console.log('Queue worker stopped')
  }

  private async processQueue() {
    // Use PostgreSQL's SKIP LOCKED for atomic claiming
    // First, get IDs of items to process
    const itemsToProcess = await db
      .select({ id: applicationQueue.id })
      .from(applicationQueue)
      .where(and(
        eq(applicationQueue.status, 'pending'),
        lte(applicationQueue.nextRunAt, new Date())
      ))
      .orderBy(
        sql`${applicationQueue.priority} DESC`,
        applicationQueue.nextRunAt
      )
      .limit(20)

    if (itemsToProcess.length === 0) {
      return // No items to process
    }

    const itemIds = itemsToProcess.map(item => item.id)

    // Update items to processing status atomically
    const items = await db
      .update(applicationQueue)
      .set({
        status: 'processing',
        updatedAt: new Date()
      })
      .where(and(
        eq(applicationQueue.status, 'pending'),
        inArray(applicationQueue.id, itemIds)
      ))
      .returning()

    for (const item of items) {
      try {
        await this.processQueueItem(item)
      } catch (error) {
        console.error(`Failed to process queue item ${item.id}:`, error)
        await this.handleProcessingError(item, error)
      }
    }
  }

  private async processQueueItem(item: any) {
    const userId = item.userId
    const cvId = item.cvId
    const jobExternalId = item.jobExternalId
    const payload = item.payload

    // Check rate limits
    if (!(await this.checkRateLimits(userId))) {
      await this.scheduleRetry(item, 'Rate limit exceeded', 60) // Retry in 1 hour
      return
    }

    // Get CV data
    const cv = await cvService.getCV(userId, cvId)
    if (!cv || !cv.parsedData) {
      throw new Error('CV not found or not parsed')
    }

    const parsedCV = cv.parsedData as any

    // Customize CV for this job
    const customizedCV = await aiService.customizeCV(parsedCV, payload.jobDescription)

    // Generate cover letter
    const coverLetter = await aiService.generateCoverLetter(
      customizedCV,
      payload.jobDescription,
      payload.company
    )

    // Submit application via Phoenix Core orchestrator
    const applicationResult = await hhService.submitApplicationViaCore({
      userId,
      jobExternalId,
      customizedCv: customizedCV,
      coverLetter
    })

    // Record successful application
    await db.insert(applications).values({
      userId,
      jobExternalId,
      coverLetter,
      status: 'submitted',
      submittedAt: new Date(),
      responseData: applicationResult,
      hhResumeId: applicationResult.resume_id,
      hhNegotiationId: applicationResult.negotiation_id,
      customCvId: cvId
    })

    // Mark queue item as completed
    await db
      .update(applicationQueue)
      .set({
        status: 'submitted',
        updatedAt: new Date()
      })
      .where(eq(applicationQueue.id, item.id))

    // Update rate limit counters
    await this.updateRateLimitCounters(userId)
  }

  private async checkRateLimits(userId: string): Promise<boolean> {
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Check hourly limit
    const hourlyCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(and(
        eq(applications.userId, userId),
        gte(applications.createdAt, hourAgo)
      ))
      .then(result => result[0]?.count || 0)

    if (hourlyCount >= RATE_LIMITS.HOURLY) {
      return false
    }

    // Check daily limit
    const dailyCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(and(
        eq(applications.userId, userId),
        gte(applications.createdAt, dayAgo)
      ))
      .then(result => result[0]?.count || 0)

    if (dailyCount >= RATE_LIMITS.DAILY) {
      return false
    }

    return true
  }

  private async updateRateLimitCounters(userId: string) {
    // This would update a rate_limits table if we had one
    // For now, we rely on the application count checks above
  }

  private async handleProcessingError(item: any, error: any) {
    const attempts = item.attempts + 1
    const maxAttempts = 5

    if (attempts >= maxAttempts) {
      // Mark as failed after max attempts
      await db
        .update(applicationQueue)
        .set({
          status: 'failed',
          lastError: error.message || 'Unknown error',
          updatedAt: new Date()
        })
        .where(eq(applicationQueue.id, item.id))
    } else {
      // Schedule retry with exponential backoff
      const backoffMinutes = Math.min(Math.pow(2, attempts), 60) // Max 1 hour
      const nextRunAt = new Date(Date.now() + backoffMinutes * 60 * 1000)

      await db
        .update(applicationQueue)
        .set({
          status: 'pending',
          attempts,
          nextRunAt,
          lastError: error.message || 'Unknown error',
          updatedAt: new Date()
        })
        .where(eq(applicationQueue.id, item.id))
    }
  }

  private async scheduleRetry(item: any, reason: string, delayMinutes: number) {
    const nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000)

    await db
      .update(applicationQueue)
      .set({
        status: 'pending',
        nextRunAt,
        lastError: reason,
        updatedAt: new Date()
      })
      .where(eq(applicationQueue.id, item.id))
  }
}

export const queueWorker = new QueueWorker()
