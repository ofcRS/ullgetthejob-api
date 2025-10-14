import { db } from '../db/client'
import { parsedCvs } from '../db/schema'
import { eq } from 'drizzle-orm'

type CreateParsedCvInput = {
  userId: string | null
  parsedData: any
  originalFilename?: string
  filePath?: string
  modelUsed?: string
}

export class StorageService {
  async createParsedCv(input: CreateParsedCvInput) {
    try {
      const [row] = await db.insert(parsedCvs).values({
        userId: input.userId as any,
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
      return null
    }
  }

  async getCvById(id: string) {
    const [row] = await db.select().from(parsedCvs).where(eq(parsedCvs.id, id))
    return row
  }

  async listParsedCvs(limit = 20) {
    const rows = await db.select().from(parsedCvs).limit(limit)
    return rows
  }
}


