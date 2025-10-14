import { db } from '../db/client'
import { cvs } from '../db/schema'
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
      const [row] = await db.insert(cvs).values({
        userId: input.userId as any, // MVP: null allowed at DB layer for now
        name: input.originalFilename || 'Uploaded CV',
        filePath: input.filePath || '',
        originalFilename: input.originalFilename,
        contentType: undefined,
        parsedData: input.parsedData,
      }).returning()
      return row
    } catch (e) {
      console.error('Failed to save parsed CV:', e)
      return null
    }
  }

  async getCvById(id: string) {
    const [row] = await db.select().from(cvs).where(eq(cvs.id, id))
    return row
  }
}


