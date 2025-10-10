import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { env } from '../config/env'

export class FileUploadService {
  private uploadDir = env.UPLOAD_DIR || './uploads'

  async ensureUploadDir() {
    try {
      await mkdir(this.uploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
  }

  async saveFile(file: File, filename?: string): Promise<{ filePath: string; originalFilename: string }> {
    await this.ensureUploadDir()

    const originalName = filename || file.name
    const fileExtension = path.extname(originalName)
    const baseName = path.basename(originalName, fileExtension)
    const uniqueName = `${baseName}-${Date.now()}-${Math.random().toString(36).substring(2)}${fileExtension}`
    const filePath = path.join(this.uploadDir, uniqueName)

    const buffer = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(buffer))

    return {
      filePath,
      originalFilename: originalName
    }
  }

  getAllowedTypes(): string[] {
    return [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  }

  validateFileType(contentType: string): boolean {
    return this.getAllowedTypes().includes(contentType)
  }

  validateFileSize(size: number): boolean {
    const maxSize = env.MAX_FILE_SIZE || 10 * 1024 * 1024 // 10MB default
    return size <= maxSize
  }
}

export const fileUploadService = new FileUploadService()
