import { db } from '../db/client'
import { applications, jobs } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'

export class ApplicationTrackerService {
  constructor(private db: typeof db) {}

  /**
   * Get applications for user with optional filtering
   */
  async getApplications(
    userId: string,
    filters: { status?: string; limit?: number } = {}
  ) {
    let queryBuilder = this.db
      .select({
        id: applications.id,
        status: applications.status,
        submittedAt: applications.submittedAt,
        errorMessage: applications.errorMessage,
        hhResumeId: applications.hhResumeId,
        hhNegotiationId: applications.hhNegotiationId,
        hhStatus: applications.hhStatus,
        coverLetter: applications.coverLetter,
        responseData: applications.responseData,
        createdAt: applications.createdAt,
        job: {
          id: jobs.id,
          title: jobs.title,
          company: jobs.company,
          salary: jobs.salary,
          area: jobs.area,
          url: jobs.url
        }
      })
      .from(applications)
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.createdAt))
      .$dynamic()

    if (filters.status) {
      queryBuilder = queryBuilder.where(eq(applications.status, filters.status))
    }

    if (filters.limit) {
      queryBuilder = queryBuilder.limit(filters.limit)
    }

    return await queryBuilder
  }

  /**
   * Get application statistics
   */
  async getStats(userId: string) {
    const allApps = await this.db
      .select()
      .from(applications)
      .where(eq(applications.userId, userId))

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    return {
      total: allApps.length,
      pending: allApps.filter(a => a.status === 'pending').length,
      submitted: allApps.filter(a => a.status === 'submitted' || a.submittedAt).length,
      failed: allApps.filter(a => a.status === 'failed').length,
      rateLimited: allApps.filter(a => a.rateLimitedUntil && new Date(a.rateLimitedUntil) > now).length,
      today: allApps.filter(a => a.submittedAt && new Date(a.submittedAt) >= today).length,
      thisWeek: allApps.filter(a => a.submittedAt && new Date(a.submittedAt) >= thisWeek).length
    }
  }

  /**
   * Retry a failed application
   */
  async retryApplication(applicationId: string) {
    // Reset status to pending and clear error
    await this.db
      .update(applications)
      .set({
        status: 'pending',
        errorMessage: null,
        submittedAt: null
      })
      .where(eq(applications.id, applicationId))

    // TODO: Trigger re-submission via Core
  }
}
