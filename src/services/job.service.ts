import { eq, ilike, desc, and, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { jobs } from '../db/schema'

export class JobService {
  async getJobs(filters?: {
    search?: string
    area?: string
    limit?: number
    offset?: number
  }) {
    const limit = filters?.limit || 50
    const offset = filters?.offset || 0

    let query = db.select().from(jobs).orderBy(desc(jobs.fetchedAt))

    if (filters?.search) {
      query = query.where(ilike(jobs.title, `%${filters.search}%`))
    }

    if (filters?.area) {
      query = query.where(ilike(jobs.area, `%${filters.area}%`))
    }

    query = query.limit(limit).offset(offset)

    return await query
  }

  async getJob(id: string) {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
    return job || null
  }

  async getStatistics() {
    const [stats] = await db.select({
      totalJobs: sql<number>`count(*)`,
      recentJobs: sql<number>`count(case when fetched_at > now() - interval '24 hours' then 1 end)`,
      uniqueAreas: sql<number>`count(distinct area)`
    }).from(jobs)

    return stats
  }
}

export const jobService = new JobService()
