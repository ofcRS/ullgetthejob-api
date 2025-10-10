import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { cvs } from '../db/schema'

export class CVService {
  async createCV(userId: string, fileData: {
    name: string
    filePath: string
    originalFilename: string
    contentType: string
    parsedData?: Record<string, unknown>
  }) {
    const [cv] = await db.insert(cvs).values({
      userId,
      ...fileData
    }).returning()

    return cv
  }

  async getUserCVs(userId: string) {
    return await db.select({
      id: cvs.id,
      name: cvs.name,
      originalFilename: cvs.originalFilename,
      contentType: cvs.contentType,
      parsedData: cvs.parsedData,
      isActive: cvs.isActive,
      createdAt: cvs.createdAt,
      updatedAt: cvs.updatedAt
    }).from(cvs).where(and(eq(cvs.userId, userId), eq(cvs.isActive, true))).orderBy(desc(cvs.createdAt))
  }

  async getCV(userId: string, cvId: string) {
    const [cv] = await db.select().from(cvs)
      .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
      .limit(1)

    return cv || null
  }

  async updateCV(userId: string, cvId: string, updates: Partial<{
    name: string
    parsedData: Record<string, unknown>
  }>) {
    const [cv] = await db.update(cvs)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
      .returning()

    return cv || null
  }

  async deleteCV(userId: string, cvId: string) {
    const [cv] = await db.update(cvs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
      .returning()

    return cv || null
  }
}

export const cvService = new CVService()
