/**
 * Matching Service - Hybrid semantic matching for jobs and CVs
 * Combines: Semantic similarity (60%) + Skill matching (30%) + Experience (10%)
 */

import { db } from '../db/client'
import { parsedCvs, jobs } from '../db/schema'
import { eq, sql } from 'drizzle-orm'
import { embeddingService, type JobItem } from './embedding.service'
import { logger } from '../utils/logger'
import type { ParsedCV } from '../types'

export interface MatchResult {
  totalScore: number
  breakdown: {
    semantic: number
    skills: number
    experience: number
  }
  reasoning: string[]
  confidence: 'high' | 'medium' | 'low'
}

export class MatchingService {
  /**
   * Calculate enhanced match score using hybrid approach
   */
  async calculateEnhancedMatchScore(
    cv: ParsedCV,
    job: JobItem
  ): Promise<MatchResult> {
    logger.debug('Calculating enhanced match score', {
      cvId: cv.id,
      jobId: job.id
    })

    try {
      // 1. Semantic similarity (60% weight)
      const semanticScore = await this.computeSemanticSimilarity(cv, job)

      // 2. Exact skill matches (30% weight)
      const skillScore = this.computeSkillMatch(cv, job)

      // 3. Experience level match (10% weight)
      const experienceScore = this.computeExperienceMatch(cv, job)

      // Calculate weighted total
      const totalScore = Math.round(
        semanticScore * 0.6 + skillScore * 0.3 + experienceScore * 0.1
      )

      // Generate reasoning
      const reasoning = this.generateMatchReasoning(
        cv,
        job,
        semanticScore,
        skillScore,
        experienceScore
      )

      // Determine confidence
      const confidence = this.calculateConfidence(semanticScore, skillScore)

      logger.info('Match score calculated', {
        cvId: cv.id,
        jobId: job.id,
        totalScore,
        breakdown: { semanticScore, skillScore, experienceScore }
      })

      return {
        totalScore,
        breakdown: {
          semantic: semanticScore,
          skills: skillScore,
          experience: experienceScore
        },
        reasoning,
        confidence
      }
    } catch (error) {
      logger.error('Enhanced matching failed', error as Error, { cvId: cv.id, jobId: job.id })
      throw error
    }
  }

  /**
   * Compute semantic similarity using embeddings
   */
  private async computeSemanticSimilarity(
    cv: ParsedCV,
    job: JobItem
  ): Promise<number> {
    // Get or generate embeddings
    const [cvEmbedding, jobEmbedding] = await Promise.all([
      this.getOrCreateCVEmbedding(cv),
      this.getOrCreateJobEmbedding(job)
    ])

    // Calculate cosine similarity
    const similarity = embeddingService.cosineSimilarity(cvEmbedding, jobEmbedding)

    // Convert to 0-100 scale
    return Math.round(similarity * 100)
  }

  /**
   * Get CV embedding from DB or generate if missing
   */
  private async getOrCreateCVEmbedding(cv: ParsedCV): Promise<number[]> {
    if (!cv.id) {
      // CV not yet saved, generate embedding
      return await embeddingService.generateCVEmbedding(cv)
    }

    try {
      // Try to get from database
      const row = await db
        .select({ embedding: parsedCvs.embedding })
        .from(parsedCvs)
        .where(eq(parsedCvs.id, cv.id))
        .limit(1)

      if (row[0]?.embedding) {
        // Parse embedding from database (stored as text)
        const embedding = JSON.parse(row[0].embedding as unknown as string)
        return embedding
      }
    } catch (error) {
      logger.warn('Failed to fetch CV embedding from DB', { cvId: cv.id, error })
    }

    // Generate and save
    const embedding = await embeddingService.generateCVEmbedding(cv)

    try {
      await db
        .update(parsedCvs)
        .set({
          embedding: JSON.stringify(embedding) as any,
          embeddingModel: 'text-embedding-3-large',
          embeddingGeneratedAt: new Date()
        })
        .where(eq(parsedCvs.id, cv.id))
    } catch (error) {
      logger.warn('Failed to save CV embedding to DB', { cvId: cv.id, error })
    }

    return embedding
  }

  /**
   * Get job embedding from DB or generate if missing
   */
  private async getOrCreateJobEmbedding(job: JobItem): Promise<number[]> {
    if (!job.id) {
      return await embeddingService.generateJobEmbedding(job)
    }

    try {
      const row = await db
        .select({ embedding: jobs.embedding })
        .from(jobs)
        .where(eq(jobs.id, job.id))
        .limit(1)

      if (row[0]?.embedding) {
        const embedding = JSON.parse(row[0].embedding as unknown as string)
        return embedding
      }
    } catch (error) {
      logger.warn('Failed to fetch job embedding from DB', { jobId: job.id, error })
    }

    const embedding = await embeddingService.generateJobEmbedding(job)

    try {
      await db
        .update(jobs)
        .set({
          embedding: JSON.stringify(embedding) as any,
          embeddingModel: 'text-embedding-3-large',
          embeddingGeneratedAt: new Date()
        })
        .where(eq(jobs.id, job.id))
    } catch (error) {
      logger.warn('Failed to save job embedding to DB', { jobId: job.id, error })
    }

    return embedding
  }

