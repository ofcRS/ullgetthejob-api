import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { customCvs, cvs } from '../db/schema'

export class CustomCVService {
  async createCustomCV(cvId: string, data: {
    jobId?: string
    jobTitle?: string
    customizedData?: Record<string, unknown>
    coverLetter?: string
    aiSuggestions?: Record<string, unknown>
  }) {
    const [customCv] = await db.insert(customCvs).values({
      cvId,
      ...data
    }).returning()

    return customCv
  }

  async getCustomCVsByUser(userId: string) {
    return await db.select({
      id: customCvs.id,
      cvId: customCvs.cvId,
      jobId: customCvs.jobId,
      jobTitle: customCvs.jobTitle,
      customizedData: customCvs.customizedData,
      coverLetter: customCvs.coverLetter,
      aiSuggestions: customCvs.aiSuggestions,
      createdAt: customCvs.createdAt,
      updatedAt: customCvs.updatedAt,
      cv: {
        id: cvs.id,
        name: cvs.name,
        originalFilename: cvs.originalFilename
      }
    })
    .from(customCvs)
    .innerJoin(cvs, eq(customCvs.cvId, cvs.id))
    .where(and(eq(cvs.userId, userId), eq(cvs.isActive, true)))
    .orderBy(desc(customCvs.createdAt))
  }

  async getCustomCV(userId: string, customCvId: string) {
    const [customCv] = await db.select({
      id: customCvs.id,
      cvId: customCvs.cvId,
      jobId: customCvs.jobId,
      jobTitle: customCvs.jobTitle,
      customizedData: customCvs.customizedData,
      coverLetter: customCvs.coverLetter,
      aiSuggestions: customCvs.aiSuggestions,
      createdAt: customCvs.createdAt,
      updatedAt: customCvs.updatedAt,
      cv: {
        id: cvs.id,
        name: cvs.name,
        originalFilename: cvs.originalFilename,
        parsedData: cvs.parsedData
      }
    })
    .from(customCvs)
    .innerJoin(cvs, eq(customCvs.cvId, cvs.id))
    .where(and(eq(customCvs.id, customCvId), eq(cvs.userId, userId)))
    .limit(1)

    return customCv || null
  }

  async updateCustomCV(userId: string, customCvId: string, updates: Partial<{
    jobId: string
    jobTitle: string
    customizedData: Record<string, unknown>
    coverLetter: string
    aiSuggestions: Record<string, unknown>
  }>) {
    // First verify ownership through CV join
    const [existing] = await db.select()
      .from(customCvs)
      .innerJoin(cvs, eq(customCvs.cvId, cvs.id))
      .where(and(eq(customCvs.id, customCvId), eq(cvs.userId, userId)))
      .limit(1)

    if (!existing) return null

    const [customCv] = await db.update(customCvs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customCvs.id, customCvId))
      .returning()

    return customCv || null
  }

  async deleteCustomCV(userId: string, customCvId: string) {
    // First verify ownership through CV join
    const [existing] = await db.select()
      .from(customCvs)
      .innerJoin(cvs, eq(customCvs.cvId, cvs.id))
      .where(and(eq(customCvs.id, customCvId), eq(cvs.userId, userId)))
      .limit(1)

    if (!existing) return false

    const result = await db.delete(customCvs).where(eq(customCvs.id, customCvId))
    return result.rowCount > 0
  }

  async analyzeWithAI(userId: string, customCvId: string) {
    // This would integrate with OpenRouter API
    // For now, return mock analysis
    const customCv = await this.getCustomCV(userId, customCvId)
    if (!customCv) return null

    const mockSuggestions = {
      score: 85,
      suggestions: [
        "Add more specific technical skills",
        "Highlight relevant project experience",
        "Customize the cover letter for this role"
      ],
      keywords: ["JavaScript", "React", "Node.js", "TypeScript"]
    }

    return await this.updateCustomCV(userId, customCvId, {
      aiSuggestions: mockSuggestions
    })
  }
}

export const customCvService = new CustomCVService()
