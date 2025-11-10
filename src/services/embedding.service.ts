/**
 * Embedding Service - Generates vector embeddings for semantic similarity search
 * Uses OpenAI text-embedding-3-large model (1536 dimensions)
 */

import { env } from '../config/env'
import { cache } from './cache.service'
import { hashString } from '../utils/crypto'
import { logger } from '../utils/logger'
import type { ParsedCV } from '../types'

export interface JobItem {
  id?: string
  title?: string
  company?: string
  description?: string
  skills?: string[]
  salary?: string
}

export class EmbeddingService {
  private openaiKey = env.OPENAI_API_KEY
  private model = 'text-embedding-3-large' // 1536 dimensions
  private baseURL = 'https://api.openai.com/v1/embeddings'

  /**
   * Generate embedding for a CV
   * Uses title, summary, skills, and first 500 chars of experience
   */
  async generateCVEmbedding(cv: ParsedCV): Promise<number[]> {
    const text = this.prepareCVText(cv)
    const cacheKey = `embedding:cv:${hashString(text)}`

    // Check cache first
    const cached = cache.get<number[]>(cacheKey)
    if (cached) {
      logger.debug('Embedding cache hit', { type: 'cv', length: cached.length })
      return cached
    }

    // Generate new embedding
    const embedding = await this.getEmbedding(text)

    // Cache for 30 days (embeddings don't change unless CV changes)
    cache.set(cacheKey, embedding, 86400000 * 30)

    logger.info('CV embedding generated', {
      dimensions: embedding.length,
      textLength: text.length
    })

    return embedding
  }

  /**
   * Generate embedding for a job posting
   * Uses title, description, and skills
   */
  async generateJobEmbedding(job: JobItem): Promise<number[]> {
    const text = this.prepareJobText(job)
    const cacheKey = `embedding:job:${hashString(text)}`

    const cached = cache.get<number[]>(cacheKey)
    if (cached) {
      logger.debug('Embedding cache hit', { type: 'job', length: cached.length })
      return cached
    }

    const embedding = await this.getEmbedding(text)

    // Cache for 7 days (jobs may update)
    cache.set(cacheKey, embedding, 86400000 * 7)

    logger.info('Job embedding generated', {
      dimensions: embedding.length,
      textLength: text.length
    })

    return embedding
  }

  /**
   * Prepare CV text for embedding
   */
  private prepareCVText(cv: ParsedCV): string {
    const parts: string[] = []

    // Title (high importance)
    if (cv.title) parts.push(`Professional Title: ${cv.title}`)

    // Summary (high importance)
    if (cv.summary) parts.push(`Summary: ${cv.summary}`)

    // Skills (high importance)
    if (cv.skills && cv.skills.length > 0) {
      parts.push(`Skills: ${cv.skills.join(', ')}`)
    }

    // Experience (truncated to first 500 chars for context)
    if (cv.experience) {
      const exp = cv.experience.substring(0, 500)
      parts.push(`Experience: ${exp}`)
    }

    // Education (brief)
    if (cv.education) {
      const edu = cv.education.substring(0, 200)
      parts.push(`Education: ${edu}`)
    }

    return parts.join('\n\n')
  }

  /**
   * Prepare job text for embedding
   */
  private prepareJobText(job: JobItem): string {
    const parts: string[] = []

    // Job title (high importance)
    if (job.title) parts.push(`Position: ${job.title}`)

    // Company (context)
    if (job.company) parts.push(`Company: ${job.company}`)

    // Required skills (high importance)
    if (job.skills && job.skills.length > 0) {
      parts.push(`Required Skills: ${job.skills.join(', ')}`)
    }

    // Description (truncated to 500 chars)
    if (job.description) {
      const desc = job.description.substring(0, 500)
      parts.push(`Description: ${desc}`)
    }

    // Salary (optional context)
    if (job.salary) {
      parts.push(`Salary: ${job.salary}`)
    }

    return parts.join('\n\n')
  }

  /**
   * Call OpenAI Embeddings API
   */
  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.openaiKey) {
      throw new Error('OPENAI_API_KEY not configured. Please set it in your .env file.')
    }

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: this.model,
          encoding_format: 'float' // Ensure we get float arrays
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      const data = await response.json()

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API')
      }

      // Log token usage for cost tracking
      if (data.usage) {
        logger.info('OpenAI embedding tokens used', {
          promptTokens: data.usage.prompt_tokens,
          totalTokens: data.usage.total_tokens,
          estimatedCost: (data.usage.total_tokens / 1000000) * 0.13 // $0.13/1M tokens
        })
      }

      return data.data[0].embedding
    } catch (error) {
      logger.error('Failed to generate embedding', error as Error)
      throw error
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Returns value between 0 and 1 (1 = identical, 0 = orthogonal)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions')
    }

    let dotProduct = 0
    let magnitudeA = 0
    let magnitudeB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      magnitudeA += a[i] * a[i]
      magnitudeB += b[i] * b[i]
    }

    magnitudeA = Math.sqrt(magnitudeA)
    magnitudeB = Math.sqrt(magnitudeB)

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0
    }

    return dotProduct / (magnitudeA * magnitudeB)
  }

  /**
   * Batch generate embeddings (for backfilling existing data)
   */
  async batchGenerateCVEmbeddings(cvs: ParsedCV[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>()

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10
    for (let i = 0; i < cvs.length; i += batchSize) {
      const batch = cvs.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (cv) => {
          try {
            const embedding = await this.generateCVEmbedding(cv)
            if (cv.id) {
              results.set(cv.id, embedding)
            }
          } catch (error) {
            logger.error('Failed to generate embedding for CV', error as Error, { cvId: cv.id })
          }
        })
      )

      // Rate limiting: wait 1 second between batches
      if (i + batchSize < cvs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      logger.info('Batch embedding progress', {
        processed: Math.min(i + batchSize, cvs.length),
        total: cvs.length
      })
    }

    return results
  }

  /**
   * Batch generate job embeddings
   */
  async batchGenerateJobEmbeddings(jobs: JobItem[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>()

    const batchSize = 10
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (job) => {
          try {
            const embedding = await this.generateJobEmbedding(job)
            if (job.id) {
              results.set(job.id, embedding)
            }
          } catch (error) {
            logger.error('Failed to generate embedding for job', error as Error, { jobId: job.id })
          }
        })
      )

      if (i + batchSize < jobs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      logger.info('Batch embedding progress', {
        processed: Math.min(i + batchSize, jobs.length),
        total: jobs.length
      })
    }

    return results
  }
}

export const embeddingService = new EmbeddingService()
