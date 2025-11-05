import { db } from '../db/client'
import { parsedCvs } from '../db/schema'
import { eq, isNull } from 'drizzle-orm'
import type { CreateParsedCvInput, ParsedCV } from '../types'

export class StorageService {
  async createParsedCv(input: CreateParsedCvInput): Promise<ParsedCV> {
    try {
      const [row] = await db.insert(parsedCvs).values({
        userId: input.userId || undefined,
        firstName: input.parsedData.firstName,
        lastName: input.parsedData.lastName,
        email: input.parsedData.email,
        phone: input.parsedData.phone,
        title: input.parsedData.title,
        summary: input.parsedData.summary,
        experience: input.parsedData.experience,
        education: input.parsedData.education,
        skills: input.parsedData.skills || [],
        projects: input.parsedData.projects,
        fullText: input.parsedData.fullText,
        originalFilename: input.originalFilename,
        filePath: input.filePath,
        modelUsed: input.modelUsed,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning()
      return row
    } catch (e) {
      console.error('Failed to save parsed CV:', e)
      throw new Error(`Database error: Failed to save CV - ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  async getCvById(id: string): Promise<ParsedCV | undefined> {
    const [row] = await db.select().from(parsedCvs).where(eq(parsedCvs.id, id))
    return row
  }

  async listParsedCvs(limit = 20): Promise<ParsedCV[]> {
    const rows = await db.select().from(parsedCvs).limit(limit)
    return rows
  }

  async listParsedCvsByUser(userId: string | null, limit = 20): Promise<ParsedCV[]> {
    if (userId === null) {
      // For backward compatibility, if userId is null, return empty array
      // or you could return all CVs with null userId for migration period
      const rows = await db.select()
        .from(parsedCvs)
        .where(eq(parsedCvs.userId, null))
        .limit(limit)
      return rows
    }

    const rows = await db.select()
      .from(parsedCvs)
      .where(eq(parsedCvs.userId, userId))
      .limit(limit)
    return rows
  }
}