  /**
   * Compute exact skill match score (legacy algorithm)
   */
  private computeSkillMatch(cv: ParsedCV, job: JobItem): number {
    const cvSkills = new Set((cv.skills || []).map(s => s.toLowerCase()))
    const jobSkills = (job.skills || []).map(s => s.toLowerCase())

    if (jobSkills.length === 0) return 0

    const matches = jobSkills.filter(skill => cvSkills.has(skill)).length
    return Math.round((matches / jobSkills.length) * 100)
  }

  /**
   * Compute experience level match
   */
  private computeExperienceMatch(cv: ParsedCV, job: JobItem): number {
    // Extract years of experience from CV
    const cvYears = this.extractYearsOfExperience(cv.experience || '')

    // Extract required years from job description
    const jobYears = this.extractRequiredYears(job.description || '')

    if (jobYears === null) return 100 // No requirement specified

    // Perfect match at required years, decreasing score below/above
    if (cvYears >= jobYears) {
      // Have required experience or more
      const overage = cvYears - jobYears
      // Slight penalty for being overqualified (0-10% reduction)
      return Math.max(90, 100 - Math.floor(overage * 2))
    } else {
      // Below required experience
      const gap = jobYears - cvYears
      // Penalize more heavily (20% per year gap)
      return Math.max(0, 100 - gap * 20)
    }
  }

  /**
   * Extract years of experience from text
   */
  private extractYearsOfExperience(text: string): number {
    // Look for patterns like "5 years", "3+ years", "2-4 years"
    const patterns = [
      /(\d+)\+?\s*years?/i,
      /(\d+)\s*лет/i, // Russian
      /experience.*?(\d+)/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        return parseInt(match[1], 10)
      }
    }

    // Default: estimate from content length (rough heuristic)
    if (text.length > 2000) return 5
    if (text.length > 1000) return 3
    if (text.length > 500) return 2
    return 1
  }

  /**
   * Extract required years from job description
   */
  private extractRequiredYears(text: string): number | null {
    const patterns = [
      /(\d+)\+?\s*years?\s*(of\s*)?experience/i,
      /minimum.*?(\d+)\s*years?/i,
      /(\d+)\s*лет.*?опыта/i // Russian
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        return parseInt(match[1], 10)
      }
    }

    return null // No specific requirement
  }

  /**
   * Generate human-readable reasoning for match score
   */
  private generateMatchReasoning(
    cv: ParsedCV,
    job: JobItem,
    semanticScore: number,
    skillScore: number,
    experienceScore: number
  ): string[] {
    const reasons: string[] = []

    // Semantic match
    if (semanticScore >= 80) {
      reasons.push('Strong overall match between CV and job requirements')
    } else if (semanticScore >= 60) {
      reasons.push('Good alignment with job requirements')
    } else if (semanticScore >= 40) {
      reasons.push('Moderate match with some relevant experience')
    } else {
      reasons.push('Limited alignment with job requirements')
    }

    // Skill match
    const cvSkills = new Set((cv.skills || []).map(s => s.toLowerCase()))
    const jobSkills = (job.skills || []).map(s => s.toLowerCase())
    const matchedSkills = jobSkills.filter(s => cvSkills.has(s))

    if (matchedSkills.length > 0) {
      reasons.push(`Matches ${matchedSkills.length}/${jobSkills.length} required skills: ${matchedSkills.slice(0, 3).join(', ')}${matchedSkills.length > 3 ? '...' : ''}`)
    } else {
      reasons.push('No exact skill keyword matches found')
    }

    // Experience level
    if (experienceScore >= 90) {
      reasons.push('Experience level matches job requirements')
    } else if (experienceScore >= 70) {
      reasons.push('Slightly overqualified for position')
    } else if (experienceScore >= 50) {
      reasons.push('Close to required experience level')
    } else {
      reasons.push('Below required experience level')
    }

    return reasons
  }

  /**
   * Calculate confidence in match score
   */
  private calculateConfidence(
    semanticScore: number,
    skillScore: number
  ): 'high' | 'medium' | 'low' {
    // High confidence if both metrics agree
    if (semanticScore >= 70 && skillScore >= 70) return 'high'
    if (semanticScore >= 50 && skillScore >= 50) return 'medium'

    // If they disagree significantly, confidence is lower
    const diff = Math.abs(semanticScore - skillScore)
    if (diff > 30) return 'low'

    return 'medium'
  }

  /**
   * Find top N matching jobs for a CV using vector similarity
   */
  async findSimilarJobs(
    cv: ParsedCV,
    limit: number = 10,
    minScore: number = 50
  ): Promise<Array<{ job: JobItem; score: number }>> {
    const cvEmbedding = await this.getOrCreateCVEmbedding(cv)

    try {
      // Use pgvector for fast similarity search
      const results = await db.execute(sql`
        SELECT
          j.*,
          1 - (j.embedding::vector <=> ${JSON.stringify(cvEmbedding)}::vector) AS similarity_score
        FROM ${jobs} j
        WHERE j.embedding IS NOT NULL
          AND (1 - (j.embedding::vector <=> ${JSON.stringify(cvEmbedding)}::vector)) * 100 >= ${minScore}
        ORDER BY j.embedding::vector <=> ${JSON.stringify(cvEmbedding)}::vector
        LIMIT ${limit}
      `)

      return results.rows.map((row: any) => ({
        job: row as JobItem,
        score: Math.round(row.similarity_score * 100)
      }))
    } catch (error) {
      logger.error('Vector similarity search failed', error as Error)
      return []
    }
  }
}

export const matchingService = new MatchingService()
