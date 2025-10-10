import { eq, and, desc, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { applications, customCvs } from '../db/schema'

export class ApplicationService {
  async createApplication(userId: string, data: {
    jobId: string
    customCvId?: string
    jobExternalId: string
    coverLetter?: string
  }) {
    const [application] = await db.insert(applications).values({
      userId,
      ...data
    }).returning()

    return application
  }

  async getUserApplications(userId: string, filters?: {
    status?: string
    limit?: number
    offset?: number
  }) {
    const limit = filters?.limit || 50
    const offset = filters?.offset || 0

    let query = db.select({
      id: applications.id,
      jobId: applications.jobId,
      customCvId: applications.customCvId,
      jobExternalId: applications.jobExternalId,
      coverLetter: applications.coverLetter,
      status: applications.status,
      submittedAt: applications.submittedAt,
      responseData: applications.responseData,
      errorMessage: applications.errorMessage,
      hhResumeId: applications.hhResumeId,
      hhNegotiationId: applications.hhNegotiationId,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt
    }).from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.createdAt))

    if (filters?.status) {
      query = query.where(eq(applications.status, filters.status))
    }

    query = query.limit(limit).offset(offset)

    return await query
  }

  async getApplication(userId: string, applicationId: string) {
    const [application] = await db.select().from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1)

    return application || null
  }

  async updateApplication(userId: string, applicationId: string, updates: Partial<{
    status: string
    submittedAt: Date
    responseData: Record<string, unknown>
    errorMessage: string
    hhResumeId: string
    hhNegotiationId: string
  }>) {
    const [application] = await db.update(applications)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .returning()

    return application || null
  }

  async deleteApplication(userId: string, applicationId: string) {
    const result = await db.delete(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))

    return result.rowCount > 0
  }

  async submitApplication(userId: string, applicationId: string) {
    // This would integrate with HH.ru API
    // For now, just mark as submitted
    return await this.updateApplication(userId, applicationId, {
      status: 'submitted',
      submittedAt: new Date()
    })
  }
}

export const applicationService = new ApplicationService()
